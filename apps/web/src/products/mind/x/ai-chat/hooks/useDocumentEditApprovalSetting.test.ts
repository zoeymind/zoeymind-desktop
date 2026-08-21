// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import {
  getDocumentEditApprovalEnabled,
  setDocumentEditApprovalEnabled,
} from "./useDocumentEditApprovalSetting"

describe("edit review setting", () => {
  beforeEach(() => window.localStorage.clear())

  it("is enabled by default and follows the existing case review preference", () => {
    expect(getDocumentEditApprovalEnabled()).toBe(true)
    setDocumentEditApprovalEnabled(false)
    expect(getDocumentEditApprovalEnabled()).toBe(false)
    expect(window.localStorage.getItem("ai-case-review-enabled")).toBe("false")
  })
})
