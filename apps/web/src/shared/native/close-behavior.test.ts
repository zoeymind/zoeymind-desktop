import { describe, expect, it } from "vitest"
import { actionAfterGuard, closeButtonAction } from "./close-behavior"

describe("window close behavior", () => {
  it("re-evaluates the close-button policy after dirty sessions are handled", () => {
    expect(actionAfterGuard("close-button", "ask")).toBe("ask")
    expect(actionAfterGuard("close-button", "tray")).toBe("hide-to-tray")
    expect(actionAfterGuard("close-button", "quit")).toBe("allow-close")
  })

  it("keeps explicit tray-menu exit independent from close-button preferences", () => {
    expect(actionAfterGuard("explicit-exit", "ask")).toBe("exit-process")
    expect(actionAfterGuard("explicit-exit", "tray")).toBe("exit-process")
    expect(actionAfterGuard("explicit-exit", "quit")).toBe("exit-process")
  })

  it("maps every persisted close behavior to one action", () => {
    expect(closeButtonAction("ask")).toBe("ask")
    expect(closeButtonAction("tray")).toBe("hide-to-tray")
    expect(closeButtonAction("quit")).toBe("allow-close")
  })
})
