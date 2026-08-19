import { useMindMapStore } from "@/products/mind/features/mindmap/stores/mindmap-store"
import { projectSessionRegistry } from "./project-session-registry"
import type { ProjectSessionStore } from "./project-session-store"
import { PROJECT_SESSION_LIFECYCLE } from "./project-session-store"

export function syncLegacyProjectSession(store: ProjectSessionStore): void {
  const legacy = useMindMapStore.getState()
  const session = store.getState()
  session.setLifecycle(
    legacy.loadError
      ? PROJECT_SESSION_LIFECYCLE.ERROR
      : legacy.isLoading
        ? PROJECT_SESSION_LIFECYCLE.LOADING
        : legacy.mindMap
          ? PROJECT_SESSION_LIFECYCLE.READY
          : PROJECT_SESSION_LIFECYCLE.IDLE
  )
  session.setMindMap(legacy.mindMap)
  session.setDirty(legacy.isDirty)
  session.setTitle(legacy.title)
  session.setLoadError(legacy.loadError)
  session.setPreview(legacy.isPreviewMode, legacy.exitPreviewCallback)
}

export function startLegacyProjectSessionAdapter(): () => void {
  const syncActive = () => {
    const active = projectSessionRegistry.getActive()
    if (active) syncLegacyProjectSession(active)
  }

  syncActive()
  return useMindMapStore.subscribe(syncActive)
}

export function activateLegacyProjectSession(projectId: string | null): void {
  projectSessionRegistry.setActive(projectId)
  const active = projectSessionRegistry.getActive()
  if (active) syncLegacyProjectSession(active)
}
