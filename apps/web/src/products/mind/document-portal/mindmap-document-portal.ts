import type MindMap from "simple-mind-map"
import type { MindMapNodeTree } from "simple-mind-map"
import { MAX_NODE_COUNT } from "@zoeymind/shared"
import {
  PROJECT_SESSION_LIFECYCLE,
  projectSessionRegistry,
  type ProjectSessionRegistry,
  type ProjectSessionState,
} from "@/products/mind/editor-session"
import { useTabs, type OpenTab, type TabId } from "@/shared/tabs/store"
import {
  DOCUMENT_PORTAL_ERROR_CODE,
  DocumentPortalError,
  type DocumentEditDiagnostic,
  type DocumentEditRequest,
  type DocumentEditEffect,
  type DocumentIntentOperation,
  type DocumentTransformField,
  type DocumentEditResult,
  type DocumentPortal,
  type DocumentReadRequest,
  type DocumentReadResult,
  type DocumentSearchField,
  type DocumentSearchHit,
  type DocumentSearchRequest,
  type DocumentSearchResult,
} from "./document-portal"
import {
  countParsedNodes,
  explainInvalidTreeHashlinePatch,
  parseIntentTree,
  parseProjectedTreeNode,
  parseTreeHashlinePatch,
  type ParsedTreeNode,
  type TreePatchOperation,
} from "./patch/tree-hashline-patch"
import { projectTestDocument } from "./test-document-projector"
const DEFAULT_READ_MAX_LINES = 200
const MAX_READ_LINES = 1_000
const DEFAULT_SEARCH_LIMIT = 50

const ANCHOR_TTL_MS = 5 * 60 * 1_000

interface ReadSnapshot {
  documentId: string
  mindMap: MindMap
  expiresAt: number
  root: MindMapNodeTree
  lines: Map<number, string>
  revision: number
  incompleteUids: Set<string>
}

interface LiveMindMapNode {
  getData: (key: string) => unknown
  nodeData: MindMapNodeTree
}

interface PlannedNode {
  uid: string
  text: string
  icon: string[]
  parent: PlannedNode | null
  children: PlannedNode[]
  live: LiveMindMapNode | null
  data: MindMapNodeTree
}

interface CompiledOperation {
  operation: TreePatchOperation
  target: PlannedNode
  destination?: PlannedNode
}

type ReadyDocumentState = ProjectSessionState & {
  lifecycle: typeof PROJECT_SESSION_LIFECYCLE.READY
  mindMap: MindMap
}
function isLiveMindMapNode(value: unknown): value is LiveMindMapNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "getData" in value &&
    typeof value.getData === "function" &&
    "nodeData" in value
  )
}

function contentHash(value: string): string {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1)
    hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619)
  return (hash >>> 0).toString(36)
}

function getText(node: MindMapNodeTree): string {
  return typeof node.data.text === "string" ? node.data.text.trim() : ""
}

function toPlan(node: MindMapNodeTree, parent: PlannedNode | null, mindMap: MindMap): PlannedNode {
  const uid = node.data.uid
  const live = typeof uid === "string" ? mindMap.renderer?.findNodeByUid(uid) : null
  const planned: PlannedNode = {
    uid: typeof uid === "string" ? uid : "",
    text: getText(node),
    icon: getIcons(node),
    parent,
    children: [],
    live: isLiveMindMapNode(live) ? live : null,
    data: node,
  }
  planned.children = node.children.map(child => toPlan(child, planned, mindMap))
  return planned
}

function findPlanNode(node: PlannedNode, uid: string): PlannedNode | null {
  if (node.uid === uid) return node
  for (const child of node.children) {
    const found = findPlanNode(child, uid)
    if (found) return found
  }
  return null
}
function sameNodeData(left: MindMapNodeTree, right: MindMapNodeTree): boolean {
  return JSON.stringify(left.data) === JSON.stringify(right.data)
}

function sameServedSubtree(
  live: MindMapNodeTree,
  snapshot: MindMapNodeTree,
  incompleteUids: ReadonlySet<string>
): boolean {
  if (!sameNodeData(live, snapshot)) return false
  const incomplete = incompleteUids.has(String(snapshot.data.uid))
  if (
    incomplete
      ? live.children.length < snapshot.children.length
      : live.children.length !== snapshot.children.length
  )
    return false
  return snapshot.children.every((child, index) =>
    sameServedSubtree(live.children[index]!, child, incompleteUids)
  )
}

function containsIncompleteSnapshotNode(
  node: MindMapNodeTree,
  incompleteUids: ReadonlySet<string>
): boolean {
  return (
    incompleteUids.has(String(node.data.uid)) ||
    node.children.some(child => containsIncompleteSnapshotNode(child, incompleteUids))
  )
}

function sameParentOrder(liveRoot: MindMapNodeTree, snapshot: ReadSnapshot, uid: string): boolean {
  const liveParent = findDataNode(liveRoot, uid)?.parent
  const snapshotParent = findDataNode(snapshot.root, uid)?.parent
  if (!liveParent || !snapshotParent) return liveParent === snapshotParent
  const liveOrder = liveParent.children.map(child => child.data.uid)
  const snapshotOrder = snapshotParent.children.map(child => child.data.uid)
  return (
    liveParent.data.uid === snapshotParent.data.uid &&
    (snapshot.incompleteUids.has(String(snapshotParent.data.uid))
      ? snapshotOrder.every((childUid, index) => liveOrder[index] === childUid)
      : JSON.stringify(liveOrder) === JSON.stringify(snapshotOrder))
  )
}

function assertCurrentIntentTarget(
  operation: DocumentIntentOperation,
  liveRoot: MindMapNodeTree,
  snapshot: ReadSnapshot,
  target: PlannedNode,
  destination: PlannedNode | undefined,
  currentRevision: number
): void {
  const snapshotTarget = findDataNode(snapshot.root, target.uid)?.node
  if (!snapshotTarget)
    throw new DocumentPortalError(
      DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
      "The anchored target is not present in its read snapshot"
    )
  if (
    (operation.op === "delete" || operation.op === "move") &&
    containsIncompleteSnapshotNode(snapshotTarget, snapshot.incompleteUids) &&
    currentRevision !== snapshot.revision
  )
    throw new DocumentPortalError(
      DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
      "The document changed after reading a hidden subtree; query the affected area again"
    )
  if (
    !sameServedSubtree(target.data, snapshotTarget, snapshot.incompleteUids) ||
    ((operation.op === "delete" || operation.op === "move") &&
      !sameParentOrder(liveRoot, snapshot, target.uid))
  )
    throw new DocumentPortalError(
      DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
      "The anchored target changed; query the affected area again and retry"
    )
  if (operation.op === "append_cases") {
    if (snapshot.incompleteUids.has(target.uid))
      throw new DocumentPortalError(
        DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
        "Append requires a complete module view; query that module as a subtree and retry"
      )
  }
  if (
    operation.op === "replace_text" &&
    (operation.fields.includes("operation") || operation.fields.includes("expected")) &&
    snapshot.incompleteUids.has(target.uid)
  )
    throw new DocumentPortalError(
      DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
      "Step-field replacement requires a complete module subtree"
    )
  if (operation.op !== "move" || !destination) return
  const snapshotDestination = findDataNode(snapshot.root, destination.uid)?.node
  const destinationCurrent =
    snapshotDestination && sameNodeData(destination.data, snapshotDestination)
  const placementCurrent =
    operation.position === "last-child"
      ? snapshotDestination &&
        !snapshot.incompleteUids.has(destination.uid) &&
        JSON.stringify(destination.data.children.map(child => child.data.uid)) ===
          JSON.stringify(snapshotDestination.children.map(child => child.data.uid))
      : sameParentOrder(liveRoot, snapshot, destination.uid)
  if (!destinationCurrent || !placementCurrent)
    throw new DocumentPortalError(
      DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
      "The move destination changed; query the affected area again and retry"
    )
}

