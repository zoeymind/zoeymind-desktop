import type { BundleSource } from "./save-flow"

export type SavePhase = "idle" | "preparing" | "persisting" | "committing" | "failed"

export class SaveSupersededError extends Error {
  constructor() {
    super("保存期间有新修改，请再次保存")
    this.name = "SaveSupersededError"
  }
}

export interface SavePreparation {
  source: BundleSource
  /** Runs only after persistence succeeds and the live source is still unchanged. */
  commit: (persistedSource: BundleSource) => void
}
export interface SaveParticipant {
  /** Must not mutate source or live editor state. */
  prepare: (source: BundleSource) => SavePreparation | Promise<SavePreparation>
}

interface ExecuteSaveTransactionOptions<T> {
  source: BundleSource
  participants: Iterable<SaveParticipant>
  persist: (source: BundleSource) => Promise<T>
  commit: boolean
  onPhase: (phase: SavePhase) => void
  isCurrent: () => boolean
  onCommit: () => void
}

export interface SaveTransactionResult<T> {
  value: T
  liveStateMatchesPersisted: boolean
}

/**
 * Coordinates a save as prepare -> persist -> commit.
 * Preparation is side-effect free. A failed persistence never commits editor state.
 */
export async function executeSaveTransaction<T>({
  source,
  participants,
  persist,
  commit,
  onPhase,
  onCommit,
  isCurrent,
}: ExecuteSaveTransactionOptions<T>): Promise<SaveTransactionResult<T>> {
  try {
    onPhase("preparing")
    let preparedSource = cloneBundleSource(source)
    const preparations: SavePreparation[] = []
    for (const participant of participants) {
      const preparation = await participant.prepare(preparedSource)
      preparedSource = preparation.source
      preparations.push(preparation)
    }

    onPhase("persisting")
    const value = await persist(preparedSource)

    const liveStateMatchesPersisted = isCurrent()
    if (commit && !liveStateMatchesPersisted) throw new SaveSupersededError()
    if (commit) {
      onPhase("committing")
      for (const preparation of preparations) preparation.commit(preparedSource)
      onCommit()
    }

    onPhase("idle")
    return { value, liveStateMatchesPersisted }
  } catch (error) {
    onPhase("failed")
    throw error
  }
}

function cloneBundleSource(source: BundleSource): BundleSource {
  return {
    ...source,
    tree: structuredClone(source.tree),
    view: source.view === undefined ? undefined : structuredClone(source.view),
    previewPng: source.previewPng ? source.previewPng.slice() : source.previewPng,
    tags: source.tags ? [...source.tags] : undefined,
  }
}
