/**
 * 应用数据目录路径解析。所有路径都是绝对路径（Tauri 侧解析）。
 *
 * 默认 vault = `<appData>/mindmaps/`；用户可以把 .zmind 文件放在磁盘任意位置，
 * 索引里记的是绝对路径，读的时候只 fs.exists() 判断是否失效。
 */
import { appDataDir, join } from '@tauri-apps/api/path'

export async function defaultVaultDir(): Promise<string> {
  const base = await appDataDir()
  return join(base, 'mindmaps')
}

export async function configFilePath(name: string): Promise<string> {
  const base = await appDataDir()
  return join(base, name)
}