function replaceLiteral(
  value: string,
  find: string,
  replacement: string
): { value: string; count: number } {
  let count = 0
  let offset = 0
  let result = ""
  while (true) {
    const index = value.indexOf(find, offset)
    if (index === -1) break
    result += value.slice(offset, index) + replacement
    offset = index + find.length
    count += 1
  }
  return { value: count === 0 ? value : result + value.slice(offset), count }
}

function transformNodeText(
  node: PlannedNode,
  fields: ReadonlySet<DocumentTransformField>,
  find: string,
  replacement: string
): { text: string; matches: number } {
  if (getNodeType(node) === "module") return { text: node.text, matches: 0 }
  const separator = node.text.indexOf("&")
  if (separator === -1) return { text: node.text, matches: 0 }
  const leftField = getNodeType(node) === "case" ? "caseTitle" : "operation"
  const rightField = getNodeType(node) === "case" ? "precondition" : "expected"
  const left = fields.has(leftField)
    ? replaceLiteral(node.text.slice(0, separator), find, replacement)
    : { value: node.text.slice(0, separator), count: 0 }
  const right = fields.has(rightField)
    ? replaceLiteral(node.text.slice(separator + 1), find, replacement)
    : { value: node.text.slice(separator + 1), count: 0 }
  return { text: `${left.value}&${right.value}`, matches: left.count + right.count }
}

function collectPlanNodes(root: PlannedNode): PlannedNode[] {
  return [root, ...root.children.flatMap(collectPlanNodes)]
}

function sameNodeKind(node: PlannedNode, replacement: ParsedTreeNode): boolean {
  const replacementType = replacement.icon?.includes("sign_2")
    ? "module"
    : replacement.icon?.some(icon => icon.startsWith("priority_"))
      ? "case"
      : "step"
  return replacementType === getNodeType(node)
}

function compileIntentOperations(
  intents: readonly DocumentIntentOperation[],
  byLine: ReadonlyMap<number, PlannedNode>
): { operations: TreePatchOperation[]; effects: DocumentEditEffect[] } {
  const operations: TreePatchOperation[] = []
  const effects: DocumentEditEffect[] = []
  const claimed: Array<{
    node: PlannedNode
    operation: number
    kind: "write" | "destructive" | "reference"
  }> = []
  const claim = (
    node: PlannedNode,
    operation: number,
    kind: "write" | "destructive" | "reference" = "write"
  ) => {
    if (
      claimed.some(existing => {
        if (existing.operation === operation) return false
        const destructive = existing.kind === "destructive" || kind === "destructive"
        if (existing.node === node)
          return destructive || (existing.kind !== "reference" && kind !== "reference")
        return (
          destructive && (isDescendant(existing.node, node) || isDescendant(node, existing.node))
        )
      })
    )
      throw new DocumentPortalError(
        DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
        "Intent operations overlap on the same subtree"
      )
    claimed.push({ node, operation, kind })
  }
  intents.forEach((intent, index) => {
    const target = byLine.get(
      intent.op === "append_cases"
        ? intent.to
        : intent.op === "replace_text"
          ? intent.within
          : intent.at
    )
    if (!target)
      throw new DocumentPortalError(
        DOCUMENT_PORTAL_ERROR_CODE.ANCHOR_EXPIRED,
        "Intent operation references a line outside the anchored view"
      )
    const servedUids = new Set(Array.from(byLine.values(), node => node.uid))
    if (intent.op === "append_cases") {
      if (getNodeType(target) !== "module")
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
          "append_cases target must be a module"
        )
      const nodes = parseIntentTree(intent.tree)
      if (
        !nodes ||
        nodes.some(node => !(node.icon ?? []).some(icon => icon.startsWith("priority_")))
      )
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
          "append_cases tree must contain only case roots with two-space-indented steps"
        )
      operations.push({ kind: "append-child", start: intent.to, nodes, targetUid: target.uid })
      claim(target, index)
      effects.push({ operation: index, nodes: countParsedNodes(nodes), cases: nodes.length })
      return
    }
    if (intent.op === "replace_text") {
      if (getNodeType(target) !== "module")
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
          "replace_text scope must be a module"
        )
      if (
        !intent.find ||
        intent.find.includes("&") ||
        intent.find.includes("\n") ||
        intent.replace.includes("&") ||
        intent.replace.includes("\n")
      )
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
          "replace_text find and replace must be single-field literal text"
        )
      const fields = new Set(intent.fields)
      let matches = 0
      let changed = 0
      for (const node of collectPlanNodes(target).filter(node => servedUids.has(node.uid))) {
        const transformed = transformNodeText(node, fields, intent.find, intent.replace)
        matches += transformed.matches
        if (transformed.matches === 0) continue
        claim(node, index)
        changed += 1
        operations.push({
          kind: "put",
          start: intent.within,
          targetUid: node.uid,
          nodes: [{ text: transformed.text, icon: node.icon, children: [] }],
        })
      }
      if (matches !== intent.expect)
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.TRANSFORM_COUNT_MISMATCH,
          `replace_text expected ${intent.expect} occurrences but found ${matches}`
        )
      effects.push({ operation: index, nodes: changed, matches })
      return
    }
    claim(target, index, intent.op === "delete" || intent.op === "move" ? "destructive" : "write")
    if (intent.op === "set_node") {
      const node = parseProjectedTreeNode(intent.value)
      if (!node || !sameNodeKind(target, node))
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
          "set_node value must be one row of the target's existing node type"
        )
      operations.push({ kind: "put", start: intent.at, targetUid: target.uid, nodes: [node] })
      effects.push({ operation: index, nodes: 1 })
      return
    }
    if (intent.op === "delete") {
      operations.push({ kind: "cut", start: intent.at, targetUid: target.uid })
      effects.push({ operation: index, removed: countPlanNodes(target) })
      return
    }
    const destination = byLine.get(intent.to)
    if (!destination)
      throw new DocumentPortalError(
        DOCUMENT_PORTAL_ERROR_CODE.ANCHOR_EXPIRED,
        "Move destination is outside the anchored view"
      )
    claim(destination, index, "reference")
    operations.push({
      kind: "move",
      start: intent.at,
      destination: intent.to,
      destinationPosition: intent.position,
      targetUid: target.uid,
      destinationUid: destination.uid,
    })
    effects.push({ operation: index, nodes: countPlanNodes(target) })
  })
  return { operations, effects }
}

