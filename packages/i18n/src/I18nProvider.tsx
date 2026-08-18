/**
 * I18nProvider — 4 app 顶层挂一次, 提供 i18n context.
 *
 * 用法:
 *   <I18nProvider resources={appLocales}>
 *     ...
 *   </I18nProvider>
 *
 * resources 是 app 专属 namespace (mindmap / qms / kb / projects).
 * 核心 namespace (common / auth / ...) 由 @zoeymind/i18n 内置, 不需要 app 传.
 *
 * 初始化是 idempotent (内部 i18next.init() 只跑一次), 多 app / HMR 安全.
 */

import { useMemo, type ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { initI18n, type AppLocaleResources } from './setup'

export function I18nProvider({
  children,
  resources
}: {
  children: ReactNode
  resources?: AppLocaleResources
}) {
  const i18n = useMemo(() => initI18n(resources), [resources])
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
