import { describe, expect, it } from "vitest"
import { createInstance } from "i18next"
import { appLocales } from "./index"
import sharedZh from "./shared.zh-CN"
import sharedEn from "./shared.en-US"
import mindZh from "@/products/mind/locales/zh-CN"
import mindEn from "@/products/mind/locales/en-US"

function leaves(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === "object"
      ? leaves(child as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  )
}

describe("desktop translation resources", () => {
  it.each(["zh-CN", "en-US"] as const)(
    "resolves project removal copy with interpolation in %s",
    async lng => {
      const i18n = createInstance()
      await i18n.init({
        lng,
        fallbackLng: false,
        resources: { [lng]: { translation: appLocales[lng] } },
      })
      expect(i18n.exists("projects.dialogs.removeTitle")).toBe(true)
      expect(i18n.t("projects.dialogs.removeTitle", { itemName: "Checkout" })).toContain("Checkout")
      expect(i18n.exists("projects.dialogs.removeDescription")).toBe(true)
      expect(i18n.exists("projects.dialogs.removeAction")).toBe(true)
    }
  )

  it("keeps every source translation reachable after resource assembly", () => {
    for (const [lng, shared, mind] of [
      ["zh-CN", sharedZh, mindZh],
      ["en-US", sharedEn, mindEn],
    ] as const) {
      const actual = new Set(leaves(appLocales[lng]))
      expect([...leaves(shared), ...leaves(mind)].filter(key => !actual.has(key))).toEqual([])
    }
  })

  it("provides both supported languages for every desktop translation", () => {
    expect(leaves(appLocales["zh-CN"]).sort()).toEqual(leaves(appLocales["en-US"]).sort())
  })
})