async function executeDataTreePatch(
  mindMap: MindMap,
  apply: (root: MindMapNodeTree) => void
): Promise<void> {
  if (typeof mindMap.render !== "function") {
    mindMap.execCommand("PATCH_NODE_DATA_TREE", apply)
    return
  }
  await new Promise<void>((resolve, reject) => {
    const onRenderEnd = () => {
      mindMap.off("node_tree_render_end", onRenderEnd)
      resolve()
    }
    mindMap.on("node_tree_render_end", onRenderEnd)
    try {
      mindMap.execCommand("PATCH_NODE_DATA_TREE", apply)
    } catch (error) {
      mindMap.off("node_tree_render_end", onRenderEnd)
      reject(error)
    }
  })
}

function isDescendant(node: PlannedNode, possibleAncestor: PlannedNode): boolean {
  let current: PlannedNode | null = node.parent
  while (current) {
    if (current === possibleAncestor) return true
    current = current.parent
  }
  return false
}

function countPlanNodes(node: PlannedNode): number {
  return 1 + node.children.reduce((count, child) => count + countPlanNodes(child), 0)
}

function lastDescendant(node: PlannedNode): PlannedNode {
  let current = node
  while (current.children.length > 0) current = current.children[current.children.length - 1]!
  return current
}

function commonPath(paths: readonly string[][]): string[] {
  if (paths.length === 0) return []
  const first = paths[0]!
  let length = 0
  while (
    length < first.length &&
    paths.every(path => path.length > length && path[length] === first[length])
  )
    length += 1
  return first.slice(0, length)
}
function postEditFocusUids(compiled: readonly CompiledOperation[]): string[] {
  const uids: string[] = []
  for (const { operation, target } of compiled) {
    if (isRootContentReplacement(operation, target)) {
      for (const child of operation.nodes?.[0]?.children ?? []) if (child.uid) uids.push(child.uid)
    } else if (operation.kind === "insert-before" || operation.kind === "insert-after") {
      for (const node of operation.nodes ?? []) if (node.uid) uids.push(node.uid)
    } else if (operation.kind === "move" || operation.kind === "put") {
      uids.push(target.uid)
      if (operation.kind === "put")
        for (const node of operation.nodes?.slice(1) ?? []) if (node.uid) uids.push(node.uid)
    }
  }
  return [...new Set(uids)]
}

interface FocusableMindMapNode {
  getData: (key: string) => unknown
}

async function focusRenderedNodes(mindMap: MindMap, uids: readonly string[]): Promise<void> {
  if (uids.length === 0) return
  const renderer = mindMap.renderer as typeof mindMap.renderer & {
    activeNodeList?: FocusableMindMapNode[]
    addNodeToActiveList?: (node: FocusableMindMapNode, silent: boolean) => void
    emitNodeActiveEvent?: (node: FocusableMindMapNode, nodes: FocusableMindMapNode[]) => void
    moveNodeToCenter?: (node: FocusableMindMapNode) => void
    goTargetNode?: (uid: string, callback: () => void) => void
  }
  const nodes = uids
    .map(uid => renderer.findNodeByUid(uid) as FocusableMindMapNode | null | undefined)
    .filter((node): node is FocusableMindMapNode => node != null)
  if (
    nodes.length > 0 &&
    renderer.addNodeToActiveList &&
    renderer.emitNodeActiveEvent &&
    renderer.moveNodeToCenter
  ) {
    // 累积当前 AI 会话内多次 edit 的高亮：不清空既有 activeNodeList，
    // 让批量编辑的所有目标节点同时呈激活态；后续用户点击会通过
    // simple-mind-map 内建的 clearActiveNodeList 自然重置。
    const wasEmpty = (renderer.activeNodeList?.length ?? 0) === 0
    for (const node of nodes) renderer.addNodeToActiveList(node, true)
    const activeList = (renderer.activeNodeList ?? nodes) as FocusableMindMapNode[]
    renderer.emitNodeActiveEvent(nodes[0]!, activeList)
    // 只有在批次首个编辑（先前无任何激活节点）时把视口带到目标；后续同批次
    // edit 保持用户当前视口，避免视口反复跳走导致先前节点滚出可视区。
    if (wasEmpty) renderer.moveNodeToCenter(nodes[0]!)
    return
  }
  if (renderer.goTargetNode)
    await new Promise<void>(resolve => renderer.goTargetNode!(uids[0]!, resolve))
}

function postEditPath(compiled: readonly CompiledOperation[]): string[] {
  return commonPath(
    compiled.map(({ operation, target, destination }) => {
      if (isRootContentReplacement(operation, target)) return []
      if (operation.kind === "move" && destination) return getPublicPath(destination)
      return target.parent ? getPublicPath(target.parent) : []
    })
  )
}
function isRootContentReplacement(operation: TreePatchOperation, target: PlannedNode): boolean {
  const replacement = operation.nodes
  return (
    operation.kind === "put" &&
    target.parent === null &&
    replacement?.length === 1 &&
    !replacement[0]?.icon?.length
  )
}

function getNodeType(node: PlannedNode): "module" | "case" | "step" {
  if (node.icon.includes("sign_2")) return "module"
  return node.icon.some(icon => icon.startsWith("priority_")) ? "case" : "step"
}

function getPublicPath(node: PlannedNode): string[] {
  const path: string[] = []
  for (let current: PlannedNode | null = node; current?.parent; current = current.parent)
    path.push(current.text)
  return path.reverse()
}

function collectAffectedNodes(
  node: PlannedNode,
  depth: number,
  affectedNodes: Array<{
    path: string[]
    type: "module" | "case" | "step"
    text: string
    depth: number
    count: number
  }>
): void {
  affectedNodes.push({
    path: getPublicPath(node),
    type: getNodeType(node),
    text: node.text,
    depth,
    count: countPlanNodes(node),
  })
  for (const child of node.children) collectAffectedNodes(child, depth + 1, affectedNodes)
}

function isAdditiveEmptyNodeCompletion(
  operation: TreePatchOperation,
  target: PlannedNode
): boolean {
  if (operation.kind !== "put" || operation.nodes?.length !== 1 || target.children.length !== 0)
    return false
  const replacement = operation.nodes[0]!
  const replacementIcons = replacement.icon ?? []
  return (
    replacement.text === target.text &&
    replacementIcons.length === target.icon.length &&
    replacementIcons.every(icon => target.icon.includes(icon)) &&
    replacement.children.length > 0
  )
}

