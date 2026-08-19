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
  appVersion: {
    version: "版本",
    updateAvailable: "有新版本",
    latestAvailable: "最新版本 v{{version}} 已发布",
    viewRelease: "查看更新",
    upToDate: "已是最新版本",
  },
  projects: {
    dialogs: {
      removeTitle: "从 ZoeyMind 中移除“{{itemName}}”？",
      removeDescription: "只会移除项目索引，不会删除磁盘上的 .zmind 文件。",
      removeAction: "移除",
    },
  },
  windowClose: {
    title: "{{count}} 个文件有未保存的修改",
    description: "关闭窗口前，请选择保存全部、全部不保存或取消。",
    saveAll: "保存全部",
    discardAll: "全部不保存",
    saveFailed: "部分文件保存失败，窗口仍保持打开。",
  },
  fileConflict: {
    title: "文件已在磁盘上发生变化",
    description: "请选择重新加载磁盘版本、保存当前内容为副本，或明确覆盖磁盘文件。",
    reload: "重新加载",
    saveCopy: "保存副本",
    overwrite: "覆盖磁盘文件",
  },
  fileRepair: {
    title: "找不到原文件",
    missingDescription: "原文件已被移动、重命名或删除。请定位文件，或从 ZoeyMind 中移除该项目。",
    locate: "定位文件",
    remove: "从 ZoeyMind 中移除",
  },
  recovery: {
    title: "检测到 {{count}} 个包含未保存修改的文件",
    description: "应用上次未正常关闭。可以取消并保留全部记录，或一次恢复所有文件。",
    untitled: "未命名思维导图",
    sourceMissing: "原文件不可用，将自动保存到 ZoeyMind 文件夹",
    restoreAll: "恢复全部",
    restoring: "正在恢复…",
    corruptCount: "另有 {{count}} 个恢复记录已损坏，将继续保留。",
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
