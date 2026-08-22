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
  const match = /^( *)(?:(#) |\[P([1-3])\]\s*)?(.+)$/.exec(line)
  if (!match || match[1].length % 2 !== 0) return null
  const text = match[4].trim()
  if (!text) return null
  const icon = match[2] ? ["sign_2"] : match[3] ? [`priority_${match[3]}`] : undefined
  return { depth: match[1].length / 2, node: { text, ...(icon ? { icon } : {}), children: [] } }
}

function parseTree(lines: string[]): ParsedTreeNode[] | null {
  const parsedLines: Array<{ depth: number; node: ParsedTreeNode }> = []
  for (const line of lines) {
    if (!line.startsWith("+")) return null
    const parsed = parseNode(line.slice(1))
    if (!parsed) return null
    parsedLines.push(parsed)
  }
  if (parsedLines.length === 0) return null
  const baseDepth = Math.min(...parsedLines.map(line => line.depth))
  const roots: ParsedTreeNode[] = []
  const stack: Array<{ depth: number; node: ParsedTreeNode }> = []
  for (const parsed of parsedLines) {
    const depth = parsed.depth - baseDepth
    while (stack.length && stack[stack.length - 1]!.depth >= depth) stack.pop()
    if (depth > 0 && (!stack.length || stack[stack.length - 1]!.depth !== depth - 1)) return null
    if (stack.length) stack[stack.length - 1]!.node.children.push(parsed.node)
    else roots.push(parsed.node)
    stack.push({ depth, node: parsed.node })
  }
  return roots.length ? roots : null
}

const CANONICAL_EXAMPLE =
  "PUT >2:\n+  # 新模块\n+    [P1] 新用例 & 前置条件\n+      执行操作 & 预期结果"

export function explainInvalidTreeHashlinePatch(patch: string): string {
  if (/^\*\*\* (?:Begin Patch|Update File)/m.test(patch) || /^@@/m.test(patch))
    return `Git Patch is not valid Tree Hashline syntax. Use:\n${CANONICAL_EXAMPLE}`
  const addAfter = /^ADD AFTER line ([1-9]\d*):/im.exec(patch)
  if (addAfter)
    return `ADD AFTER is not valid Tree Hashline syntax. Use:\n${CANONICAL_EXAMPLE.replace(">2", `>${addAfter[1]}`)}`

  const lines = patch.replace(/\r\n?/g, "\n").split("\n")
  while (lines.at(-1) === "") lines.pop()
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    if (OPERATION.test(line)) {
      const operation = OPERATION.exec(line)
      const needsBody = operation?.[1] !== undefined
      if (needsBody && !lines[index + 1]?.startsWith("+"))
        return `Patch line ${index + 1} has no +tree body: ${JSON.stringify(line)}. Use:\n${CANONICAL_EXAMPLE}`
      continue
    }
    if (line.startsWith("+")) {
      if (!parseNode(line.slice(1)))
        return `Patch line ${index + 1} has invalid tree indentation or empty content: ${JSON.stringify(line)}. Use two spaces per depth. Example:\n${CANONICAL_EXAMPLE}`
      continue
    }
    return `Patch line ${index + 1} is invalid: ${JSON.stringify(line)}. Operations must be on their own line and content rows must start with +. Example:\n${CANONICAL_EXAMPLE}`
  }
  return `Patch is empty. Use:\n${CANONICAL_EXAMPLE}`
}

export function parseTreeHashlinePatch(patch: string): TreePatchOperation[] | null {
  const lines = patch.replace(/\r\n?/g, "\n").split("\n")
  while (lines.at(-1) === "") lines.pop()
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
