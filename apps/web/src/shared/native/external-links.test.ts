// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import { installExternalLinkBoundary, resolveExternalHttpUrl } from "./external-links"

const { openUrl } = vi.hoisted(() => ({ openUrl: vi.fn() }))
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }))
function setTauriRuntime(enabled: boolean): void {
  const runtimeWindow = window as Window & { __TAURI_INTERNALS__?: object }
  if (enabled) runtimeWindow.__TAURI_INTERNALS__ = {}
  else delete runtimeWindow.__TAURI_INTERNALS__
}

afterEach(() => {
  document.body.replaceChildren()
  setTauriRuntime(false)
  openUrl.mockReset()
})

describe("resolveExternalHttpUrl", () => {
  it("accepts external HTTP links and rejects internal or unsafe URLs", () => {
    expect(resolveExternalHttpUrl("https://example.com/docs", "http://localhost/app")).toBe(
      "https://example.com/docs"
    )
    expect(resolveExternalHttpUrl("/settings", "http://localhost/app")).toBeNull()
    expect(resolveExternalHttpUrl("mailto:test@example.com", "http://localhost/app")).toBeNull()
  })
})

describe("installExternalLinkBoundary", () => {
  it("opens an external anchor with the system opener", () => {
    setTauriRuntime(true)
    const dispose = installExternalLinkBoundary()
    const anchor = document.createElement("a")
    anchor.href = "https://example.com/changelog"
    anchor.append(document.createElement("span"))
    document.body.append(anchor)

    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    anchor.firstElementChild?.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(openUrl).toHaveBeenCalledWith("https://example.com/changelog")
    dispose()
  })

  it("leaves internal links to the app router", () => {
    setTauriRuntime(true)
    const dispose = installExternalLinkBoundary()
    const internal = document.createElement("a")
    internal.href = "/settings"
    document.body.append(internal)
    internal.click()

    expect(openUrl).not.toHaveBeenCalled()
    dispose()
  })

  it("routes modified external clicks through the system opener", () => {
    setTauriRuntime(true)
    const dispose = installExternalLinkBoundary()
    const external = document.createElement("a")
    external.href = "https://example.com"
    document.body.append(external)
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    })
    external.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(openUrl).toHaveBeenCalledWith("https://example.com/")
    dispose()
  })
})
