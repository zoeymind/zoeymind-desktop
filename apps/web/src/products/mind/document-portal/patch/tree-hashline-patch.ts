export type TreePatchKind = "put" | "insert-before" | "insert-after" | "cut" | "move"

export interface ParsedTreeNode {
  uid?: string
  text: string
  icon?: string[]
  children: ParsedTreeNode[]
}

export interface TreePatchOperation {
  kind: TreePatchKind
  start: number
  end?: number
  destination?: number
  nodes?: ParsedTreeNode[]
}

const OPERATION =
  /^(PUT (?:([<>])?([1-9]\d*)(?:\*)?(?:\.=([1-9]\d*))?)|CUT ([1-9]\d*)(?:\.=([1-9]\d*))?|(?:MOVE|MV) ([1-9]\d*)\s*(?:->|TO)\s*([1-9]\d*)):\s*$/

function parseNode(line: string): { depth: number; node: ParsedTreeNode } | null {
  const match = /^( *)(?:(#) |\[P([1-3])\] )?(.+)$/.exec(line)
  if (!match || match[1].length % 2 !== 0) return null
  const text = match[4].trim()
  if (!text) return null
  const icon = match[2] ? ["sign_2"] : match[3] ? [`priority_${match[3]}`] : undefined
  return { depth: match[1].length / 2, node: { text, ...(icon ? { icon } : {}), children: [] } }
}

function parseTree(lines: string[]): ParsedTreeNode[] | null {
  const roots: ParsedTreeNode[] = []
  const stack: Array<{ depth: number; node: ParsedTreeNode }> = []
  for (const line of lines) {
    if (!line.startsWith("+")) return null
    const parsed = parseNode(line.slice(1))
    if (!parsed) return null
    while (stack.length && stack[stack.length - 1]!.depth >= parsed.depth) stack.pop()
    if (parsed.depth > 0 && (!stack.length || stack[stack.length - 1]!.depth !== parsed.depth - 1))
      return null
    if (stack.length) stack[stack.length - 1]!.node.children.push(parsed.node)
    else roots.push(parsed.node)
    stack.push(parsed)
  }
  return roots.length ? roots : null
}

export function parseTreeHashlinePatch(patch: string): TreePatchOperation[] | null {
  const lines = patch.split("\n")
  const operations: TreePatchOperation[] = []
  for (let index = 0; index < lines.length;) {
    const match = OPERATION.exec(lines[index] ?? "")
    if (!match) return null
    if (lines[index]?.includes("*") && match[2] !== ">") return null
    const put = match[1] !== undefined
    const cut = match[5] !== undefined
    const move = match[7] !== undefined
    if (move) {
      operations.push({ kind: "move", start: Number(match[7]), destination: Number(match[8]) })
      index += 1
      continue
    }
    if (cut) {
      operations.push({
        kind: "cut",
        start: Number(match[5]),
        end: match[6] ? Number(match[6]) : Number(match[5]),
      })
      index += 1
      continue
    }
    if (!put) return null
    const block: string[] = []
    index += 1
    while (index < lines.length && lines[index]?.startsWith("+")) block.push(lines[index++]!)
    const nodes = parseTree(block)
    if (!nodes) return null
    const marker = match[2]
    const start = Number(match[3])
    const end = match[4] ? Number(match[4]) : start
    operations.push({
      kind: marker === "<" ? "insert-before" : marker === ">" ? "insert-after" : "put",
      start,
      end,
      nodes,
    })
  }
  return operations.length ? operations : null
}

export function countParsedNodes(nodes: readonly ParsedTreeNode[]): number {
  return nodes.reduce((count, node) => count + 1 + countParsedNodes(node.children), 0)
}
