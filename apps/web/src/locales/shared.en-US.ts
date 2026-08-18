/**
 * 跨产品共享文案。原先 mind / qms / admin 各存一份完全相同的副本。
 */

export default {
  notifications: {
    bell: {
      title: 'Notifications',
      ariaLabel: 'Notifications',
      markAllRead: 'Mark all read',
      empty: 'No notifications'
    },
    // Notification types — mirrors backend enum NotificationType
    type: {
      COMMENT_MENTION: {
        label: 'Mentions',
        description: 'Someone @-mentions you in a bug or task comment'
      },
      ORG_INVITATION: {
        label: 'Team invitations',
        description: 'You are invited to join a team'
      },
      JOIN_REQUEST: {
        label: 'Join requests',
        description: 'Someone requests to join a team you manage'
      },
      JOIN_REQUEST_RESULT: {
        label: 'Request outcome',
        description: 'Your join request is approved or declined'
      },
      ANNOUNCEMENT: {
        label: 'Announcements',
        description: 'Platform announcements and maintenance notices'
      }
    },
    preferences: {
      title: 'Notification preferences',
      subtitle: 'Toggle each channel per notification type. Unconfigured channels are hidden.',
      col: {
        type: 'Type',
        inApp: 'In-app',
        email: 'Email'
      },
      channel: {
        'in-app': 'In-app',
        email: 'Email',
        'feishu-bot': 'Feishu',
        'dingtalk-bot': 'DingTalk',
        'wecom-bot': 'WeCom',
        webhook: 'Webhook'
      }
    }
  }
} as const
