import type { MindMapNodeTree } from "simple-mind-map"

const MODULE_ICON = "sign_2"
const PRIORITY_ICON_PREFIX = "priority_"

interface ProjectionOptions {
  root: MindMapNodeTree
  view: "outline" | "subtree"
  path?: string[]
  maxLines: number
}

export interface TestDocumentProjection {
  content: string
  lineCount: number
  truncated: boolean
}

function getText(node: MindMapNodeTree): string {
  return typeof node.data.text === "string" ? node.data.text.trim() : ""
}

function getIcons(node: MindMapNodeTree): string[] {
  return Array.isArray(node.data.icon)
    ? node.data.icon.filter((icon): icon is string => typeof icon === "string")
    : []
}

function isModule(node: MindMapNodeTree): boolean {
  return getIcons(node).includes(MODULE_ICON)
}

function priority(node: MindMapNodeTree): number | null {
  for (const icon of getIcons(node)) {
    if (!icon.startsWith(PRIORITY_ICON_PREFIX)) continue
    const value = Number(icon.slice(PRIORITY_ICON_PREFIX.length))
    if (value >= 1 && value <= 3) return value
  }
  return null
}

function formatNode(node: MindMapNodeTree): string {
  const text = getText(node)
  if (isModule(node)) return `# ${text}`
  const casePriority = priority(node)
  if (casePriority !== null) return `[P${casePriority}] ${text}`
  return text
}

function findByPath(root: MindMapNodeTree, path: string[]): MindMapNodeTree | null {
  let current = root
  for (const segment of path) {
    const next = current.children.find(child => getText(child) === segment)
    if (!next) return null
    current = next
  }
  return current
}

interface PendingNode {
  node: MindMapNodeTree
  depth: number
}

function collectProjection(
  root: MindMapNodeTree,
  view: "outline" | "subtree",
  limit: number
): string[] {
  const lines: string[] = []
  const pending: PendingNode[] = [{ node: root, depth: 0 }]
  while (pending.length > 0 && lines.length < limit) {
    const current = pending.pop()
    if (!current) break

    const rootLike = current.depth === 0
    const include =
      view === "subtree" || rootLike || isModule(current.node) || priority(current.node) !== null
    if (include) {
      const label =
        rootLike && view === "outline" ? `# ${getText(current.node)}` : formatNode(current.node)
      lines.push(`${"  ".repeat(current.depth)}${label}`)
    }

    if (view === "outline" && priority(current.node) !== null) continue
    for (let index = current.node.children.length - 1; index >= 0; index -= 1) {
      const child = current.node.children[index]
      pending.push({ node: child, depth: current.depth + 1 })
    }
  }
  return lines
}

export function projectTestDocument(options: ProjectionOptions): TestDocumentProjection {
  const selected = options.path?.length ? findByPath(options.root, options.path) : options.root
  if (!selected) {
    return { content: "", lineCount: 0, truncated: false }
  }

  const lines = collectProjection(selected, options.view, options.maxLines + 1)
  const truncated = lines.length > options.maxLines
  const visible = truncated ? lines.slice(0, options.maxLines) : lines
  return {
    content: visible.map((line, index) => `${index + 1}: ${line}`).join("\n"),
    lineCount: visible.length,
    truncated,
  }
}
