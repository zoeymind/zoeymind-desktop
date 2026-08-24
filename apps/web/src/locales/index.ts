/**
 * App locales — 桌面端只留 mindmap 域 + 共享词条。
 */

import type { AppLocaleResources } from "@zoeymind/i18n"

import sharedZh from "./shared.zh-CN"
import sharedEn from "./shared.en-US"
import mindZh from "@/products/mind/locales/zh-CN"
import mindEn from "@/products/mind/locales/en-US"

export const appLocales: AppLocaleResources = {
  "zh-CN": { ...sharedZh, ...mindZh },
  "en-US": { ...sharedEn, ...mindEn },
}
