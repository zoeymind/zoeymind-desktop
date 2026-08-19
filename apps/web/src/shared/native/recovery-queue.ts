export type RecoveryWrite = () => Promise<void>

interface QueueState {
  running: Promise<void> | null
  pending: RecoveryWrite | null
  waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }>
}

const queues = new Map<string, QueueState>()

function queueFor(projectId: string): QueueState {
  const existing = queues.get(projectId)
  if (existing) return existing
  const created: QueueState = { running: null, pending: null, waiters: [] }
  queues.set(projectId, created)
  return created
}

async function drain(projectId: string, state: QueueState): Promise<void> {
  let failure: unknown
  while (state.pending) {
    const write = state.pending
    state.pending = null
    try {
      await write()
      failure = undefined
    } catch (error) {
      failure = error
      if (!state.pending) break
    }
  }

  state.running = null
  const waiters = state.waiters.splice(0)
  queues.delete(projectId)
  for (const waiter of waiters) {
    if (failure === undefined) waiter.resolve()
    else waiter.reject(failure)
  }
}

/** Coalesces queued snapshots while preserving the newest project state. */
export function enqueueRecoveryWrite(projectId: string, write: RecoveryWrite): void {
  const state = queueFor(projectId)
  state.pending = write
  if (!state.running) {
    state.running = drain(projectId, state)
  }
}

export function flushRecoveryWrites(projectId?: string): Promise<void> {
  const selected = projectId ? [[projectId, queues.get(projectId)] as const] : [...queues.entries()]
  const waits = selected.flatMap(([, state]) => {
    if (!state) return []
    return [
      new Promise<void>((resolve, reject) => {
        state.waiters.push({ resolve, reject })
      }),
    ]
  })
  return Promise.all(waits).then(() => undefined)
}

export function resetRecoveryQueueForTests(): void {
  queues.clear()
}
