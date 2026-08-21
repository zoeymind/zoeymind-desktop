import { describe, expect, it } from "vitest"
import { toModelOutput } from "./types"

describe("toModelOutput duration", () => {
  it("keeps tool duration in the persisted compact output", () => {
    expect(toModelOutput({ success: true, data: { message: "完成" }, duration: 425 })).toEqual({
      success: true,
      message: "完成",
      duration: 425,
    })
  })
})
