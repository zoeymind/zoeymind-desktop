import { exists, mkdir } from "@tauri-apps/plugin-fs"
import { join } from "@tauri-apps/api/path"
import { createUUID } from "@/shared/app-shared"
import { useTabs } from "@/shared/tabs/store"
import { clearRecovery, readRecoveryBundle, type RecoveryDescriptor } from "./recovery"
import { defaultVaultDir } from "./paths"
import { findByPath, refreshProjectIndex, registerProject } from "./projects-repo"
import { readFileRevision, revisionsEqual } from "./file-revision"
import { writeBundle } from "./zmind-file"

export interface RecoverySuccess {
  recoveryId: string
  projectId: string
  path: string
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

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "Untitled"
}

async function uniquePath(directory: string, name: string, recoveryCopy: boolean): Promise<string> {
  const stem = `${sanitizeFilename(name)}${recoveryCopy ? "-恢复" : ""}`
  for (let index = 1; index < 10_000; index += 1) {
    const suffix = index === 1 ? "" : `-${index}`
    const candidate = await join(directory, `${stem}${suffix}.zmind`)
    if (!(await exists(candidate)) && !(await findByPath(candidate))) return candidate
  }
  throw new Error("无法生成唯一恢复文件名")
}

async function restoreOne(desc: RecoveryDescriptor): Promise<RecoverySuccess> {
  const bundle = await readRecoveryBundle(desc.projectId)
  if (!bundle) throw new Error("恢复文件不存在")

  let path: string
  let existingProjectId: string | null = null
  const sourceExists = desc.sourcePath ? await exists(desc.sourcePath) : false
  const sourceRevision = desc.sourcePath ? await readFileRevision(desc.sourcePath) : null
  const sourceUnchanged =
    !!desc.sourcePath && sourceExists && revisionsEqual(desc.sourceRevision ?? null, sourceRevision)

  if (sourceUnchanged && desc.sourcePath) {
    path = desc.sourcePath
    existingProjectId = (await findByPath(path))?.id ?? null
  } else {
    const directory = await defaultVaultDir()
    if (!(await exists(directory))) await mkdir(directory, { recursive: true })
    path = await uniquePath(directory, desc.name, sourceExists)
  }

  await writeBundle(path, bundle)
  const projectId = existingProjectId ?? createUUID()
  if (existingProjectId) {
    await refreshProjectIndex(existingProjectId, {
      name: bundle.meta.name,
      nodeCount: bundle.meta.nodeCount,
    })
  } else {
    await registerProject({
      id: projectId,
      path,
      name: bundle.meta.name,
      nodeCount: bundle.meta.nodeCount,
    })
  }
  useTabs.getState().openTab({
    id: projectId,
    kind: "file",
    title: bundle.meta.name,
    projectId,
  })
  await clearRecovery(desc.projectId)
  return { recoveryId: desc.projectId, projectId, path, title: bundle.meta.name }
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
  if (newest) useTabs.getState().setActive(newest.projectId)
  return { succeeded, failed }
}
