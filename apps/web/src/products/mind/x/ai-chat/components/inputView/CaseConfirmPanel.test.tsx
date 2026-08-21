// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CaseConfirmPanel } from "./CaseConfirmPanel"

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("CaseConfirmPanel", () => {
  it("renders in normal flow instead of an invisible absolute overlay", () => {
    const { container } = render(
      <CaseConfirmPanel
        operation="add_cases"
        cases={[
          {
            caseId: "case-1",
            caseText: "[P1] 登录",
            steps: ["点击 & 成功"],
            operation: "add",
          },
        ]}
        onConfirm={vi.fn()}
      />
    )

    const panelHost = container.firstElementChild
    expect(panelHost?.classList.contains("absolute")).toBe(false)
    expect(screen.getByText("登录")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "mindmap.aiChat.input.caseConfirmAccept" })
    ).toBeTruthy()
  })
})
