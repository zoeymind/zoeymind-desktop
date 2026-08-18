/**
 * 应用路径解析 —— 桌面端所有关于"文件放哪"的决策集中在这.
 *
 * 保存对话框默认目录三段兜底 (对标 Xmind / MindNode / VS Code):
 *   1. `app_kv.last_save_dir` (上一次成功保存所在目录)
 *   2. `~/Documents/ZoeyMind/` (首次保存的用户可见默认位置)
 *   3. OS Documents 根
 *
 * 之前默认写死 `<appData>/mindmaps/` (~/Library/Application Support/... 隐藏路径),
 * 用户在 Finder 里翻不到, 现在换成用户可见位置.
 */
import { appDataDir, documentDir, join } from '@tauri-apps/api/path'
import { exists, mkdir } from '@tauri-apps/plugin-fs'
import { getDB, execute } from './db'

const LAST_SAVE_DIR_KEY = 'last_save_dir'
const APP_FOLDER_NAME = 'ZoeyMind'

/** appData 目录下的应用内部 vault (recovery / 内部索引仍用这个). */
export async function defaultVaultDir(): Promise<string> {
  const base = await appDataDir()
  return join(base, 'mindmaps')
}

export async function configFilePath(name: string): Promise<string> {
  const base = await appDataDir()
  return join(base, name)
}

/** Documents/ZoeyMind — 首次保存的可见默认位置. */
export async function userVaultDir(): Promise<string> {
  const docs = await documentDir()
  return join(docs, APP_FOLDER_NAME)
}

/** 读 last_save_dir, 无则返回 null. */
async function readLastSaveDir(): Promise<string | null> {
  try {
    const db = await getDB()
    const rows = (await db.select(
      'SELECT value FROM app_kv WHERE key = $1',
      [LAST_SAVE_DIR_KEY]
    )) as Array<{ value: string }>
    return rows[0]?.value ?? null
  } catch {
    return null
  }
}

async function writeLastSaveDir(dir: string): Promise<void> {
  try {
    await execute(
      'INSERT INTO app_kv (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [LAST_SAVE_DIR_KEY, dir]
    )
  } catch {
    /* app_kv 表不可用则忽略 */
  }
}

/**
 * 保存对话框默认目录:
 *   1. last_save_dir (存在且可访问)
 *   2. ~/Documents/ZoeyMind (存在则用, 不在则创建)
 *   3. ~/Documents (OS 默认)
 */
export async function preferredSaveDir(): Promise<string> {
  const last = await readLastSaveDir()
  if (last && (await exists(last).catch(() => false))) return last
  const user = await userVaultDir()
  try {
    if (!(await exists(user))) await mkdir(user, { recursive: true })
    return user
  } catch {
    return await documentDir()
  }
}

/** 保存成功后调用, 记住这次挑选的目录. */
export async function rememberSaveDir(fullPath: string): Promise<void> {
  const idx = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'))
  if (idx < 0) return
  await writeLastSaveDir(fullPath.slice(0, idx))
}
