/**
 * @zoeymind/i18n core resources — ui (zh-CN)
 *
 * @zoeymind/ui 设计系统组件内置文案（默认值 / aria-label / 状态页）。
 * This file is the source of truth for this namespace.
 */

export default {
  theme: {
    light: '亮色模式',
    dark: '暗色模式',
    system: '跟随系统',
    toggle: '切换主题'
  },
  confirmDialog: {
    processing: '处理中...'
  },
  multiSelect: {
    placeholder: '选择...',
    empty: '未找到选项',
    search: '搜索...'
  },
  preview: {
    deleteFile: '删除文件',
    imagePreview: '图片预览',
    previewImage: '预览图片',
    close: '关闭预览'
  },
  error: {
    title: '出现错误',
    description: '抱歉，系统遇到了一些问题，请稍后重试'
  },
  loadingPage: {
    title: '加载中',
    description: '正在为您准备内容，请稍候...'
  },
  loginRequired: {
    title: '需要登录',
    description: '请先登录您的账户以访问此功能',
    action: '立即登录'
  },
  maintenance: {
    title: '系统维护中',
    description: '系统正在进行升级维护，为您带来更好的体验',
    estimatedTime: '预计完成时间:',
    refresh: '刷新页面'
  },
  notFound: {
    title: '页面不存在',
    description: '抱歉，您访问的页面不存在或已被移除',
    back: '返回上页'
  },
  unauthorized: {
    title: '访问受限',
    description: '抱歉，您没有访问此页面的权限，请联系管理员获取访问权限',
    relogin: '重新登录'
  }
} as const
