import { describe, expect, it } from "vitest"
import { describeModelLoadError } from "./model-load-error"

describe("describeModelLoadError", () => {
  it("explains an SPA HTML response instead of exposing a JSON parser error", () => {
    expect(
      describeModelLoadError(
        new SyntaxError(`Unexpected token '<', "<!doctype "... is not valid JSON`)
      )
    ).toBe("模型下载源返回了网页而不是模型文件，请检查网络后重试。")
  })

  it("preserves unrelated model errors", () => {
    expect(describeModelLoadError(new Error("network timeout"))).toBe("network timeout")
  })
})
