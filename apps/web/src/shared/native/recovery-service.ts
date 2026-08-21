import { useTabs } from "@/shared/tabs/store"
import {
  clearCorruptRecovery,
  clearRecovery,
  readRecoveryBundle,
  type RecoveryDescriptor,
  type RecoveryScan,
} from "./recovery"
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

/** 用户明确放弃本批容灾数据；所有记录成功删除后，启动弹窗才可关闭。 */
export async function discardRecoveryScan(scan: RecoveryScan): Promise<void> {
  await Promise.all([
    ...scan.valid.map(descriptor => clearRecovery(descriptor.projectId)),
    ...scan.corrupt.map(descriptor => clearCorruptRecovery(descriptor.filename)),
  ])
}

/** 恢复所选记录，并永久丢弃其余记录；恢复失败的所选记录继续保留。 */
export async function resolveRecoverySelection(
  scan: RecoveryScan,
  selectedProjectIds: ReadonlySet<string>
): Promise<RecoveryBatchResult> {
  const selected = scan.valid.filter(descriptor => selectedProjectIds.has(descriptor.projectId))
  const discarded = scan.valid.filter(descriptor => !selectedProjectIds.has(descriptor.projectId))
  await discardRecoveryScan({ valid: discarded, corrupt: scan.corrupt })
  const result = await restoreAllRecoveries(selected)
  return result
}
