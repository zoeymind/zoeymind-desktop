import { getVersion } from "@tauri-apps/api/app"
import { invoke } from "@tauri-apps/api/core"
import { openUrl } from "@tauri-apps/plugin-opener"

const RELEASES_URL = "https://github.com/zoeymind/zoeymind-desktop/releases"
const GITHUB_ORGANIZATION_URL = "https://github.com/zoeymind"

export interface LatestRelease {
  tagName: string
  htmlUrl: string
  name?: string
  publishedAt?: string
}

export interface AppVersionInfo {
  currentVersion: string
  latestRelease: LatestRelease | null
  hasUpdate: boolean
}

function parseVersion(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate)
  const installed = parseVersion(current)
  if (!next || !installed) return false

  for (let index = 0; index < next.length; index += 1) {
    if (next[index] !== installed[index]) return next[index] > installed[index]
  }
  return false
}

export async function loadAppVersionInfo(): Promise<AppVersionInfo> {
  const currentVersion = await getVersion()
  try {
    const latestRelease = await invoke<LatestRelease>("get_latest_release")
    return {
      currentVersion,
      latestRelease,
      hasUpdate: isNewerVersion(latestRelease.tagName, currentVersion),
    }
  } catch {
    return { currentVersion, latestRelease: null, hasUpdate: false }
  }
}

export function openLatestRelease(release: LatestRelease | null): Promise<void> {
  return openUrl(release?.htmlUrl ?? RELEASES_URL)
}

export function openGitHubSupport(): Promise<void> {
  return openUrl(GITHUB_ORGANIZATION_URL)
}
