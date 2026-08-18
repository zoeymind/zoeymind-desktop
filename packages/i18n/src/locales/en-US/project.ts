/**
 * @zoeymind/i18n core resources — project (en-US)
 *
 * A "workspace" is the container for all business data — mindmaps/KBs/QMS
 * projects all live inside a workspace. QMS keeps the old createFirst* keys
 * for compatibility, semantics unified to "workspace".
 */

export default {
  // Generic naming
  workspace: 'Workspace',
  workspacePlural: 'Workspaces',

  // First-run wizard (shared by mind/kb/qms)
  createFirstTitle: 'Create your first workspace',
  createFirstSubtitle:
    'Every piece of data lives inside a workspace. Just give it a name to start.',
  projectName: 'Workspace name',
  projectNamePlaceholder: 'e.g. Mobile App',
  projectDescription: 'Description (optional)',
  projectDescriptionPlaceholder: 'Briefly describe what this workspace is for',
  projectKeyLabel: 'Workspace key',
  projectKeyPlaceholder: 'e.g. ZOEY',
  projectKeyHint:
    'Prefix for bug / test case IDs (e.g. ZOEY-BUG-42). 2-10 uppercase alphanumeric characters, starting with a letter. Cannot be changed once referenced by an ID.',
  createAndEnter: 'Create and continue',
  creating: 'Creating…',
  createSuccess: 'Workspace created!',
  createFailed: 'Failed to create workspace',

  avatarLabel: 'Workspace avatar',
  avatarHint: 'Optional, square image recommended, ≤ 2MB',
  // Top-bar workspace switcher
  switcher: {
    placeholder: 'Select workspace',
    newProject: 'New workspace',
    empty: 'No workspaces yet',
    searchPlaceholder: 'Search workspaces…',
    noMatch: 'No matching workspace',
    mindmapCount_zero: 'No mindmaps',
    mindmapCount_one: '{{count}} mindmap',
    mindmapCount_other: '{{count}} mindmaps',
    mindmapCount: '{{count}} mindmaps',
    manage: 'Manage workspace'
  },

  search: {
    button: 'Search mindmaps',
    title: 'Search mindmaps',
    desc: 'Search across all mindmaps you can access',
    placeholder: 'Type name or description…',
    empty: 'No matching mindmaps',
    recent: 'Recent',
    matches: 'Matches',
    nodeCount: '{{n}} nodes',
    other: 'Other'
  },

  // Empty state (fallback for wizard)
  empty: {
    title: 'No workspaces yet',
    descAdmin: 'Create your first workspace to start organizing your team work',
    descMember: 'You have not been invited to any workspace. Contact your admin.',
    create: 'Create workspace'
  },

  // Workspace member management
  member: {
    title: 'Members',
    add: 'Add member',
    addHint: 'Add a user who is already in this organization to the workspace.',
    selectUser: 'Select user',
    selectUserPlaceholder: 'Pick an organization member',
    selectRole: 'Select role',
    noEligibleUsers: 'No organization members available to add',
    confirmAdd: 'Add',
    added: 'Member added',
    remove: 'Remove',
    removed: 'Member removed',
    roleUpdated: 'Role updated',
    empty: 'No members yet',
    you: 'You',
    creator: 'Creator',
    actions: 'Actions',
    editRole: 'Edit role',
    columnMember: 'Member',
    columnRole: 'Role',
    searchPlaceholder: 'Search members',
    searchInListPlaceholder: 'Search by name or email…',
    removeConfirmTitle: 'Remove member',
    removeConfirmDesc: 'Remove {{name}} from this project? They will lose access to it.',
    allMembersHint:
      'All organization members can read this project by default (Member); admins can assign a project role to each.',
    roleEmpty: 'No members',
    role: {
      OWNER: 'Owner',
      ADMIN: 'Admin',
      MEMBER: 'Member',
      VIEWER: 'Viewer',
      PM: 'Project Manager',
      PRODUCT: 'Product',
      TESTER: 'Tester',
      DEVELOPER: 'Developer',
      GUEST: 'Guest'
    }
  },

  // Project role management
  roles: {
    title: 'Project Roles',
    description:
      'Manage roles and permissions within the project. Built-in roles are read-only; copy them to create custom roles.',
    builtin: 'Built-in',
    custom: 'Custom',
    create: 'New role',
    createFromBuiltin: 'Copy a built-in role',
    edit: 'Edit role',
    delete: 'Delete role',
    deleted: 'Role deleted',
    created: 'Role created',
    updated: 'Role updated',
    nameLabel: 'Role name',
    namePlaceholder: 'e.g. QA Lead',
    baseRoleLabel: 'Based on built-in role',
    permissionsLabel: 'Permissions',
    permissionCount: '{{count}} permissions',
    deleteConfirm: 'Delete this custom role? It cannot be deleted while still in use.',
    empty: 'No custom roles yet',
    resource: {
      bug: 'Bug',
      testCase: 'Test Case',
      testPlan: 'Test Plan',
      testReport: 'Test Report',
      version: 'Version',
      member: 'Member',
      role: 'Role',
      workspace: 'Workspace'
    }
  },

  // Project settings dialog
  settings: {
    subtitle: 'Manage this workspace basic info and members',
    tab: {
      general: 'General',
      members: 'Members',
      roles: 'Roles',
      notifications: 'Notifications',
      bugFields: 'Bug fields'
    },
    updated: 'Saved',
    deleted: 'Project deleted',
    deleteConfirm: 'Delete this workspace? This cannot be undone.',
    basic: 'General',
    readonlyHint: 'Only admins can edit',
    danger: 'Danger zone',
    archive: 'Archive project',
    unarchive: 'Restore project',
    archiveHint: 'Archived projects become read-only and sink to the bottom of the list.',
    unarchiveHint:
      'Restored projects become editable again and are no longer pinned to the bottom.',
    archiveAction: 'Archive',
    unarchiveAction: 'Restore',
    delete: 'Delete project',
    deleteAction: 'Delete',
    deleteHint:
      'All mindmaps / knowledge bases / QMS data under this project are deleted permanently.',
    notifications: {
      feishuTitle: 'Feishu Group Bot Notifications',
      feishuDescription:
        'Configure a Feishu custom bot webhook to push submit/reject/resubmit/pass events to your group',
      configured: 'Feishu notifications configured',
      webhookLabel: 'Webhook URL',
      webhookPlaceholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...',
      helpText: 'Add a custom bot in your Feishu group settings and paste its webhook URL here.',
      viewDocs: 'View docs',
      invalidUrl: 'Invalid webhook URL, it should start with https://open.feishu.cn/open-apis/bot/',
      triggerScenes: 'Trigger scenes',
      sceneSubmit: 'Submit',
      sceneReject: 'Reject',
      sceneResubmit: 'Resubmit',
      scenePass: 'Pass',
      modify: 'Modify',
      remove: 'Remove',
      save: 'Save',
      saving: 'Saving…',
      cancel: 'Cancel',
      updateSuccess: 'Feishu notification config updated',
      updateFailed: 'Update failed'
    }
  }
} as const
