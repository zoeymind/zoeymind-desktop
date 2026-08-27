// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { HelpPage } from "./HelpPage"

vi.mock("@zoeymind/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("./TestCaseRulesPage", () => ({ TestCaseRulesPage: () => null }))

describe("HelpPage For Agent setup", () => {
  const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined)

  beforeEach(() => {
    writeText.mockClear()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
  })

  it("copies the complete cross-agent install and doctor prompt", async () => {
    render(<HelpPage page="agent" onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: /projects.help.forAgent.copy$/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    const prompt = String(writeText.mock.calls[0]?.[0])
    expect(prompt).toContain("@zoeymind/cli@latest @zoeymind/mcp@latest")
    expect(prompt).toContain("skills add zoeymind/zoeymind-desktop")
    expect(prompt).toContain("zoeymind doctor --json")
    expect(prompt).toContain("zoeymind-mcp doctor --json")
    expect(screen.getByText("projects.help.forAgent.copied")).toBeTruthy()
  })
})
