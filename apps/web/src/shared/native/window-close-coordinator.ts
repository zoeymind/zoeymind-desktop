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
    await commands.flushRecovery?.()
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
