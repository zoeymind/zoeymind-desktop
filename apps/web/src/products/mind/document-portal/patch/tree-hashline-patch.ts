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

/** 多操作 patch 的正确形状: 操作行独立成行且不带 '+', 每个 PUT 跟自己的 +tree body. */
const MULTI_OP_EXAMPLE = "PUT <2:\n+  # 模块A\n+    [P1] 用例A & 前置条件\nPUT >8:\n+  # 模块B"

function plusPrefixedOperationMessage(lineNumber: number, row: string): string {
  return `Patch line ${lineNumber}: ${JSON.stringify(row)} is an operation line hidden inside a +tree body. Operation lines must not start with '+'. Write each operation on its own line:\n${MULTI_OP_EXAMPLE}`
}

/** 镜像 parseTree 的父子校验, 定位到具体出错行而不是让整个 patch 静默失败. */
function explainBlockRows(lines: string[], start: number, end: number): string | null {
  const depths: number[] = []
  for (let index = start; index < end; index += 1) {
    const row = lines[index]!
    if (OPERATION.test(row.slice(1).trimStart()))
      return plusPrefixedOperationMessage(index + 1, row)
    const parsed = parseNode(row.slice(1))
    if (!parsed)
      return `Patch line ${index + 1} has invalid tree indentation or empty content: ${JSON.stringify(row)}. Use two spaces per depth. Example:\n${CANONICAL_EXAMPLE}`
    depths.push(parsed.depth)
  }
  const base = Math.min(...depths)
  const stack: number[] = []
  for (let offset = 0; offset < depths.length; offset += 1) {
    const depth = depths[offset]! - base
    while (stack.length && stack[stack.length - 1]! >= depth) stack.pop()
    if (depth > 0 && (!stack.length || stack[stack.length - 1]! !== depth - 1))
      return `Patch line ${start + offset + 1} has invalid tree indentation: the row is ${depth * 2} spaces deeper than the block base but has no parent one level above it. Children indent exactly two spaces under their parent row.`
    stack.push(depth)
  }
  return null
}

export function explainInvalidTreeHashlinePatch(patch: string): string {
  if (/^\*\*\* (?:Begin Patch|Update File)/m.test(patch) || /^@@/m.test(patch))
    return `Git Patch is not valid Tree Hashline syntax. Use:\n${CANONICAL_EXAMPLE}`
  const addAfter = /^ADD AFTER line ([1-9]\d*):/im.exec(patch)
  if (addAfter)
    return `ADD AFTER is not valid Tree Hashline syntax. Use:\n${CANONICAL_EXAMPLE.replace(">2", `>${addAfter[1]}`)}`

  const lines = patch.replace(/\r\n?/g, "\n").split("\n")
  while (lines.at(-1) === "") lines.pop()
  if (lines.length === 0) return `Patch is empty. Use:\n${CANONICAL_EXAMPLE}`

  let sawOperation = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    const operation = OPERATION.exec(line)
    if (operation) {
      sawOperation = true
      if (line.includes("*") && operation[2] !== ">")
        return `Patch line ${index + 1}: the '*' block selector is only valid as PUT >N*:. Rewrite ${JSON.stringify(line)} without '*'.`
      if (operation[3] === undefined) continue // CUT / MV take no body
      const blockStart = index + 1
      let blockEnd = blockStart
      while (blockEnd < lines.length && lines[blockEnd]!.startsWith("+")) blockEnd += 1
      if (blockEnd === blockStart)
        return `Patch line ${index + 1} has no +tree body: ${JSON.stringify(line)}. Use:\n${CANONICAL_EXAMPLE}`
      const rowIssue = explainBlockRows(lines, blockStart, blockEnd)
      if (rowIssue) return rowIssue
      index = blockEnd - 1
      continue
    }
    if (line.startsWith("+")) {
      if (OPERATION.test(line.slice(1).trimStart()))
        return plusPrefixedOperationMessage(index + 1, line)
      return `Patch line ${index + 1}: content row ${JSON.stringify(line)} must follow a PUT operation. CUT and MV take no +tree body. Example:\n${MULTI_OP_EXAMPLE}`
    }
    return `Patch line ${index + 1} is invalid: ${JSON.stringify(line)}. Operations must be on their own line and content rows must start with +. Example:\n${CANONICAL_EXAMPLE}`
  }
  if (!sawOperation) return `Patch has no operations. Use:\n${CANONICAL_EXAMPLE}`
  return `Patch could not be parsed. Each operation line (PUT/CUT/MV) stands alone without '+'; every content row starts with '+' and indents two spaces per level. Example:\n${MULTI_OP_EXAMPLE}`
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
