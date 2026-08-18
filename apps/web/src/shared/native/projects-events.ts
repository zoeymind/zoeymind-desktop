/**
 * 项目列表变更 bump —— 极简 zustand 计数器. save-flow / registerProject /
 * refreshProjectIndex 完成后调 `bumpProjects()`, useProjects 订阅这个 count 变化
 * 触发 refetch.
 *
 * 不用 react-query 因为 useProjects 用的是 useState + listProjects; 这里给它一个
 * 全局失效信号即可.
 */
import { create } from 'zustand'

interface ProjectsEvents {
  bumpCount: number
  bump: () => void
}

export const useProjectsEvents = create<ProjectsEvents>(set => ({
  bumpCount: 0,
  bump: () => set(s => ({ bumpCount: s.bumpCount + 1 }))
}))

export function bumpProjects(): void {
  useProjectsEvents.getState().bump()
}
