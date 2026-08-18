/**
 * i18n 便捷 hooks.
 */

import { useTranslation } from 'react-i18next'
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type SupportedLocale
} from './setup'

/**
 * 拿当前生效语言 (i18n.resolvedLanguage).
 * 总返回 SupportedLocale 之一 (fallback 到 DEFAULT_LOCALE).
 */
export function useLocale(): SupportedLocale {
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? i18n.language
  if (SUPPORTED_LOCALES.includes(lang as SupportedLocale)) {
    return lang as SupportedLocale
  }
  return DEFAULT_LOCALE
}

/**
 * 切换语言; 自动写 localStorage (i18next-browser-languagedetector 内置).
 */
export function useChangeLocale(): (locale: SupportedLocale) => Promise<void> {
  const { i18n } = useTranslation()
  return async (locale: SupportedLocale) => {
    await i18n.changeLanguage(locale)
    // i18next-browser-languagedetector 已 caches: ['localStorage'], 这里二次确认
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    }
  }
}
