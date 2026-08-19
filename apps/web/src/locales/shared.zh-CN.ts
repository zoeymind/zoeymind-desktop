/**
 * 跨产品共享文案。原先 mind / qms / admin 各存一份完全相同的副本。
 */

export default {
  settings: {
    title: "设置",
    preferences: "偏好设置",
    aiModels: "AI 模型",
    language: "语言",
    languageDescription: "选择应用界面使用的语言。",
    theme: "主题",
    themeDescription: "选择明暗模式和界面配色预设。",
    presetDescription: "选择应用界面的配色方案。",
    editor: "编辑器",
    providers: "服务商",
    models: "模型",
    about: "关于",
  },
  recovery: {
    title: "检测到 {{count}} 个未保存的编辑",
    description:
      "应用上次未正常关闭。请选择要恢复的草稿；恢复会写回原文件，原文件不可用时将提示另存为。",
    untitled: "未命名思维导图",
    sourceMissing: "原文件不可用，恢复时需要选择保存位置",
    restore: "恢复草稿",
    restoring: "正在恢复…",
    restored: "草稿已恢复",
    restoreFailed: "恢复失败：{{message}}",
    discard: "丢弃",
    discardWarning: "丢弃只会删除容灾草稿，不会修改已有文件；此操作无法撤销。",
  },
  notifications: {
    bell: {
      title: "通知",
      ariaLabel: "通知",
      markAllRead: "全部已读",
      empty: "暂无通知",
    },
    // 通知类型 — 与后端 enum NotificationType 一一对应, 用于偏好矩阵每行的标题
    type: {
      COMMENT_MENTION: {
        label: "评论提到我",
        description: "有人在缺陷或任务的评论里 @ 我",
      },
      ORG_INVITATION: {
        label: "团队邀请",
        description: "收到加入团队的邀请",
      },
      JOIN_REQUEST: {
        label: "加入申请",
        description: "有人申请加入我管理的团队",
      },
      JOIN_REQUEST_RESULT: {
        label: "申请结果",
        description: "我的加入申请被通过或拒绝",
      },
      ANNOUNCEMENT: {
        label: "系统公告",
        description: "平台发布的公告与维护通知",
      },
    },
    preferences: {
      title: "通知偏好",
      subtitle: "按类型设置各渠道的通知开关. 未配置的渠道不显示.",
      col: {
        type: "类型",
        inApp: "站内",
        email: "邮件",
      },
      channel: {
        "in-app": "站内",
        email: "邮件",
        "feishu-bot": "飞书",
        "dingtalk-bot": "钉钉",
        "wecom-bot": "企微",
        webhook: "Webhook",
      },
    },
  },
} as const
