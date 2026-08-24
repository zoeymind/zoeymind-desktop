// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TestCaseStats } from "./TestCaseStats"

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("TestCaseStats", () => {
  it("shows priority counts rather than percentages", () => {
    render(<TestCaseStats total={10} p1={2} p2={3} p3={5} />)
    fireEvent.mouseEnter(screen.getByLabelText("mindmap.canvasTool.testCaseStats"))

    expect(screen.getByText("P1").parentElement?.textContent).toBe("P12")
    expect(screen.getByText("P2").parentElement?.textContent).toBe("P23")
    expect(screen.getByText("P3").parentElement?.textContent).toBe("P35")
    expect(screen.queryByText(/%/)).toBeNull()
  })
})
