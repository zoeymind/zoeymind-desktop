/**
 * @zoeymind/i18n core resources — errors (zh-CN)
 *
 * This file is the source of truth for this namespace.
 */

export default {
  pageNotFoundTitle: '页面不存在',
  pageNotFoundDescription: '您访问的页面不存在或已被移除',
  genericTitle: '出现错误',
  routeErrorDescription: '抱歉,页面加载时遇到了问题。请重试,或返回首页。',
  backAction: '返回',
  refreshAction: '重试',
  homeAction: '回到首页',
  accountDeletedTitle: '账号已被删除',
  accountDeletedDescription: '该账号已被删除或注销，无法继续使用。请切换账号或联系支持。',
  accountDisabledTitle: '账号已停用',
  accountDisabledDescription: '该账号已被停用，暂时无法登录或使用服务。请联系管理员或支持。',
  accountLockedTitle: '账号已锁定',
  accountLockedDescription: '该账号暂时被锁定，请稍后再试或联系支持。',
  switchAccountAction: '切换账号 / 重新登录',
  contactSupportAction: '联系支持',
  sessionExpired: '登录已过期，请重新登录',
  quotaExceeded: '当前套餐已达上限，请升级或释放部分配额后重试。',
  forbidden: '您没有权限访问此资源，请联系管理员',
  resourceNotFound: '请求的资源不存在',
  serverError: '服务器出现错误，请稍后重试',
  gatewayError: '网关错误，请稍后重试',
  serviceUnavailable: '服务暂时不可用，请稍后重试',
  requestTimeout: '请求超时，请检查网络连接'
} as const
