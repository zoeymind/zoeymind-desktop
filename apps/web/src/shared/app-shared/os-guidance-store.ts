import { create } from "zustand"
import { useAppVersion } from "./app-version-store"

export type PlatformId = "macos" | "windows" | "linux" | "unknown"

/**
 * Platform detection from userAgent. Unlike CPU architecture, macOS/Windows/Linux
 * are reported truthfully in the UA string — no need for a native plugin call.
 */
export function detectPlatformSync(): PlatformId {
  const ua = navigator.userAgent
  if (/Mac OS X|Macintosh/i.test(ua)) return "macos"
  if (/Windows/i.test(ua)) return "windows"
  if (/Linux/i.test(ua)) return "linux"
  return "unknown"
}

export const FIRST_RUN_STORAGE_KEY = "zoeymind:first-run-guidance:v1"
export const UPDATE_PREVIEW_ACK_KEY = "zoeymind:update-preview-ack:v1"

interface InstallGateState {
  windowsPreviewOpen: boolean
  requestInstall: () => Promise<void>
  confirmWindowsPreview: (remember: boolean) => void
  cancelWindowsPreview: () => void
}

export const useInstallGate = create<InstallGateState>(set => ({
  windowsPreviewOpen: false,
  requestInstall: async () => {
    if (detectPlatformSync() !== "windows") {
      await useAppVersion.getState().installUpdate()
      return
    }
    const acknowledged = localStorage.getItem(UPDATE_PREVIEW_ACK_KEY)
    if (acknowledged) {
      await useAppVersion.getState().installUpdate()
      return
    }
    set({ windowsPreviewOpen: true })
  },
  confirmWindowsPreview: remember => {
    if (remember) localStorage.setItem(UPDATE_PREVIEW_ACK_KEY, "1")
    set({ windowsPreviewOpen: false })
    void useAppVersion.getState().installUpdate()
  },
  cancelWindowsPreview: () => set({ windowsPreviewOpen: false }),
}))

export function useUpdateInstallGate() {
  return useInstallGate(state => state.requestInstall)
}
