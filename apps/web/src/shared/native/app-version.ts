import { getVersion } from "@tauri-apps/api/app"
import { relaunch } from "@tauri-apps/plugin-process"
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater"
import { openUrl } from "@tauri-apps/plugin-opener"

const GITHUB_ORGANIZATION_URL = "https://github.com/zoeymind/zoeymind-desktop"

export interface AvailableAppUpdate {
  version: string
  body?: string
  date?: string
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (version: string): [number, number, number] | null => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim())
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
  }
  const candidateParts = parse(candidate)
  const currentParts = parse(current)
  if (!candidateParts || !currentParts) return false
  return candidateParts.some((part, index) => {
    const priorPartsMatch = candidateParts
      .slice(0, index)
      .every((value, prior) => value === currentParts[prior])
    return priorPartsMatch && part > currentParts[index]
  })
}

let pendingUpdate: Update | null = null
let cancellationToken: { cancelled: boolean } | null = null

export async function getCurrentAppVersion(): Promise<string> {
  return getVersion()
}

export async function checkForAppUpdate(): Promise<AvailableAppUpdate | null> {
  pendingUpdate?.close()
  pendingUpdate = await check({ timeout: 10_000 })
  if (!pendingUpdate) return null
  return {
    version: pendingUpdate.version,
    body: pendingUpdate.body,
    date: pendingUpdate.date,
  }
}

export async function installAppUpdate(
  onProgress: (downloaded: number, total: number | null) => void
): Promise<void> {
  if (!pendingUpdate) throw new Error("No application update is ready to install")
  const token = { cancelled: false }
  cancellationToken = token
  let downloaded = 0
  let total: number | null = null
  try {
    await pendingUpdate.download((event: DownloadEvent) => {
      if (token.cancelled) throw new Error("UPDATE_CANCELLED")
      if (event.event === "Started") {
        total = event.data.contentLength ?? null
        onProgress(0, total)
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength
        onProgress(downloaded, total)
      }
    })
    if (token.cancelled) throw new Error("UPDATE_CANCELLED")
    await pendingUpdate.install()
  } finally {
    if (cancellationToken === token) cancellationToken = null
  }
}

export function cancelAppUpdate(): void {
  if (cancellationToken) cancellationToken.cancelled = true
  pendingUpdate?.close()
  pendingUpdate = null
}

export function isAppUpdateCancelledError(error: unknown): boolean {
  return error instanceof Error && error.message === "UPDATE_CANCELLED"
}

export async function restartApp(): Promise<void> {
  await relaunch()
}

export function openGitHubSupport(): Promise<void> {
  return openUrl(GITHUB_ORGANIZATION_URL)
}