function validateTreeChildren(parent: PlannedNode, nodes: readonly ParsedTreeNode[]): void {
  const parentIsRoot = parent.parent === null
  const parentIsModule = parent.icon.includes("sign_2")
  const parentIsCase = parent.icon.some(icon => icon.startsWith("priority_"))
  const existingModuleChild = parent.children.some(child => child.icon.includes("sign_2"))
  const existingCaseChild = parent.children.some(child =>
    child.icon.some(icon => icon.startsWith("priority_"))
  )
  for (const node of nodes) {
    const isModuleNode = node.icon?.includes("sign_2") ?? false
    const isCaseNode = node.icon?.some(icon => icon.startsWith("priority_")) ?? false
    if (
      (parentIsRoot && !isModuleNode) ||
      (parentIsModule && !isModuleNode && !isCaseNode) ||
      (parentIsModule && isModuleNode && existingCaseChild) ||
      (parentIsModule && isCaseNode && existingModuleChild) ||
      (parentIsCase && (isModuleNode || isCaseNode)) ||
      (!parentIsRoot && !parentIsModule && !parentIsCase)
    )
      throw new DocumentPortalError(
        DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
        parentIsCase && isCaseNode
          ? "PUT >N inserts a sibling of line N. The selected line is a step, so a case row would become its child. Anchor an existing case line under the same module instead."
          : "Patch violates Test Document parent-child rules"
      )
    validateParsedSubtree(node)
  }
}
function validateParsedSubtree(node: ParsedTreeNode): void {
  const isModuleNode = node.icon?.includes("sign_2") ?? false
  const isCaseNode = node.icon?.some(icon => icon.startsWith("priority_")) ?? false
  const hasModuleChildren = node.children.some(child => child.icon?.includes("sign_2"))
  const hasCaseChildren = node.children.some(child =>
    child.icon?.some(icon => icon.startsWith("priority_"))
  )
  if (isModuleNode && hasModuleChildren && hasCaseChildren)
    throw new DocumentPortalError(
      DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
      "A module cannot mix child modules and test cases"
    )
  for (const child of node.children) {
    const childModule = child.icon?.includes("sign_2") ?? false
    const childCase = child.icon?.some(icon => icon.startsWith("priority_")) ?? false
    if (
      (isModuleNode && !childModule && !childCase) ||
      (isCaseNode && (childModule || childCase)) ||
      (!isModuleNode && !isCaseNode)
    )
      throw new DocumentPortalError(
        DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
        "Patch violates Test Document parent-child rules"
      )
    validateParsedSubtree(child)
  }
}

function assignParsedNodeUids(nodes: readonly ParsedTreeNode[], affectedUids: Set<string>): void {
  for (const node of nodes) {
    node.uid ??= crypto.randomUUID()
    affectedUids.add(node.uid)
    assignParsedNodeUids(node.children, affectedUids)
  }
}

function lintAffectedNodes(
  root: MindMapNodeTree,
  affectedUids: ReadonlySet<string>
): Array<Omit<DocumentEditDiagnostic, "line" | "repairPatchHint"> & { uid: string }> {
  const diagnostics: Array<
    Omit<DocumentEditDiagnostic, "line" | "repairPatchHint"> & { uid: string }
  > = []
  const visit = (node: MindMapNodeTree, path: string[]): void => {
    const text = getText(node)
    const currentPath = node === root ? [] : [...path, text]
    if (affectedUids.has(String(node.data.uid)) && isCase(node)) {
      if (node.children.length === 0)
        diagnostics.push({
          severity: "warning",
          code: "CASE_HAS_NO_STEPS",
          uid: String(node.data.uid),
          path: currentPath,
          message: `测试用例“${text}”没有步骤，当前内容已作为草稿保存`,
        })
      for (const child of node.children) {
        const [operation, expected] = getText(child)
          .split("&", 2)
          .map(part => part.trim())
        if (!operation || !expected)
          diagnostics.push({
            severity: "warning",
            code: "STEP_HAS_NO_EXPECTED_RESULT",
            uid: String(child.data.uid),
            path: [...currentPath, getText(child)],
            message: `步骤“${getText(child)}”缺少非空的操作或预期结果，当前内容已作为草稿保存`,
          })
      }
    }
    for (const child of node.children) visit(child, currentPath)
  }
  visit(root, [])
  return diagnostics
}

function parsedNodesToData(nodes: readonly ParsedTreeNode[]): MindMapNodeTree[] {
  return nodes.map(node => ({
    data: {
      text: node.text,
      ...(node.icon ? { icon: node.icon } : {}),
      uid: node.uid ?? crypto.randomUUID(),
    },
    children: parsedNodesToData(node.children),
  }))
}
function findDataNode(
  root: MindMapNodeTree,
  uid: string,
  parent: MindMapNodeTree | null = null
): { node: MindMapNodeTree; parent: MindMapNodeTree | null } | null {
  if (root.data.uid === uid) return { node: root, parent }
  for (const child of root.children) {
    const found = findDataNode(child, uid, root)
    if (found) return found
  }
  return null
}

function applyCompiledOperationsToData(
  root: MindMapNodeTree,
  compiled: readonly CompiledOperation[]
): void {
  for (const { operation, target, destination } of compiled) {
    const resolved = findDataNode(root, target.uid)
    if (!resolved) throw new Error("Patch target is detached from the document data tree")
    if (isRootContentReplacement(operation, target)) {
      const replacement = operation.nodes![0]!
      resolved.node.data.text = replacement.text
      resolved.node.children = parsedNodesToData(replacement.children)
      continue
    }
    if (
      operation.kind === "put" &&
      operation.nodes?.length === 1 &&
      operation.nodes[0]?.children.length === 0
    ) {
      resolved.node.data.text = operation.nodes[0].text
      if (operation.nodes[0].icon) resolved.node.data.icon = [...operation.nodes[0].icon]
      else delete resolved.node.data.icon
      continue
    }
    if (operation.kind === "append-child") {
      resolved.node.children.push(...parsedNodesToData(operation.nodes!))
      continue
    }
    if (!resolved.parent) throw new Error("Patch operation requires a parent data node")
    const targetIndex = resolved.parent.children.indexOf(resolved.node)
    if (operation.kind === "put") {
      const replacement = parsedNodesToData(operation.nodes!)
      replacement[0]!.data.uid = target.uid
      resolved.parent.children.splice(targetIndex, 1, ...replacement)
    } else if (operation.kind === "cut") {
      resolved.parent.children.splice(targetIndex, 1)
    } else if (operation.kind === "insert-before") {
      resolved.parent.children.splice(targetIndex, 0, ...parsedNodesToData(operation.nodes!))
    } else if (operation.kind === "insert-after") {
      resolved.parent.children.splice(targetIndex + 1, 0, ...parsedNodesToData(operation.nodes!))
    } else if (operation.kind === "move") {
      if (!destination) throw new Error("Move operation requires a destination data node")
      const resolvedDestination = findDataNode(root, destination.uid)
      if (!resolvedDestination) throw new Error("Move destination is detached from the data tree")
      resolved.parent.children.splice(targetIndex, 1)
      if (operation.destinationPosition === "last-child") {
        resolvedDestination.node.children.push(resolved.node)
      } else {
        if (!resolvedDestination.parent)
          throw new Error("Sibling move destination requires a parent data node")
        const destinationIndex = resolvedDestination.parent.children.indexOf(
          resolvedDestination.node
        )
        resolvedDestination.parent.children.splice(
          destinationIndex + (operation.destinationPosition === "after" ? 1 : 0),
          0,
          resolved.node
        )
      }
    }
  }
}
function getIcons(node: MindMapNodeTree): string[] {
  return Array.isArray(node.data.icon)
    ? node.data.icon.filter((icon): icon is string => typeof icon === "string")
    : []
}

