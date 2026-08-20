import { create, type StoreApi, type UseBoundStore } from "zustand"
import {
  checkForAppUpdate,
  getCurrentAppVersion,
  installAppUpdate,
  restartApp,
  type AvailableAppUpdate,
} from "@/shared/native/app-version"
import { prepareForAppRestart } from "@/shared/native/window-close-coordinator"

export type AppUpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "installing"
  | "restart-required"
  | "unavailable"
  | "failed"

export interface AppUpdater {
  currentVersion: () => Promise<string>
  check: () => Promise<AvailableAppUpdate | null>
  install: (onProgress: (downloaded: number, total: number | null) => void) => Promise<void>
  restart?: () => Promise<void>
}

interface AppVersionState {
  currentVersion: string
  update: AvailableAppUpdate | null
  status: AppUpdateStatus
  progress: number | null
  error: string | null
  initialized: boolean
  initialize: () => Promise<void>
  checkForUpdates: () => Promise<void>
  installUpdate: () => Promise<void>
  restart: () => Promise<void>
}

type AppVersionStore = UseBoundStore<StoreApi<AppVersionState>>
type PrepareForRestart = () => Promise<void>

const nativeUpdater: AppUpdater = {
  currentVersion: getCurrentAppVersion,
  check: checkForAppUpdate,
  install: installAppUpdate,
  restart: restartApp,
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createAppVersionStore(
  updater: AppUpdater = nativeUpdater,
  prepare: PrepareForRestart = prepareForAppRestart
): AppVersionStore {
  let operation: Promise<void> | null = null

  const runOnce = (operationFactory: () => Promise<void>): Promise<void> => {
    if (!operation) {
      operation = operationFactory().finally(() => {
        operation = null
      })
    }
    return operation
  }

  return create<AppVersionState>((set, get) => ({
    currentVersion: "0.0.0",
    update: null,
    status: "idle",
    progress: null,
    error: null,
    initialized: false,
    initialize: () =>
      runOnce(async () => {
        const currentVersion = await updater.currentVersion()
        set({ currentVersion, status: "checking", progress: null, error: null })
        try {
          const update = await updater.check()
          set({ update, status: update ? "available" : "up-to-date", initialized: true })
        } catch (error) {
          set({ status: "unavailable", error: messageFrom(error), initialized: true })
        }
      }),
    checkForUpdates: () =>
      runOnce(async () => {
        set({ status: "checking", progress: null, error: null })
        try {
          const currentVersion =
            get().currentVersion === "0.0.0" ? await updater.currentVersion() : get().currentVersion
          const update = await updater.check()
          set({
            currentVersion,
            update,
            status: update ? "available" : "up-to-date",
            initialized: true,
          })
        } catch (error) {
          set({ status: "unavailable", error: messageFrom(error), initialized: true })
        }
      }),
    installUpdate: () =>
      runOnce(async () => {
        if (!get().update || get().status !== "available") return
        set({ status: "downloading", progress: 0, error: null })
        try {
          await prepare()
          await updater.install((downloaded, total) => {
            const progress =
              total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null
            const installing = total !== null && downloaded >= total
            set({ status: installing ? "installing" : "downloading", progress })
          })
          set({ status: "restart-required", progress: 100 })
        } catch (error) {
          set({ status: "failed", error: messageFrom(error) })
        }
      }),
    restart: async () => {
      if (!updater.restart || get().status !== "restart-required") return
      try {
        await prepare()
        await updater.restart()
      } catch (error) {
        set({ status: "failed", error: messageFrom(error) })
      }
    },
  }))
}

export const useAppVersion = createAppVersionStore()
