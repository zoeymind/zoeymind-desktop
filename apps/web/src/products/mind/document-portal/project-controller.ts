import { defaultMindmapData } from "@zoeymind/shared"
import { PROJECT_SESSION_LIFECYCLE, projectSessionRegistry } from "../editor-session"
import { getProject, listProjects, pendingProjects } from "@/shared/native"
import { useTabs } from "@/shared/tabs/store"

export type ProjectControlRequest =
  | { action: "list" }
  | { action: "create"; title?: string }
  | { action: "discard"; projectId: string }

export async function controlProjects(request: ProjectControlRequest) {
  if (request.action === "create") {
    const title = request.title?.trim() || "Untitled"
    const projectId = pendingProjects.stash({ title, tree: structuredClone(defaultMindmapData) })
    useTabs.getState().openTab({ id: projectId, kind: "draft", title })
    return { projectId, title, active: true, ready: false }
  }
  if (request.action === "discard") {
    if (!pendingProjects.isPending(request.projectId))
      throw new Error(`Only unsaved projects can be discarded: ${request.projectId}`)
    useTabs.getState().closeTab(request.projectId)
    pendingProjects.clear(request.projectId)
    return { projectId: request.projectId, discarded: true }
  }

  const persisted = await listProjects({ includeArchived: true })
  const tabs = useTabs.getState()
  const persistedById = new Map(persisted.map(project => [project.id, project] as const))
  const openByProjectId = new Map(tabs.tabs.map(tab => [tab.projectId ?? tab.id, tab] as const))
  const projectIds = [
    ...persisted.map(project => project.id),
    ...tabs.tabs
      .map(tab => tab.projectId ?? tab.id)
      .filter(projectId => !persistedById.has(projectId)),
  ]
  return {
    projects: projectIds.map(projectId => {
      const project = persistedById.get(projectId)
      const tab = openByProjectId.get(projectId)
      const session = tab ? projectSessionRegistry.get(tab.id)?.getState() : undefined
      return {
        projectId,
        title: project?.name ?? tab?.title ?? projectId,
        exists: project?.exists ?? pendingProjects.isPending(projectId),
        open: Boolean(tab),
        active: tab?.id === tabs.activeId,
        ready: session?.lifecycle === PROJECT_SESSION_LIFECYCLE.READY && session.mindMap !== null,
      }
    }),
  }
}

export async function activateProject(projectId: string) {
  const tabs = useTabs.getState()
  const open = tabs.tabs.find(tab => tab.id === projectId || tab.projectId === projectId)
  if (open) {
    tabs.setActive(open.id)
    const state = projectSessionRegistry.get(open.id)?.getState()
    return {
      projectId,
      active: true,
      ready: state?.lifecycle === PROJECT_SESSION_LIFECYCLE.READY && state.mindMap !== null,
    }
  }

  const project = await getProject(projectId)
  if (!project || !project.exists) throw new Error(`Project is not available: ${projectId}`)
  tabs.openTab({ id: project.id, kind: "file", title: project.name, projectId: project.id })
  return { projectId, active: true, ready: false }
}
