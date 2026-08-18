/**
 * @zoeymind/i18n core resources — account (en-US)
 *
 * This file is the source of truth for this namespace.
 */

export default {
  dialog: {
    title: 'Account'
  },
  menu: {
    newOrg: 'Create team',
    orgSettings: 'Organization settings',
    personal: 'Personal',
    settings: 'Account settings',
    team: 'Team',
    unknownUser: 'Unknown user'
  },
  password: {
    confirmLabel: 'Confirm new password',
    currentLabel: 'Current password',
    currentRequired: 'Please enter your current password',
    mismatch: 'Passwords do not match',
    newLabel: 'New password',
    newPlaceholder: 'At least 6 characters',
    submit: 'Change password',
    submitting: 'Saving...',
    subtitle: 'Update your password regularly to keep your account secure',
    title: 'Change Password',
    tooShort: 'New password must be at least 6 characters',
    updated: 'Password updated'
  },
  profile: {
    avatar: 'Avatar',
    avatarAlt: 'User',
    avatarHint: 'JPG / PNG, max 2 MB',
    avatarUpdated: 'Avatar updated',
    avatarUploadFailed: 'Failed to upload avatar',
    emailLabel: 'Email',
    emailUnset: 'Not set',
    imageTooLarge: 'Image must be smaller than 2 MB',
    invalidImage: 'Please select an image file',
    nameLabel: 'Display name',
    nameRequired: 'Display name is required',
    save: 'Save changes',
    saving: 'Saving...',
    subtitle: 'Manage your personal information',
    title: 'Profile',
    updated: 'Profile updated',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Optional'
  },
  sessions: {
    confirmAction: 'Sign out session',
    confirmDesc: 'This will immediately invalidate the session.',
    confirmTitle: 'Sign out this session?',
    current: 'Current session',
    empty: 'No active sessions',
    item: 'Session',
    revoke: 'Sign out',
    subtitle: 'View and manage your active sign-in sessions',
    title: 'Active Sessions',
    colDevice: 'Device',
    colIp: 'IP',
    colStatus: 'Status',
    colAction: 'Action'
  },
  loginHistory: {
    title: 'Recent Logins',
    subtitle: 'Your recent sign-in attempts',
    empty: 'No login history',
    success: 'Success',
    failed: 'Failed',
    colTime: 'Time',
    colSource: 'IP / Device',
    colStatus: 'Status'
  },
  tab: {
    profile: 'Profile',
    security: 'Security',
    notifications: 'Notifications',
    approvals: 'Approvals',
    apiTokens: 'API Tokens'
  },
  apiTokens: {
    sectionTitle: 'API Tokens',
    sectionDesc:
      'Personal API tokens for MCP clients (Cursor / Claude Desktop, etc.) to act on your behalf against your mindmaps. Each token represents you; permissions follow your membership in each team.',
    nameLabel: 'Name',
    namePlaceholder: 'e.g. Claude MCP',
    nameRequired: 'Please enter a token name',
    createBtn: 'Create Token',
    createFailed: 'Create failed',
    listTitle: 'Existing Tokens',
    listLoading: 'Loading...',
    listEmpty: 'No tokens',
    createdAtPrefix: 'Created ',
    lastUsedPrefix: 'Last used: ',
    createdDialogTitle: 'Token Created',
    createdDialogWarn:
      'Please copy and save it now. This token is shown only once and cannot be viewed again after closing.',
    acknowledge: "I've copied and saved it",
    deleteTitle: 'Delete Token',
    deleteDesc:
      'Deleting will immediately revoke access for any client using this token. This cannot be undone.',
    deleteAction: 'Delete',
    deleteSuccess: 'Token deleted',
    renameTitle: 'Rename Token',
    renamed: 'Renamed',
    saveAction: 'Save',
    connInfoTitle: 'Connection Instructions',
    connInfoDesc: 'Configure the MCP service in Claude Desktop or Cursor.'
  }
} as const
