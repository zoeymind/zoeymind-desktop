/**
 * 跨产品共享文案。原先 mind / qms / admin 各存一份完全相同的副本。
 */

export default {
  settings: {
    title: "Settings",
    preferences: "Preferences",
    aiModels: "AI Models",
    language: "Language",
    languageDescription: "Choose the language used by the application interface.",
    theme: "Theme",
    themeDescription: "Choose the color mode and interface theme preset.",
    presetDescription: "Choose the color palette used by the application interface.",
    editor: "Editor",
    providers: "Providers",
    models: "Models",
    about: "About",
  },
  appVersion: {
    version: "Version",
    updateAvailable: "Update available",
    latestAvailable: "Version v{{version}} is available",
    viewRelease: "View release",
    upToDate: "Up to date",
  },
  projects: {
    dialogs: {
      removeTitle: "Remove “{{itemName}}” from ZoeyMind?",
      removeDescription: "This removes the project index only. The .zmind file remains on disk.",
      removeAction: "Remove",
    },
  },
  windowControls: {
    groupLabel: "Window controls",
    minimize: "Minimize",
    maximize: "Maximize",
    restore: "Restore",
    close: "Close",
  },
  windowClose: {
    title: "{{count}} files have unsaved changes",
    description: "Before closing, save all files, discard all changes, or cancel.",
    saveAll: "Save all",
    discardAll: "Discard all",
    saveFailed: "Some files could not be saved. The window remains open.",
  },
  fileConflict: {
    title: "The file changed on disk",
    description:
      "Reload the disk version, save the current content as a copy, or explicitly overwrite the disk file.",
    reload: "Reload",
    saveCopy: "Save copy",
    overwrite: "Overwrite disk file",
  },
  fileRepair: {
    title: "Original file not found",
    missingDescription:
      "The file was moved, renamed, or deleted. Locate it or remove the project from ZoeyMind.",
    locate: "Locate file",
    remove: "Remove from ZoeyMind",
  },
  recovery: {
    title: "{{count}} files contain unsaved changes",
    description:
      "The app did not close normally. Cancel to preserve every record, or restore all files now.",
    untitled: "Untitled mind map",
    sourceMissing: "Original file unavailable; a new file will be created in the ZoeyMind folder",
    restoreAll: "Restore all",
    restoring: "Restoring…",
    corruptCount: "{{count}} additional recovery records are corrupt and will be preserved.",
  },
  notifications: {
    bell: {
      title: "Notifications",
      ariaLabel: "Notifications",
      markAllRead: "Mark all read",
      empty: "No notifications",
    },
    // Notification types — mirrors backend enum NotificationType
    type: {
      COMMENT_MENTION: {
        label: "Mentions",
        description: "Someone @-mentions you in a bug or task comment",
      },
      ORG_INVITATION: {
        label: "Team invitations",
        description: "You are invited to join a team",
      },
      JOIN_REQUEST: {
        label: "Join requests",
        description: "Someone requests to join a team you manage",
      },
      JOIN_REQUEST_RESULT: {
        label: "Request outcome",
        description: "Your join request is approved or declined",
      },
      ANNOUNCEMENT: {
        label: "Announcements",
        description: "Platform announcements and maintenance notices",
      },
    },
    preferences: {
      title: "Notification preferences",
      subtitle: "Toggle each channel per notification type. Unconfigured channels are hidden.",
      col: {
        type: "Type",
        inApp: "In-app",
        email: "Email",
      },
      channel: {
        "in-app": "In-app",
        email: "Email",
        "feishu-bot": "Feishu",
        "dingtalk-bot": "DingTalk",
        "wecom-bot": "WeCom",
        webhook: "Webhook",
      },
    },
  },
} as const
