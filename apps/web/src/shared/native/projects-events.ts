/**
 * 项目列表变更 bump —— 极简 zustand 计数器. save-flow / registerProject /
 * refreshProjectIndex 完成后调 `bumpProjects()`, useProjects 订阅这个 count 变化
 * 触发 refetch.
 *
 * 不用 react-query 因为 useProjects 用的是 useState + listProjects; 这里给它一个
 * 全局失效信号即可.
 */
import { create } from "zustand"

export interface ProjectPathEvent {
  id: string
  path: string
  name: string
  revision: number
}

interface ProjectsEvents {
  bumpCount: number
  pathChanged: ProjectPathEvent | null
  bump: () => void
  notifyPathChanged: (project: Omit<ProjectPathEvent, "revision">) => void
}

export const useProjectsEvents = create<ProjectsEvents>(set => ({
  bumpCount: 0,
  pathChanged: null,
  bump: () => set(s => ({ bumpCount: s.bumpCount + 1 })),
  notifyPathChanged: project =>
    set(s => ({ pathChanged: { ...project, revision: (s.pathChanged?.revision ?? 0) + 1 } })),
}))

export function bumpProjects(): void {
  useProjectsEvents.getState().bump()
}

export function notifyProjectPathChanged(project: Omit<ProjectPathEvent, "revision">): void {
  useProjectsEvents.getState().notifyPathChanged(project)
  bumpProjects()
}

export const notifyProjectRenamed = notifyProjectPathChanged
export type ProjectRenameEvent = ProjectPathEvent
