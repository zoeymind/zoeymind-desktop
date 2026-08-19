/**
 * 容灾快照层 —— 崩溃/异常关闭安全网。
 *
 * 交付契约（后续 Provider 一起实现）：
 *
 *   - 唯一入口写快照 = `writeRecovery(projectId, bundle, sourcePath?)`
 *     Editor 里脏态触发 debounce（默认 5s），以及 window blur / beforeunload
 *     都会调这个函数落 `<appData>/recovery/<projectId>.zmind`。
 *
 *   - 干净保存或干净退出 = `clearRecovery(projectId)`；不要留残余。
 *
 *   - 启动检测 = `listRecoveries()`：读 recovery 目录返回 { projectId, sourcePath, savedAt }[]。
 *     App boot 时若非空，弹 <RecoveryDialog>，用户 Reopen（打开+删recovery）或 Discard（只删）。
 *
 * 存储格式：本身就是 .zmind bundle，多打一个 recovery.json 描述 sourcePath / savedAt / projectId。
 */
import { readDir, exists, mkdir, remove, readFile } from "@tauri-apps/plugin-fs"
import JSZip from "jszip"
import { appDataDir, join } from "@tauri-apps/api/path"
import { packBundle, unpackBundle, type ZMindBundle } from "./zmind-file"
import { readFileRevision, type FileRevision } from "./file-revision"
import { writeBytesAtomically } from "./atomic-file"

const RECOVERY_DIR = "recovery"

async function recoveryDir(): Promise<string> {
  const base = await appDataDir()
  const dir = await join(base, RECOVERY_DIR)
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true })
  }
  return dir
}

async function recoveryPath(projectId: string): Promise<string> {
  const dir = await recoveryDir()
  return join(dir, `${projectId}.zmind`)
}

export interface RecoveryDescriptor {
  projectId: string
  sourcePath: string | null
  savedAt: number
  name: string
  sourceRevision?: FileRevision | null
}

export interface CorruptRecoveryDescriptor {
  filename: string
  message: string
}

export interface RecoveryScan {
  valid: RecoveryDescriptor[]
  corrupt: CorruptRecoveryDescriptor[]
}

export async function writeRecovery(
  projectId: string,
  bundle: ZMindBundle,
  sourcePath: string | null
): Promise<void> {
  const bytes = await packBundle(bundle)
  const zip = await JSZip.loadAsync(bytes)
  const descriptor: RecoveryDescriptor = {
    projectId,
    sourcePath,
    savedAt: Date.now(),
    name: bundle.meta.name,
    sourceRevision: sourcePath ? await readFileRevision(sourcePath) : null,
  }
  zip.file("recovery.json", JSON.stringify(descriptor))
  const out = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })
  await writeBytesAtomically(await recoveryPath(projectId), out)
}

export async function clearRecovery(projectId: string): Promise<void> {
  const path = await recoveryPath(projectId)
  if (await exists(path)) {
    await remove(path)
  }
}

export async function scanRecoveries(): Promise<RecoveryScan> {
  const dir = await recoveryDir()
  const entries = await readDir(dir)
  const valid: RecoveryDescriptor[] = []
  const corrupt: CorruptRecoveryDescriptor[] = []
  for (const entry of entries) {
    if (!entry.name?.endsWith(".zmind")) continue
    try {
      const path = await join(dir, entry.name)
      const bytes = await readFile(path)
      const zip = await JSZip.loadAsync(bytes)
      const descFile = zip.file("recovery.json")
      if (!descFile) throw new Error("missing recovery.json")
      valid.push(JSON.parse(await descFile.async("string")) as RecoveryDescriptor)
    } catch (error) {
      corrupt.push({
        filename: entry.name,
        message: error instanceof Error ? error.message : "invalid recovery file",
      })
    }
  }
  return { valid: valid.sort((a, b) => a.savedAt - b.savedAt), corrupt }
}

export async function listRecoveries(): Promise<RecoveryDescriptor[]> {
  return (await scanRecoveries()).valid
}
/** 弹框里 Reopen 时用：读回 bundle，交给 editor 载入（未 flush 落盘）。 */
export async function readRecoveryBundle(projectId: string): Promise<ZMindBundle | null> {
  const path = await recoveryPath(projectId)
  if (!(await exists(path))) return null
  const bytes = await readFile(path)
  return unpackBundle(bytes)
}
