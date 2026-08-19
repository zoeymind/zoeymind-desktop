/**
 * 跨产品共享文案。原先 mind / qms / admin 各存一份完全相同的副本。
 */

export default {
  settings: {
    title: '设置',
    preferences: '偏好设置',
    language: '语言',
    languageDescription: '选择应用界面使用的语言。',
    theme: '主题',
    themeDescription: '选择明暗模式和界面配色预设。',
    editor: '编辑器',
    providers: '服务商',
    models: '模型',
    about: '关于'
  },
  notifications: {
    bell: {
      title: '通知',
      ariaLabel: '通知',
      markAllRead: '全部已读',
      empty: '暂无通知'
    },
    // 通知类型 — 与后端 enum NotificationType 一一对应, 用于偏好矩阵每行的标题
    type: {
      COMMENT_MENTION: {
        label: '评论提到我',
        description: '有人在缺陷或任务的评论里 @ 我'
      },
      ORG_INVITATION: {
        label: '团队邀请',
        description: '收到加入团队的邀请'
      },
      JOIN_REQUEST: {
        label: '加入申请',
        description: '有人申请加入我管理的团队'
      },
      JOIN_REQUEST_RESULT: {
        label: '申请结果',
        description: '我的加入申请被通过或拒绝'
      },
      ANNOUNCEMENT: {
        label: '系统公告',
        description: '平台发布的公告与维护通知'
      }
    },
    preferences: {
      title: '通知偏好',
      subtitle: '按类型设置各渠道的通知开关. 未配置的渠道不显示.',
      col: {
        type: '类型',
        inApp: '站内',
        email: '邮件'
      },
      channel: {
        'in-app': '站内',
        email: '邮件',
        'feishu-bot': '飞书',
        'dingtalk-bot': '钉钉',
        'wecom-bot': '企微',
        webhook: 'Webhook'
      }
    }
  }
} as const
