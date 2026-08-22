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
  parseTreeHashlinePatch,
  type ParsedTreeNode,
  type TreePatchOperation,
} from "./patch/tree-hashline-patch"
import { projectTestDocument } from "./test-document-projector"
const DEFAULT_READ_MAX_LINES = 200
const MAX_READ_LINES = 1_000
const DEFAULT_SEARCH_LIMIT = 50

const ANCHOR_TTL_MS = 5 * 60 * 1_000

interface ReadAnchor {
  documentId: string
  uid: string
  contentHash: string
  expiresAt: number
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
      resolvedDestination.node.children.push(resolved.node)
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
  const readAnchors = new Map<string, Map<number, ReadAnchor>>()
  const documentQueues = new Map<string, Promise<void>>()
  const destructivePreviews = new Map<
    string,
    {
      documentId: string
      anchorTag: string
      patch: string
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

  const registerReadAnchors = (
    documentId: string,
    root: MindMapNodeTree,
    request: DocumentReadRequest,
    maxLines: number
  ) => {
    const anchors = new Map<number, ReadAnchor>()
    const selected = request.path?.length ? findByPath(root, request.path) : root
    if (!selected) return anchors
    const pending: Array<{ node: MindMapNodeTree; depth: number }> = [{ node: selected, depth: 0 }]
    const expiresAt = Date.now() + ANCHOR_TTL_MS
    let line = 0
    while (pending.length > 0 && line < maxLines) {
      const current = pending.pop()
      if (!current) break
      if (
        request.view === "subtree" ||
        current.depth === 0 ||
        isModule(current.node) ||
        isCase(current.node)
      ) {
        line += 1
        const uid = current.node.data.uid
        if (typeof uid === "string")
          anchors.set(line, {
            documentId,
            uid,
            contentHash: contentHash(getText(current.node)),
            expiresAt,
          })
      }
      if (request.view === "outline" && isCase(current.node)) continue
      for (let index = current.node.children.length - 1; index >= 0; index -= 1)
        pending.push({ node: current.node.children[index], depth: current.depth + 1 })
    }
    return anchors
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
      readAnchors.set(
        anchorTag,
        registerReadAnchors(request.documentId, root, { ...request, path }, maxLines)
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
            }
          : inputRequest
        if (!request.anchorTag || !request.patch)
          throw new DocumentPortalError(
            DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
            "Document edits require anchorTag and patch"
          )
        const operations = parseTreeHashlinePatch(request.patch)
        if (!operations)
          throw new DocumentPortalError(
            DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
            explainInvalidTreeHashlinePatch(request.patch)
          )
        const rangedOperations = operations.filter(
          operation => operation.end !== undefined && operation.end !== operation.start
        )
        const anchors = readAnchors.get(request.anchorTag)
        const state = getReadyState(request.documentId)
        const mindMap = state.mindMap
        const rawData = mindMap.getData() as MindMapNodeTree | { root?: MindMapNodeTree }
        const rootData =
          "root" in rawData && rawData.root ? rawData.root : (rawData as MindMapNodeTree)
        const root = toPlan(rootData, null, mindMap)
        const byLine = new Map<number, PlannedNode>()
        for (const operation of operations) {
          for (const line of [operation.start, operation.end, operation.destination]) {
            if (line === undefined) continue
            const anchor = anchors?.get(line)
            if (
              !anchor ||
              anchor.documentId !== request.documentId ||
              anchor.expiresAt < Date.now()
            )
              throw new DocumentPortalError(
                DOCUMENT_PORTAL_ERROR_CODE.ANCHOR_EXPIRED,
                "Document edit anchor has expired; query the affected area again and retry"
              )
            const node = findPlanNode(root, anchor.uid)
            if (!node)
              throw new DocumentPortalError(
                DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
                "The anchored node no longer exists; query the affected area again and retry"
              )
            if (contentHash(getText(node.data)) !== anchor.contentHash)
              throw new DocumentPortalError(
                DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
                "The anchored node changed; query the affected area again and retry"
              )
            byLine.set(line, node)
          }
        }
        const compiled: CompiledOperation[] = operations.map(operation => ({
          operation,
          target: byLine.get(operation.start)!,
          ...(operation.destination ? { destination: byLine.get(operation.destination) } : {}),
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
        const destructiveTargets = compiled.flatMap(({ operation, target }) =>
          isRootContentReplacement(operation, target) ? target.children : [target]
        )
        const destructiveOperationTargets = compiled
          .filter(({ operation, target }) => {
            if (isAdditiveEmptyNodeCompletion(operation, target)) return false
            return (
              (operation.kind === "cut" || operation.kind === "put") &&
              !(
                target.parent === null &&
                operation.kind === "put" &&
                operation.nodes?.length === 1 &&
                operation.nodes[0]?.children.length === 0
              )
            )
          })
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
          if (operation.kind === "move" && destination)
            validateTreeChildren(destination, [
              { text: target.text, icon: target.icon, children: [] },
            ])
          if (operation.nodes) {
            const simpleTextReplacement =
              operation.kind === "put" &&
              operation.nodes.length === 1 &&
              operation.nodes[0]?.children.length === 0
            if (rootContentReplacement) {
              validateTreeChildren(target, operation.nodes[0]!.children)
              added += countParsedNodes(operation.nodes[0]!.children)
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
              diagnostics: [],
            }
          }
          return {
            documentId: request.documentId,
            revision: getDocumentRevision(mindMap),
            dirty: state.dirty,
            phase: "preview",
            changeSummary: preview,
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
        readAnchors.delete(request.anchorTag)
        const committedData = mindMap.getData() as MindMapNodeTree | { root?: MindMapNodeTree }
        const committedRoot =
          "root" in committedData && committedData.root
            ? committedData.root
            : (committedData as MindMapNodeTree)
        const pendingDiagnostics = lintAffectedNodes(committedRoot, affectedUids)
        const view = this.read({
          documentId: request.documentId,
          view: pendingDiagnostics.length > 0 ? "subtree" : (request.returnView?.view ?? "outline"),
          path: postEditPath(compiled),
          maxLines: request.returnView?.maxLines ?? DEFAULT_READ_MAX_LINES,
        })
        const viewAnchors = readAnchors.get(view.anchorTag)
        const lineByUid = new Map<string, number>()
        for (const [line, anchor] of viewAnchors ?? []) lineByUid.set(anchor.uid, line)
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
          view,
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
