import { describe, expect, it, vi } from "vitest"
import { createAppVersionStore, type AppUpdater } from "./app-version-store"

function updater(overrides: Partial<AppUpdater> = {}): AppUpdater {
  return {
    currentVersion: vi.fn(async () => "1.4.184"),
    check: vi.fn(async () => null),
    install: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe("application updater", () => {
  it("reports an available signed update with its release notes", async () => {
    const service = updater({
      check: vi.fn(async () => ({
        version: "1.4.185",
        body: "Reliability improvements",
        date: "2026-08-20T00:00:00Z",
      })),
    })
    const store = createAppVersionStore(service)

    await store.getState().checkForUpdates()

    expect(store.getState()).toMatchObject({
      status: "available",
      currentVersion: "1.4.184",
      update: { version: "1.4.185", body: "Reliability improvements" },
    })
  })

  it("downloads, installs, and requests restart after document safety succeeds", async () => {
    const install = vi.fn(
      async (onProgress: (downloaded: number, total: number | null) => void) => {
        onProgress(50, 100)
      }
    )
    const service = updater({
      check: vi.fn(async () => ({ version: "1.4.185" })),
      install,
    })
    const prepare = vi.fn(async () => undefined)
    const store = createAppVersionStore(service, prepare)
    await store.getState().checkForUpdates()

    await store.getState().installUpdate()

    expect(prepare).toHaveBeenCalledOnce()
    expect(install).toHaveBeenCalledOnce()
    expect(store.getState()).toMatchObject({ status: "restart-required", progress: 100 })

    const restart = vi.fn(async () => undefined)
    const restartStore = createAppVersionStore({ ...service, restart }, prepare)
    await restartStore.getState().checkForUpdates()
    await restartStore.getState().installUpdate()
    await restartStore.getState().restart()

    expect(prepare).toHaveBeenCalledTimes(3)
    expect(restart).toHaveBeenCalledOnce()
  })

  it("keeps check failures distinct from an up-to-date result", async () => {
    const service = updater({ check: vi.fn(async () => Promise.reject(new Error("offline"))) })
    const store = createAppVersionStore(service)

    await store.getState().checkForUpdates()

    expect(store.getState()).toMatchObject({ status: "unavailable", error: "offline" })
  })
})
