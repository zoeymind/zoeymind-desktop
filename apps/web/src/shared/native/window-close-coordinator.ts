import { projectSessionRegistry, type ProjectSessionStore } from "@/products/mind/editor-session"
import * as pendingProjects from "./pending-projects"

export function guardedSessions(sessions: ProjectSessionStore[]): ProjectSessionStore[] {
  return sessions.filter(session => {
    const state = session.getState()
    return state.dirty || pendingProjects.isPending(state.projectId)
  })
}

export async function saveAllSessions(sessions: ProjectSessionStore[]): Promise<void> {
  for (const session of sessions) {
    const commands = session.getState().commands
    if (!commands.save) throw new Error(`project ${session.getState().projectId} cannot be saved`)
    await commands.save()
    // save 成功后再 flushRecovery 会引入幽灵 recovery: flushRecovery 的旧闭包
    // 里 isDirty 还是 true, 会把已经 clean 的内容重新写回 recovery/, 下次启动误弹.
    // 干净保存本身已经在 save() 内 clearRecovery, 这里不再补 flush.
    const stateAfterSave = session.getState()
    if (stateAfterSave.dirty || pendingProjects.isPending(stateAfterSave.projectId)) {
      throw new Error(`project ${stateAfterSave.projectId} was not saved`)
    }
  }
}

export async function discardAllSessions(sessions: ProjectSessionStore[]): Promise<void> {
  for (const session of sessions) {
    await session.getState().commands.discard?.()
  }
}

export function getGuardedSessions(): ProjectSessionStore[] {
  return guardedSessions(projectSessionRegistry.getAll())
}

export async function prepareForAppRestart(
  sessions: ProjectSessionStore[] = getGuardedSessions()
): Promise<void> {
  await saveAllSessions(sessions)
}