function normalizePublicPath(root: MindMapNodeTree, path: readonly string[] | undefined): string[] {
  if (!path?.length) return []
  const normalized = path.filter(segment => segment !== "/")
  return normalized[0] === getText(root) ? normalized.slice(1) : normalized
}

function isModule(node: MindMapNodeTree): boolean {
  return getIcons(node).includes("sign_2")
}

function isCase(node: MindMapNodeTree): boolean {
  return getIcons(node).some(icon => icon.startsWith("priority_"))
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

function textParts(text: string): [string, string] {
  const separator = text.indexOf("&")
  return separator === -1
    ? [text.trim(), ""]
    : [text.slice(0, separator).trim(), text.slice(separator + 1).trim()]
}

function appendMatch(
  hits: DocumentSearchHit[],
  query: string,
  fields: ReadonlySet<DocumentSearchField>,
  field: DocumentSearchField,
  text: string,
  modulePath: string[],
  readPath: string[]
) {
  if (fields.has(field) && text.toLocaleLowerCase().includes(query)) {
    hits.push({ modulePath, readPath, field })
  }
}

function collectSearchHits(
  root: MindMapNodeTree,
  query: string,
  fields: ReadonlySet<DocumentSearchField>,
  initialPath: string[],
  initialModules: string[]
): DocumentSearchHit[] {
  const hits: DocumentSearchHit[] = []
  const pending: Array<{ node: MindMapNodeTree; path: string[]; modules: string[] }> = [
    { node: root, path: initialPath, modules: initialModules },
  ]
  while (pending.length > 0) {
    const current = pending.pop()
    if (!current) break
    const text = getText(current.node)
    const path = current.path.length === 0 ? current.path : current.path
    const modulePath = isModule(current.node) ? [...current.modules, text] : current.modules
    if (isModule(current.node)) {
      appendMatch(hits, query, fields, "module", text, modulePath, path)
    } else if (isCase(current.node)) {
      const [title, precondition] = textParts(text)
      appendMatch(hits, query, fields, "caseTitle", title, modulePath, path)
      appendMatch(hits, query, fields, "precondition", precondition, modulePath, path)
    } else if (current.modules.length > 0) {
      const [operation, expected] = textParts(text)
      appendMatch(hits, query, fields, "operation", operation, modulePath, path)
      appendMatch(hits, query, fields, "expected", expected, modulePath, path)
    }
    for (let index = current.node.children.length - 1; index >= 0; index -= 1) {
      const child = current.node.children[index]
      pending.push({
        node: child,
        path: [...path, getText(child)],
        modules: modulePath,
      })
    }
  }
  return hits
}

interface TabsSnapshot {
  tabs: OpenTab[]
  activeId: TabId
}

interface MindMapDocumentPortalDependencies {
  registry?: ProjectSessionRegistry
  getTabs?: () => TabsSnapshot
}
export function createMindMapDocumentPortal(
  dependencies: MindMapDocumentPortalDependencies = {}
): DocumentPortal {
  const registry = dependencies.registry ?? projectSessionRegistry
  const getTabs =
    dependencies.getTabs ??
    (() => {
      const state = useTabs.getState()
      return { tabs: state.tabs, activeId: state.activeId }
    })
  const readSnapshots = new Map<string, ReadSnapshot>()
  const documentQueues = new Map<string, Promise<void>>()
  const destructivePreviews = new Map<
    string,
    {
      documentId: string
      anchorTag: string
      patch?: string
      operations?: DocumentIntentOperation[]
      fingerprint: string
      expiresAt: number
    }
  >()

  const enqueue = <Result>(documentId: string, task: () => Promise<Result>): Promise<Result> => {
    const previous = documentQueues.get(documentId) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(task)
    documentQueues.set(
      documentId,
      next.then(
        () => undefined,
        () => undefined
      )
    )
    return next
  }

  const registerReadSnapshot = (
    documentId: string,
    mindMap: MindMap,
    root: MindMapNodeTree,
    request: DocumentReadRequest,
    maxLines: number
  ): ReadSnapshot => {
    const lines = new Map<number, string>()
    const incompleteUids = new Set<string>()
    const selected = request.path?.length ? findByPath(root, request.path) : root
    if (!selected) throw new Error("Read snapshot target is missing after successful projection")
    const expiresAt = Date.now() + ANCHOR_TTL_MS
    const snapshotRoot: MindMapNodeTree = {
      data: structuredClone(selected.data),
      children: [],
    }
    const pending: Array<{
      node: MindMapNodeTree
      parent: MindMapNodeTree | null
      clone?: MindMapNodeTree
    }> = [{ node: selected, parent: null, clone: snapshotRoot }]
    let line = 0
    while (pending.length > 0 && line < maxLines) {
      const current = pending.pop()
      if (!current) break
      const clone = current.clone ?? {
        data: structuredClone(current.node.data),
        children: [],
      }
      if (current.parent) current.parent.children.push(clone)
      line += 1
      const uid = current.node.data.uid
      if (typeof uid === "string") lines.set(line, uid)
      if (request.view === "outline" && isCase(current.node)) {
        if (current.node.children.length > 0 && typeof uid === "string") incompleteUids.add(uid)
        continue
      }
      for (let index = current.node.children.length - 1; index >= 0; index -= 1)
        pending.push({ node: current.node.children[index]!, parent: clone })
    }
    for (const item of pending) {
      const parentUid = item.parent?.data.uid
      if (typeof parentUid === "string") incompleteUids.add(parentUid)
    }
    return {
      documentId,
      mindMap,
      expiresAt,
      root: snapshotRoot,
      lines,
      revision: getDocumentRevision(mindMap),
      incompleteUids,
    }
  }
  const getReadyState = (documentId: string): ReadyDocumentState => {
    const { tabs } = getTabs()
    if (!tabs.some(tab => tab.id === documentId))
      throw new DocumentPortalError(
        DOCUMENT_PORTAL_ERROR_CODE.NOT_OPEN,
        `Document is not open: ${documentId}`
      )
    const state = registry.get(documentId)?.getState()
    if (!state || state.lifecycle !== PROJECT_SESSION_LIFECYCLE.READY || state.mindMap === null)
      throw new DocumentPortalError(
        DOCUMENT_PORTAL_ERROR_CODE.NOT_READY,
        `Document is not ready: ${documentId}`
      )
    return { ...state, lifecycle: PROJECT_SESSION_LIFECYCLE.READY, mindMap: state.mindMap }
  }

  return {
    listDocuments() {
      const { tabs, activeId } = getTabs()
      return tabs.map(tab => {
        const state = registry.get(tab.id)?.getState()
        return {
          documentId: tab.id,
          title: state?.title ?? tab.title,
          active: activeId === tab.id,
          revision: getDocumentRevision(state?.mindMap ?? null),
          ready: state?.lifecycle === PROJECT_SESSION_LIFECYCLE.READY && state.mindMap !== null,
          dirty: state?.dirty ?? false,
        }
      })
    },
    read(request: DocumentReadRequest): DocumentReadResult {
      const state = getReadyState(request.documentId)
      const maxLines = request.maxLines ?? DEFAULT_READ_MAX_LINES
      if (!Number.isInteger(maxLines) || maxLines < 1 || maxLines > MAX_READ_LINES)
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.INVALID_READ_LIMIT,
          `Document read maxLines must be between 1 and ${MAX_READ_LINES}`
        )
      const root = state.mindMap.getData() as MindMapNodeTree
      const path = normalizePublicPath(root, request.path)
      const projection = projectTestDocument({
        root,
        view: request.view,
        path,
        maxLines,
      })
      if (path.length > 0 && projection.lineCount === 0)
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.PATH_NOT_FOUND,
          `Document path was not found: ${path.join(" / ")}`
        )
      const anchorTag = crypto.randomUUID()
      readSnapshots.set(
        anchorTag,
        registerReadSnapshot(
          request.documentId,
          state.mindMap,
          root,
          { ...request, path },
          maxLines
        )
      )
      return {
        documentId: request.documentId,
        title:
          state.title ?? getTabs().tabs.find(tab => tab.id === request.documentId)?.title ?? "",
        revision: getDocumentRevision(state.mindMap),
        view: request.view,
        ...(path.length ? { path } : {}),
        ...projection,
        anchorTag,
        completeness: request.view === "subtree" ? "complete" : "structure-only",
        canReplaceCompleteSubtree: request.view === "subtree" && !projection.truncated,
      }
    },
    search(request: DocumentSearchRequest): DocumentSearchResult {
      const state = getReadyState(request.documentId)
      const query = request.query.trim()
      if (!query)
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.INVALID_SEARCH_QUERY,
          "Document search query must not be empty"
        )
      const limit = request.limit ?? DEFAULT_SEARCH_LIMIT
      if (!Number.isInteger(limit) || limit < 1 || limit > 1_000)
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.INVALID_SEARCH_LIMIT,
          "Document search limit must be an integer between 1 and 1000"
        )
      const offset = request.cursor === undefined ? 0 : Number(request.cursor)
      if (!Number.isInteger(offset) || offset < 0)
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.INVALID_SEARCH_CURSOR,
          "Document search cursor must be a nonnegative integer"
        )
      const root = state.mindMap.getData() as MindMapNodeTree
      const scope = normalizePublicPath(root, request.scope)
      const selected = scope.length === 0 ? root : findByPath(root, scope)
      if (!selected)
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.PATH_NOT_FOUND,
          `Document path was not found: ${scope.join(" / ")}`
        )
      const fields = new Set<DocumentSearchField>(
        request.fields ?? ["module", "caseTitle", "precondition", "operation", "expected"]
      )
      const matches = collectSearchHits(
        selected,
        query.toLocaleLowerCase(),
        fields,
        scope,
        isModule(selected) ? scope.slice(0, -1) : scope
      )
      const hits = matches.slice(offset, offset + limit)
      const truncated = offset + hits.length < matches.length
      return {
        documentId: request.documentId,
        revision: getDocumentRevision(state.mindMap),
        hits,
        total: matches.length,
        returned: hits.length,
        ...(truncated ? { nextCursor: String(offset + hits.length) } : {}),
        truncated,
      }
    },
    edit(inputRequest: DocumentEditRequest): Promise<DocumentEditResult> {
      return enqueue(inputRequest.documentId, async () => {
        const storedConfirmation =
          !inputRequest.preview && inputRequest.confirmationToken
            ? destructivePreviews.get(inputRequest.confirmationToken)
            : undefined
        if (!inputRequest.preview && inputRequest.confirmationToken && !storedConfirmation)
          throw new DocumentPortalError(
            DOCUMENT_PORTAL_ERROR_CODE.PREVIEW_REQUIRED,
            "The destructive edit approval is invalid, expired, or already used"
          )
        if (storedConfirmation && storedConfirmation.expiresAt < Date.now()) {
          destructivePreviews.delete(inputRequest.confirmationToken!)
          throw new DocumentPortalError(
            DOCUMENT_PORTAL_ERROR_CODE.PREVIEW_REQUIRED,
            "The destructive edit approval has expired"
          )
        }
        if (storedConfirmation && storedConfirmation.documentId !== inputRequest.documentId)
          throw new DocumentPortalError(
            DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
            "The active document changed since destructive edit preview"
          )
        const request = storedConfirmation
          ? {
              ...inputRequest,
              anchorTag: storedConfirmation.anchorTag,
              patch: storedConfirmation.patch,
              operations: storedConfirmation.operations,
            }
          : inputRequest
        const hasPatch = typeof request.patch === "string"
        const hasIntents = request.operations !== undefined
        if (
          !request.anchorTag ||
          hasPatch === hasIntents ||
          (hasIntents && request.operations?.length === 0)
        )
          throw new DocumentPortalError(
            DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
            "Document edits require anchorTag and exactly one non-empty patch or operations array"
          )
        const snapshot = readSnapshots.get(request.anchorTag)
        const state = getReadyState(request.documentId)
        const mindMap = state.mindMap
        if (
          !snapshot ||
          snapshot.documentId !== request.documentId ||
          snapshot.mindMap !== mindMap ||
          snapshot.expiresAt < Date.now()
        )
          throw new DocumentPortalError(
            DOCUMENT_PORTAL_ERROR_CODE.ANCHOR_EXPIRED,
            "Document edit anchor has expired; query the affected area again and retry"
          )
        const rawData = mindMap.getData() as MindMapNodeTree | { root?: MindMapNodeTree }
        const rootData =
          "root" in rawData && rawData.root ? rawData.root : (rawData as MindMapNodeTree)
        const root = toPlan(rootData, null, mindMap)
        const byLine = new Map<number, PlannedNode>()
        for (const [line, uid] of snapshot.lines) {
          const node = findPlanNode(root, uid)
          if (node) byLine.set(line, node)
        }
        let effects: DocumentEditEffect[] = []
        let operations: TreePatchOperation[]
        if (request.operations) {
          for (const intent of request.operations) {
            const targetLine =
              intent.op === "append_cases"
                ? intent.to
                : intent.op === "replace_text"
                  ? intent.within
                  : intent.at
            const target = byLine.get(targetLine)
            const destination = intent.op === "move" ? byLine.get(intent.to) : undefined
            if (!target || (intent.op === "move" && !destination))
              throw new DocumentPortalError(
                DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
                "An anchored intent target no longer exists; query the affected area again and retry"
              )
            assertCurrentIntentTarget(
              intent,
              rootData,
              snapshot,
              target,
              destination,
              getDocumentRevision(mindMap)
            )
          }
          const compiledIntents = compileIntentOperations(request.operations, byLine)
          operations = compiledIntents.operations
          effects = compiledIntents.effects
        } else {
          operations = parseTreeHashlinePatch(request.patch!) ?? []
          if (operations.length === 0)
            throw new DocumentPortalError(
              DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
              explainInvalidTreeHashlinePatch(request.patch!)
            )
          for (const operation of operations) {
            for (const line of [operation.start, operation.end, operation.destination]) {
              if (line === undefined) continue
              const node = byLine.get(line)
              const snapshotUid = snapshot.lines.get(line)
              const snapshotNode = snapshotUid
                ? findDataNode(snapshot.root, snapshotUid)?.node
                : undefined
              if (!node || !snapshotNode)
                throw new DocumentPortalError(
                  DOCUMENT_PORTAL_ERROR_CODE.ANCHOR_EXPIRED,
                  "Document edit anchor has expired; query the affected area again and retry"
                )
              if (!sameNodeData(node.data, snapshotNode))
                throw new DocumentPortalError(
                  DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
                  "The anchored node changed; query the affected area again and retry"
                )
            }
          }
        }
        const rangedOperations = operations.filter(
          operation => operation.end !== undefined && operation.end !== operation.start
        )
        const compiled: CompiledOperation[] = operations.map(operation => ({
          operation,
          target: operation.targetUid
            ? findPlanNode(root, operation.targetUid)!
            : byLine.get(operation.start)!,
          ...(operation.destinationUid || operation.destination
            ? {
                destination: operation.destinationUid
                  ? (findPlanNode(root, operation.destinationUid) ?? undefined)
                  : byLine.get(operation.destination!),
              }
            : {}),
        }))
        const affectedUids = new Set<string>()
        for (const { operation } of compiled)
          if (operation.nodes) assignParsedNodeUids(operation.nodes, affectedUids)
        for (const { operation, target } of compiled) {
          if (operation.end === undefined || operation.end === operation.start) continue
          const rangeEnd = byLine.get(operation.end)
          if (!isRootContentReplacement(operation, target) || rangeEnd !== lastDescendant(target))
            throw new DocumentPortalError(
              DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
              "Inclusive ranges can replace only a complete subtree. This view may omit descendants (outline hides steps). Query the same path with mode: subtree and require truncated: false, then replace that complete range."
            )
        }
        if (rangedOperations.some(operation => operation.kind !== "put"))
          throw new DocumentPortalError(
            DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
            "Inclusive CUT ranges are not supported; cut the containing subtree or use separate CUT operations"
          )
        const isStructuralPut = (operation: TreePatchOperation) =>
          operation.kind === "put" &&
          !(operation.nodes?.length === 1 && operation.nodes[0]?.children.length === 0)
        const destructiveTargets = compiled.flatMap(({ operation, target }) =>
          isRootContentReplacement(operation, target)
            ? target.children
            : operation.kind === "cut" || isStructuralPut(operation)
              ? [target]
              : []
        )
        const destructiveOperationTargets = compiled
          .filter(
            ({ operation, target }) =>
              !isAdditiveEmptyNodeCompletion(operation, target) &&
              (operation.kind === "cut" || isStructuralPut(operation))
          )
          .map(({ target }) => target)
        for (let outer = 0; outer < destructiveOperationTargets.length; outer += 1)
          for (let inner = outer + 1; inner < destructiveOperationTargets.length; inner += 1)
            if (
              destructiveOperationTargets[outer] === destructiveOperationTargets[inner] ||
              isDescendant(
                destructiveOperationTargets[outer]!,
                destructiveOperationTargets[inner]!
              ) ||
              isDescendant(destructiveOperationTargets[inner]!, destructiveOperationTargets[outer]!)
            )
              throw new DocumentPortalError(
                DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
                "Patch operations overlap"
              )
        let added = 0
        let removed = 0
        for (const { operation, target, destination } of compiled) {
          const rootContentReplacement = isRootContentReplacement(operation, target)
          if (
            (operation.kind === "cut" || operation.kind === "move" || operation.kind === "put") &&
            target === root &&
            !rootContentReplacement
          )
            throw new DocumentPortalError(
              DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
              "The document root can only be replaced by one untyped root row with its complete child tree"
            )
          if (
            operation.kind === "move" &&
            (!destination || destination === target || isDescendant(destination, target))
          )
            throw new DocumentPortalError(
              DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
              "Cannot move a subtree into itself"
            )
          if (operation.kind === "move" && destination) {
            const destinationParent =
              operation.destinationPosition === "last-child" ? destination : destination.parent
            if (!destinationParent)
              throw new DocumentPortalError(
                DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
                "Sibling move destination requires a parent"
              )
            validateTreeChildren(destinationParent, [
              { text: target.text, icon: target.icon, children: [] },
            ])
          }
          if (operation.nodes) {
            const simpleTextReplacement =
              operation.kind === "put" &&
              operation.nodes.length === 1 &&
              operation.nodes[0]?.children.length === 0
            if (rootContentReplacement) {
              validateTreeChildren(target, operation.nodes[0]!.children)
              added += countParsedNodes(operation.nodes[0]!.children)
            } else if (operation.kind === "append-child") {
              validateTreeChildren(target, operation.nodes)
              added += countParsedNodes(operation.nodes)
            } else if (!simpleTextReplacement) {
              const parent =
                operation.kind === "insert-before" ||
                operation.kind === "insert-after" ||
                operation.kind === "put"
                  ? target.parent
                  : null
              if (!parent)
                throw new DocumentPortalError(
                  DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
                  "Patch operation requires a parent"
                )
              validateTreeChildren(parent, operation.nodes)
              added += countParsedNodes(operation.nodes)
            }
          }
          if (rootContentReplacement)
            removed += target.children.reduce((count, child) => count + countPlanNodes(child), 0)
          else if (
            operation.kind === "cut" ||
            (operation.kind === "put" &&
              !(operation.nodes?.length === 1 && operation.nodes[0]?.children.length === 0) &&
              !isAdditiveEmptyNodeCompletion(operation, target))
          )
            removed += countPlanNodes(target)
        }
        const currentNodeCount = countPlanNodes(root)
        const resultingNodeCount = currentNodeCount + added - removed
        if (resultingNodeCount > MAX_NODE_COUNT && resultingNodeCount > currentNodeCount)
          throw new DocumentPortalError(
            DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
            "Patch exceeds the maximum node count"
          )
        const affectedNodes: Array<{
          path: string[]
          type: "module" | "case" | "step"
          text: string
          depth: number
          count: number
        }> = []
        for (const target of destructiveTargets) collectAffectedNodes(target, 0, affectedNodes)
        const fingerprint = contentHash(JSON.stringify(affectedNodes))
        const preview = { destructive: removed > 0, removedNodes: removed, affectedNodes }
        if (request.preview) {
          if (preview.destructive) {
            const confirmationToken = crypto.randomUUID()
            destructivePreviews.set(confirmationToken, {
              documentId: request.documentId,
              anchorTag: request.anchorTag,
              patch: request.patch,
              operations: request.operations,
              fingerprint,
              expiresAt: Date.now() + 5 * 60_000,
            })
            return {
              documentId: request.documentId,
              revision: getDocumentRevision(mindMap),
              dirty: state.dirty,
              phase: "preview",
              changeSummary: preview,
              confirmationToken,
              effects,
              diagnostics: [],
            }
          }
          return {
            documentId: request.documentId,
            revision: getDocumentRevision(mindMap),
            dirty: state.dirty,
            phase: "preview",
            changeSummary: preview,
            effects,
            diagnostics: [],
          }
        }
        if (preview.destructive) {
          const confirmation = request.confirmationToken
            ? destructivePreviews.get(request.confirmationToken)
            : undefined
          if (!confirmation)
            throw new DocumentPortalError(
              DOCUMENT_PORTAL_ERROR_CODE.PREVIEW_REQUIRED,
              "Destructive document edits require trusted user approval"
            )
          if (confirmation.fingerprint !== fingerprint)
            throw new DocumentPortalError(
              DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
              "Document changed since destructive edit preview"
            )
          destructivePreviews.delete(request.confirmationToken!)
        }
        const before = structuredClone(rootData)
        mindMap.command.commitHistoryNow()
        mindMap.command.pause()
        try {
          await executeDataTreePatch(mindMap, ownedRoot => {
            applyCompiledOperationsToData(ownedRoot, compiled)
          })
        } catch (error) {
          try {
            await executeDataTreePatch(mindMap, ownedRoot => {
              for (const key of Object.keys(ownedRoot.data)) delete ownedRoot.data[key]
              Object.assign(ownedRoot.data, structuredClone(before.data))
              ownedRoot.children.splice(
                0,
                ownedRoot.children.length,
                ...structuredClone(before.children)
              )
            })
          } catch (restoreError) {
            throw new DocumentPortalError(
              DOCUMENT_PORTAL_ERROR_CODE.CONSISTENCY,
              "Document edit failed and the live document could not be restored",
              { cause: restoreError }
            )
          }
          throw error
        } finally {
          mindMap.command.recovery()
        }
        await focusRenderedNodes(mindMap, postEditFocusUids(compiled))
        mindMap.command.commitHistoryNow()
        state.setDirty(true)
        readSnapshots.delete(request.anchorTag)
        const committedData = mindMap.getData() as MindMapNodeTree | { root?: MindMapNodeTree }
        const committedRoot =
          "root" in committedData && committedData.root
            ? committedData.root
            : (committedData as MindMapNodeTree)
        const pendingDiagnostics = lintAffectedNodes(committedRoot, affectedUids)
        const needsView =
          request.operations === undefined ||
          request.returnView !== undefined ||
          pendingDiagnostics.length > 0
        const preferredReturnPath =
          pendingDiagnostics.length === 0 && request.returnView?.path !== undefined
            ? normalizePublicPath(committedRoot, request.returnView.path)
            : undefined
        const returnPath =
          preferredReturnPath !== undefined &&
          (preferredReturnPath.length === 0 || findByPath(committedRoot, preferredReturnPath))
            ? preferredReturnPath
            : postEditPath(compiled)
        const view = needsView
          ? this.read({
              documentId: request.documentId,
              view:
                pendingDiagnostics.length > 0 ? "subtree" : (request.returnView?.view ?? "outline"),
              path: returnPath,
              maxLines: request.returnView?.maxLines ?? DEFAULT_READ_MAX_LINES,
            })
          : undefined
        const viewSnapshot = view ? readSnapshots.get(view.anchorTag) : undefined
        const lineByUid = new Map<string, number>()
        for (const [line, uid] of viewSnapshot?.lines ?? []) lineByUid.set(uid, line)
        const diagnostics: DocumentEditDiagnostic[] = pendingDiagnostics.map(diagnostic => {
          const line = lineByUid.get(diagnostic.uid)
          const publicDiagnostic: Omit<DocumentEditDiagnostic, "line" | "repairPatchHint"> = {
            severity: diagnostic.severity,
            code: diagnostic.code,
            path: diagnostic.path,
            message: diagnostic.message,
          }
          if (line === undefined) return publicDiagnostic
          const repairPatchHint =
            diagnostic.code === "CASE_HAS_NO_STEPS"
              ? (() => {
                  const caseNode = findDataNode(committedRoot, diagnostic.uid)?.node
                  const priority = getIcons(caseNode ?? committedRoot)
                    .find(icon => icon.startsWith("priority_"))
                    ?.slice("priority_".length)
                  const label = priority
                    ? `[P${priority}] ${diagnostic.path.at(-1)}`
                    : diagnostic.path.at(-1)
                  return `PUT ${line}.=${line}:\n+${label}\n+  操作 & 预期结果`
                })()
              : `PUT ${line}.=${line}:\n+${diagnostic.path.at(-1)} & 预期结果`
          return { ...publicDiagnostic, line, repairPatchHint }
        })
        return {
          documentId: request.documentId,
          revision: getDocumentRevision(mindMap),
          dirty: true,
          phase: "committed",
          changeSummary: preview,
          ...(effects.length ? { effects } : {}),
          ...(view ? { view } : {}),
          diagnostics,
        }
      })
    },
  }
}
interface RevisionState {
  value: number
}

const documentRevisions = new WeakMap<object, RevisionState>()

function getDocumentRevision(mindMap: object | null): number {
  if (!mindMap) return 0
  const tracked = documentRevisions.get(mindMap)
  if (tracked) return tracked.value

  const revision = { value: 0 }
  const observable = mindMap as { on?: (event: string, listener: () => void) => void }
  const advance = () => {
    revision.value += 1
  }
  observable.on?.("data_change", advance)
  observable.on?.("set_data", advance)
  observable.on?.("update_data", advance)
  documentRevisions.set(mindMap, revision)
  return revision.value
}

export const mindMapDocumentPortal = createMindMapDocumentPortal()
