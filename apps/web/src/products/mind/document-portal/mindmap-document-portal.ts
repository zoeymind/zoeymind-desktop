import type { MindMapNodeTree } from "simple-mind-map"
import {
  PROJECT_SESSION_LIFECYCLE,
  projectSessionRegistry,
  type ProjectSessionRegistry,
} from "@/products/mind/editor-session"
import { useTabs, type OpenTab, type TabId } from "@/shared/tabs/store"
import {
  DOCUMENT_PORTAL_ERROR_CODE,
  DocumentPortalError,
  type DocumentPortal,
  type DocumentReadRequest,
  type DocumentReadResult,
} from "./document-portal"
import { projectTestDocument } from "./test-document-projector"

const DEFAULT_READ_MAX_LINES = 200
const MAX_READ_LINES = 1_000

interface TabsSnapshot {
  tabs: OpenTab[]
  activeId: TabId
}

interface MindMapDocumentPortalDependencies {
  registry?: ProjectSessionRegistry
  getTabs?: () => TabsSnapshot
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
      const { tabs } = getTabs()
      const tab = tabs.find(candidate => candidate.id === request.documentId)
      if (!tab) {
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.NOT_OPEN,
          `Document is not open: ${request.documentId}`
        )
      }

      const state = registry.get(request.documentId)?.getState()
      if (!state || state.lifecycle !== PROJECT_SESSION_LIFECYCLE.READY || state.mindMap === null) {
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.NOT_READY,
          `Document is not ready: ${request.documentId}`
        )
      }

      const maxLines = request.maxLines ?? DEFAULT_READ_MAX_LINES
      if (!Number.isInteger(maxLines) || maxLines < 1 || maxLines > MAX_READ_LINES) {
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.INVALID_READ_LIMIT,
          `Document read maxLines must be between 1 and ${MAX_READ_LINES}`
        )
      }

      const root = state.mindMap.getData() as MindMapNodeTree
      const projection = projectTestDocument({
        root,
        view: request.view,
        path: request.path,
        maxLines,
      })
      if (request.path?.length && projection.lineCount === 0) {
        throw new DocumentPortalError(
          DOCUMENT_PORTAL_ERROR_CODE.PATH_NOT_FOUND,
          `Document path was not found: ${request.path.join(" / ")}`
        )
      }

      return {
        documentId: request.documentId,
        title: state.title ?? tab.title,
        revision: getDocumentRevision(state.mindMap),
        view: request.view,
        ...(request.path?.length ? { path: request.path } : {}),
        ...projection,
      }
    },
  }
}

export const mindMapDocumentPortal = createMindMapDocumentPortal()
