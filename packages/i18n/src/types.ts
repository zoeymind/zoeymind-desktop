/**
 * i18next 类型增强 — 仅设 defaultNS 与 returnNull.
 *
 * 不再绑定 resources 字段: app 资源是运行时注入, 编译期不可能知道 app keys 的 literal union.
 * 加之 TS interface merging 不允许 packages 与 apps 各自增强 `resources` 为不同类型 (TS2717).
 *
 * 后果: t(key: string) 全部合法 (无 key-path autocomplete).
 * Key 拼写防护交给 scripts/check-i18n-keys.mjs (Step 7 of i18n refactor plan).
 */

import 'i18next'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    returnNull: false
  }
}
