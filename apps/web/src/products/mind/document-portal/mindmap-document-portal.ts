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
}

interface PlannedNode {
  uid: string
  text: string
  icon: string[]
  parent: PlannedNode | null
  children: PlannedNode[]
  live: LiveMindMapNode | null
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
    typeof value.getData === "function"
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
  if (parent && (typeof uid !== "string" || !isLiveMindMapNode(live)))
    throw new DocumentPortalError(
      DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
      "Document nodes are no longer live"
    )
  const planned: PlannedNode = {
    uid: typeof uid === "string" ? uid : "",
    text: getText(node),
    icon: getIcons(node),
    parent,
    children: [],
    live: isLiveMindMapNode(live) ? live : null,
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

function validateTreeChildren(parent: PlannedNode, nodes: readonly ParsedTreeNode[]): void {
  const parentIsRoot = parent.parent === null
  const parentIsModule = parent.icon.includes("sign_2")
  const parentIsCase = parent.icon.some(icon => icon.startsWith("priority_"))
  for (const node of nodes) {
    const isModuleNode = node.icon?.includes("sign_2") ?? false
    const isCaseNode = node.icon?.some(icon => icon.startsWith("priority_")) ?? false
    if (
      (parentIsRoot && !isModuleNode) ||
      (parentIsModule && !isCaseNode) ||
      (parentIsCase && (isModuleNode || isCaseNode)) ||
      (!parentIsRoot && !parentIsModule && !parentIsCase)
    )
      throw new DocumentPortalError(
        DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
        "Patch violates Test Document parent-child rules"
      )
    validateParsedSubtree(node)
  }
}
function validateParsedSubtree(node: ParsedTreeNode): void {
  const isModuleNode = node.icon?.includes("sign_2") ?? false
  const isCaseNode = node.icon?.some(icon => icon.startsWith("priority_")) ?? false
  for (const child of node.children) {
    const childModule = child.icon?.includes("sign_2") ?? false
    const childCase = child.icon?.some(icon => icon.startsWith("priority_")) ?? false
    if (
      (isModuleNode && !childCase) ||
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

function asEngineNodes(
  nodes: readonly ParsedTreeNode[]
): Array<{ data: { text: string; icon?: string[]; uid?: string }; children: unknown[] }> {
  return nodes.map(node => ({
    data: {
      text: node.text,
      ...(node.icon ? { icon: node.icon } : {}),
      ...(node.uid ? { uid: node.uid } : {}),
    },
    children: asEngineNodes(node.children),
  }))
}

function asParsedPlanNode(node: PlannedNode): ParsedTreeNode {
  return {
    uid: node.uid,
    text: node.text,
    ...(node.icon.length ? { icon: node.icon } : {}),
    children: node.children.map(asParsedPlanNode),
  }
}

function collectNodeUids(node: MindMapNodeTree, uids: Set<string>): void {
  if (typeof node.data.uid === "string") uids.add(node.data.uid)
  for (const child of node.children) collectNodeUids(child, uids)
}

function getCurrentNodeUids(mindMap: MindMap): Set<string> {
  const rawData = mindMap.getData() as MindMapNodeTree | { root?: MindMapNodeTree }
  const root = "root" in rawData && rawData.root ? rawData.root : (rawData as MindMapNodeTree)
  const uids = new Set<string>()
  collectNodeUids(root, uids)
  return uids
}

function findLiveNodes(mindMap: MindMap, uids: Iterable<string>): LiveMindMapNode[] {
  const nodes: LiveMindMapNode[] = []
  for (const uid of uids) {
    const node = mindMap.renderer?.findNodeByUid(uid)
    if (isLiveMindMapNode(node)) nodes.push(node)
  }
  return nodes
}

function insertAtOriginalPosition(
  mindMap: MindMap,
  parent: PlannedNode,
  nextSibling: PlannedNode | undefined,
  nodes: readonly ParsedTreeNode[]
): void {
  if (nextSibling?.live)
    mindMap.execCommand("INSERT_MULTI_NODE", [nextSibling.live], asEngineNodes(nodes))
  else mindMap.execCommand("INSERT_MULTI_CHILD_NODE", [parent.live!], asEngineNodes(nodes))
}

function getIcons(node: MindMapNodeTree): string[] {
  return Array.isArray(node.data.icon)
    ? node.data.icon.filter((icon): icon is string => typeof icon === "string")
    : []
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
    { documentId: string; anchorTag: string; patch: string; fingerprint: string }
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
      if (request.view === "subtree" || current.depth === 0 || isModule(current.node)) {
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
      const projection = projectTestDocument({
        root,
        view: request.view,
        path: request.path,
        maxLines,
      })
      if (request.path?.length && projection.lineCount === 0)
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.PATH_NOT_FOUND,
          `Document path was not found: ${request.path.join(" / ")}`
        )
      const anchorTag = crypto.randomUUID()
      readAnchors.set(anchorTag, registerReadAnchors(request.documentId, root, request, maxLines))
      return {
        documentId: request.documentId,
        title:
          state.title ?? getTabs().tabs.find(tab => tab.id === request.documentId)?.title ?? "",
        revision: getDocumentRevision(state.mindMap),
        view: request.view,
        ...(request.path?.length ? { path: request.path } : {}),
        ...projection,
        anchorTag,
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
      const scope = request.scope ?? []
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
    edit(request: DocumentEditRequest): Promise<DocumentEditResult> {
      return enqueue(request.documentId, async () => {
        const operations = parseTreeHashlinePatch(request.patch)
        if (!operations)
          throw new DocumentPortalError(
            DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
            "Patch must use Tree Hashline operations"
          )
        if (
          operations.some(
            operation => operation.end !== undefined && operation.end !== operation.start
          )
        ) {
          throw new DocumentPortalError(
            DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
            "Inclusive patch ranges are not supported"
          )
        }
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
                "Document edit anchor has expired"
              )
            const node = findPlanNode(root, anchor.uid)
            if (
              !node ||
              !node.live ||
              contentHash(String(node.live.getData("text") ?? "").trim()) !== anchor.contentHash
            )
              throw new DocumentPortalError(
                DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
                "Document changed since this line was read"
              )
            byLine.set(line, node)
          }
        }
        const compiled: CompiledOperation[] = operations.map(operation => ({
          operation,
          target: byLine.get(operation.start)!,
          ...(operation.destination ? { destination: byLine.get(operation.destination) } : {}),
        }))
        const destructiveTargets = compiled
          .filter(({ operation }) => operation.kind === "cut" || operation.kind === "put")
          .map(({ target }) => target)
        for (let outer = 0; outer < destructiveTargets.length; outer += 1)
          for (let inner = outer + 1; inner < destructiveTargets.length; inner += 1)
            if (
              destructiveTargets[outer] === destructiveTargets[inner] ||
              isDescendant(destructiveTargets[outer]!, destructiveTargets[inner]!) ||
              isDescendant(destructiveTargets[inner]!, destructiveTargets[outer]!)
            )
              throw new DocumentPortalError(
                DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
                "Patch operations overlap"
              )
        let added = 0
        let removed = 0
        for (const { operation, target, destination } of compiled) {
          if (
            (operation.kind === "cut" || operation.kind === "move" || operation.kind === "put") &&
            target === root
          )
            throw new DocumentPortalError(
              DOCUMENT_PORTAL_ERROR_CODE.INVALID_EDIT_PATCH,
              "The document root cannot be changed structurally"
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
            if (!simpleTextReplacement) {
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
          if (
            operation.kind === "cut" ||
            (operation.kind === "put" &&
              !(operation.nodes?.length === 1 && operation.nodes[0]?.children.length === 0))
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
            })
            return {
              documentId: request.documentId,
              revision: getDocumentRevision(mindMap),
              dirty: state.dirty,
              preview: { ...preview, confirmationToken },
            }
          }
          return {
            documentId: request.documentId,
            revision: getDocumentRevision(mindMap),
            dirty: state.dirty,
            preview,
          }
        }
        if (preview.destructive) {
          const confirmation = request.confirmationToken
            ? destructivePreviews.get(request.confirmationToken)
            : undefined
          if (
            !confirmation ||
            confirmation.documentId !== request.documentId ||
            confirmation.anchorTag !== request.anchorTag ||
            confirmation.patch !== request.patch
          )
            throw new DocumentPortalError(
              DOCUMENT_PORTAL_ERROR_CODE.PREVIEW_REQUIRED,
              "Destructive document edits require a matching preview confirmation"
            )
          if (confirmation.fingerprint !== fingerprint)
            throw new DocumentPortalError(
              DOCUMENT_PORTAL_ERROR_CODE.EDIT_CONFLICT,
              "Document changed since destructive edit preview"
            )
          destructivePreviews.delete(request.confirmationToken!)
        }
        mindMap.command.pause()
        const inverseOperations: Array<() => void> = []
        try {
          for (const { operation, target, destination } of compiled) {
            if (
              operation.kind === "put" &&
              operation.nodes?.length === 1 &&
              operation.nodes[0]?.children.length === 0
            ) {
              const previousText = String(target.live!.getData("text") ?? "")
              mindMap.execCommand("SET_NODE_TEXT", target.live!, operation.nodes[0].text)
              inverseOperations.push(() =>
                mindMap.execCommand("SET_NODE_TEXT", target.live!, previousText)
              )
            } else if (operation.kind === "put") {
              const parent = target.parent!
              const nextSibling = parent.children[parent.children.indexOf(target) + 1]
              const original = asParsedPlanNode(target)
              const uidsBeforeReplacement = getCurrentNodeUids(mindMap)
              const replacement = operation.nodes!.map((node, index) =>
                index === 0 ? { ...node, uid: target.uid } : node
              )
              inverseOperations.push(() => {
                const inserted = [...getCurrentNodeUids(mindMap)].filter(
                  uid => !uidsBeforeReplacement.has(uid)
                )
                const liveInserted = findLiveNodes(mindMap, inserted)
                if (liveInserted.length > 0) mindMap.execCommand("REMOVE_NODE", liveInserted)
                const liveReplacement = mindMap.renderer?.findNodeByUid(target.uid)
                if (isLiveMindMapNode(liveReplacement))
                  mindMap.execCommand("REMOVE_NODE", [liveReplacement])
                if (!isLiveMindMapNode(mindMap.renderer?.findNodeByUid(target.uid)))
                  insertAtOriginalPosition(mindMap, parent, nextSibling, [original])
              })
              mindMap.execCommand("REMOVE_NODE", [target.live!])
              insertAtOriginalPosition(mindMap, parent, nextSibling, replacement)
            } else if (operation.kind === "cut") {
              const parent = target.parent!
              const nextSibling = parent.children[parent.children.indexOf(target) + 1]
              mindMap.execCommand("REMOVE_NODE", [target.live!])
              inverseOperations.push(() =>
                insertAtOriginalPosition(mindMap, parent, nextSibling, [asParsedPlanNode(target)])
              )
            } else if (operation.kind === "insert-after") {
              const parent = target.parent!
              const nextSibling = parent.children[parent.children.indexOf(target) + 1]
              const beforeInsertion = getCurrentNodeUids(mindMap)
              insertAtOriginalPosition(mindMap, parent, nextSibling, operation.nodes!)
              const inserted = [...getCurrentNodeUids(mindMap)].filter(
                uid => !beforeInsertion.has(uid)
              )
              inverseOperations.push(() => {
                const liveInserted = findLiveNodes(mindMap, inserted)
                if (liveInserted.length > 0) mindMap.execCommand("REMOVE_NODE", liveInserted)
              })
            } else if (operation.kind === "insert-before") {
              const beforeInsertion = getCurrentNodeUids(mindMap)
              mindMap.execCommand(
                "INSERT_MULTI_NODE",
                [target.live!],
                asEngineNodes(operation.nodes!)
              )
              const inserted = [...getCurrentNodeUids(mindMap)].filter(
                uid => !beforeInsertion.has(uid)
              )
              inverseOperations.push(() => {
                const liveInserted = findLiveNodes(mindMap, inserted)
                if (liveInserted.length !== inserted.length)
                  throw new Error("Portal rollback could not locate inserted nodes")
                mindMap.execCommand("REMOVE_NODE", liveInserted)
              })
            } else if (operation.kind === "move") {
              const previousParent = target.parent!
              mindMap.execCommand("MOVE_NODE_TO", [target.live!], destination!.live!)
              inverseOperations.push(() =>
                mindMap.execCommand("MOVE_NODE_TO", [target.live!], previousParent.live!)
              )
            }
          }
        } catch (error) {
          for (let index = inverseOperations.length - 1; index >= 0; index -= 1) {
            try {
              inverseOperations[index]!()
            } catch {
              /* preserve original command error */
            }
          }
          throw error
        } finally {
          mindMap.command.recovery()
        }
        mindMap.command.addHistory()
        state.setDirty(true)
        readAnchors.delete(request.anchorTag)
        return {
          documentId: request.documentId,
          revision: getDocumentRevision(mindMap),
          dirty: true,
          preview,
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
