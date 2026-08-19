import { create } from "zustand"
import {
  loadAppVersionInfo,
  openLatestRelease,
  type LatestRelease,
} from "@/shared/native/app-version"

interface AppVersionState {
  currentVersion: string
  latestRelease: LatestRelease | null
  hasUpdate: boolean
  initialized: boolean
  initialize: () => Promise<void>
  openRelease: () => Promise<void>
}

let initialization: Promise<void> | null = null

export const useAppVersion = create<AppVersionState>((set, get) => ({
  currentVersion: "0.0.0",
  latestRelease: null,
  hasUpdate: false,
  initialized: false,
  initialize: async () => {
    if (initialization) return initialization
    initialization = loadAppVersionInfo()
      .then(info => set({ ...info, initialized: true }))
      .catch(() => set({ initialized: true }))
    return initialization
  },
  openRelease: () => openLatestRelease(get().latestRelease),
}))
