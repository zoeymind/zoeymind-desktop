// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const native = vi.hoisted(() => ({
  resolveRecoverySelection: vi.fn(),
  restoreAllRecoveries: vi.fn(),
  scanRecoveries: vi.fn(),
}))

vi.mock("@/shared/native", () => native)
vi.mock("@zoeymind/i18n", () => ({
  useLocale: () => "zh-CN",
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { RecoveryDialog } from "./RecoveryDialog"

const scan = {
  valid: [
    {
      projectId: "recovery-1",
      sourcePath: null,
      savedAt: 1,
      name: "First",
    },
    {
      projectId: "recovery-2",
      sourcePath: "/documents/second.zmind",
      savedAt: 2,
      name: "Second",
    },
  ],
  corrupt: [],
}

describe("RecoveryDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    native.scanRecoveries.mockResolvedValue(scan)
    native.resolveRecoverySelection.mockResolvedValue({ succeeded: [], failed: [] })
  })

  it("restores selected records and discards unselected records", async () => {
    render(<RecoveryDialog />)

    const checkboxes = await screen.findAllByRole("checkbox")
    expect(checkboxes).toHaveLength(2)
    await waitFor(() =>
      expect(checkboxes.every(checkbox => checkbox.getAttribute("aria-checked") === "true")).toBe(
        true
      )
    )

    fireEvent.click(checkboxes[0])
    const resolve = screen.getByRole("button", {
      name: "recovery.restoreSelectedDiscardOthers",
    })
    fireEvent.click(resolve)

    await waitFor(() =>
      expect(native.resolveRecoverySelection).toHaveBeenCalledWith(scan, new Set(["recovery-2"]))
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("turns the action into discard all when nothing is selected", async () => {
    render(<RecoveryDialog />)
    const checkboxes = await screen.findAllByRole("checkbox")
    checkboxes.forEach(checkbox => fireEvent.click(checkbox))

    fireEvent.click(screen.getByRole("button", { name: "recovery.discardAll" }))

    await waitFor(() =>
      expect(native.resolveRecoverySelection).toHaveBeenCalledWith(scan, new Set())
    )
  })
})
