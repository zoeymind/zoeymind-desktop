import { useTabs } from "@/shared/tabs/store"
import { readRecoveryBundle, type RecoveryDescriptor } from "./recovery"
import * as pendingProjects from "./pending-projects"

export interface RecoverySuccess {
  recoveryId: string
  tabId: string
  title: string
}

export interface RecoveryFailure {
  recoveryId: string
  message: string
}

export interface RecoveryBatchResult {
  succeeded: RecoverySuccess[]
  failed: RecoveryFailure[]
}

async function restoreOne(desc: RecoveryDescriptor): Promise<RecoverySuccess> {
  const bundle = await readRecoveryBundle(desc.projectId)
  if (!bundle) throw new Error("恢复文件不存在")

  const tabId = pendingProjects.stashRecovered({
    title: bundle.meta.name,
    tree: bundle.tree,
    view: bundle.view,
    recoveryId: desc.projectId,
    originPath: desc.sourcePath,
    originRevision: desc.sourceRevision ?? null,
  })
  useTabs.getState().openTab({
    id: tabId,
    kind: "recovery",
    title: bundle.meta.name,
  })
  return { recoveryId: desc.projectId, tabId, title: bundle.meta.name }
}

export async function restoreAllRecoveries(
  descriptors: readonly RecoveryDescriptor[]
): Promise<RecoveryBatchResult> {
  const succeeded: RecoverySuccess[] = []
  const failed: RecoveryFailure[] = []
  const snapshot = [...descriptors].sort((left, right) => left.savedAt - right.savedAt)
  for (const descriptor of snapshot) {
    try {
      succeeded.push(await restoreOne(descriptor))
    } catch (error) {
      failed.push({
        recoveryId: descriptor.projectId,
        message: error instanceof Error ? error.message : "恢复失败",
      })
    }
  }
  const newest = succeeded.at(-1)
  if (newest) useTabs.getState().setActive(newest.tabId)
  return { succeeded, failed }
}
