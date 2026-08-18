/**
 * i18n 实例工厂 — 4 app 共享同一份 i18n state.
 *
 * 启动顺序: <I18nProvider resources={appLocales}> → 内部 initI18n() 注入 app-级 namespace.
 * 多次调用安全; HMR 重渲染时 resources 通过 addResourceBundle 合并进单例实例.
 *
 * 语言检测顺序 (i18next-browser-languagedetector):
 *   1. localStorage['i18nextLng']  ← 用户手动切换语言写这里
 *   2. navigator.language          ← 浏览器系统语言
 *   3. fallbackLng = 'zh-CN'
 */

import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: SupportedLocale = 'zh-CN'
export const LOCALE_STORAGE_KEY = 'i18nextLng'

/**
 * App-level locale bundles — merged on top of the core namespaces at the top level.
 * Top-level keys (e.g. `mindmap`, `qms`) MUST NOT collide with core (`common`, `auth`, ...).
 */
export interface AppLocaleResources {
  'zh-CN': Record<string, unknown>
  'en-US': Record<string, unknown>
}

let initialized = false

/**
 * Initialize the i18next singleton; safe to call multiple times.
 * On the first call, options + core resources + optional appResources are bound.
 * Subsequent calls keep the existing instance and merge any new `appResources`
 * via `addResourceBundle` (deep + overwrite) so HMR-rerendered providers stay consistent.
 */
export function initI18n(appResources?: AppLocaleResources): typeof i18next {
  if (initialized) {
    if (appResources) registerAppResources(appResources)
    return i18next
  }

  i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        'zh-CN': { translation: { ...zhCN, ...(appResources?.['zh-CN'] ?? {}) } },
        'en-US': { translation: { ...enUS, ...(appResources?.['en-US'] ?? {}) } }
      },
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES,
      ns: ['translation'],
      defaultNS: 'translation',
      // 文案小, 全 bundle 进, 不用 Suspense
      react: { useSuspense: false },
      interpolation: {
        // react 已自动 escape, i18next 不需要再 escape
        escapeValue: false
      },
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: LOCALE_STORAGE_KEY,
        caches: ['localStorage']
      }
    })

  initialized = true
  return i18next
}

function registerAppResources(res: AppLocaleResources) {
  // deep=true (merge), overwrite=true (app wins for matching subtrees).
  // Core 与 app 的顶层 namespace 不重叠 (mindmap/qms/kb/projects vs common/auth/...).
  i18next.addResourceBundle('zh-CN', 'translation', res['zh-CN'], true, true)
  i18next.addResourceBundle('en-US', 'translation', res['en-US'], true, true)
}

export { i18next }
