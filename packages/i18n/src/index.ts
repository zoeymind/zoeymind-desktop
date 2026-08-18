/**
 * @zoeymind/i18n — 通用国际化包.
 *
 * 4 app 共享; 包含中英文 (zh-CN / en-US) 资源, 单 namespace `translation`.
 *
 * 集成方式:
 *   1. App.tsx 顶层包 <I18nProvider resources={appLocales}>
 *      其中 appLocales 来自该 app 的 src/locales/index.ts.
 *   2. 组件内 const { t } = useTranslation()  →  t('common.confirm')
 *   3. 切换语言 const change = useChangeLocale()  →  change('en-US')
 */

// 触发类型增强
import './types'

export { I18nProvider } from './I18nProvider'
export { useLocale, useChangeLocale } from './hooks'
export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  initI18n,
  i18next,
  type SupportedLocale,
  type AppLocaleResources
} from './setup'

// react-i18next 公共 API 直接 re-export, app 不必装 react-i18next
export { useTranslation, Trans, withTranslation } from 'react-i18next'
