/**
 * @zoeymind/i18n core resources — org (en-US)
 *
 * This file is the source of truth for this namespace.
 */

export default {
  organization: 'Organization',
  personal: 'Personal',
  team: 'Team',
  createTeam: 'Create team',
  createTeamSubtitle: 'Give it a name, you can invite members later',
  teamName: 'Team name',
  teamNamePlaceholder: 'e.g. Acme Inc',
  createTeamAction: 'Create team',
  inviteMembers: 'Invite members',
  inviteMembersSubtitle: 'Invite your teammates by email',
  skipForNow: 'Skip for now',
  selectPlan: 'Choose a plan',
  selectPlanSubtitle: 'Pick a plan that fits your team',
  teamCreatedSuccess: 'Team created!',
  settings: 'Settings',
  members: 'Members',
  role: 'Role',
  leave: 'Leave team',
  deleteOrg: 'Delete team',
  accountMenu: 'Account',
  switchOrg: 'Switch organization',
  addOrg: 'Create team',
  roleLabel: {
    OWNER: 'Owner',
    ADMIN: 'Admin',
    MEMBER: 'Member',
    GUEST: 'Guest'
  },
  roleDesc: {
    OWNER: 'Full control of the organization',
    ADMIN: 'Can manage members and project settings',
    MEMBER: 'Can access and edit project content',
    GUEST: 'Can only view authorized content'
  },
  invite: {
    invalidTitle: 'Invalid invitation',
    invalidDesc: 'Unable to load invitation info. Please check the link.',
    notFoundTitle: 'Invitation not found',
    notFoundDesc: 'This invitation link does not exist or has been revoked.',
    expiredTitle: 'Invitation expired',
    expiredDesc:
      'This invitation link has expired. Please ask an organization admin for a new one.',
    backHome: 'Back to home',
    invitedTitle: 'You are invited to join an organization',
    loginToAccept: 'Please sign in or register to accept the invitation',
    orgLabel: 'Organization',
    inviterLabel: 'Invited by',
    orgAdmin: 'Organization admin',
    assignedRole: 'Assigned role',
    validity: 'Valid until',
    expiresIn: 'Expires {{time}}',
    registerNew: 'Create a new account',
    haveAccount: 'Already have an account? Sign in',
    acceptSuccess: 'Invitation accepted! Redirecting…',
    acceptFailed: 'Failed to accept the invitation. Please try again later.',
    emailMismatchTitle: 'Email mismatch',
    emailMismatchDesc:
      'Your current account email does not match the invited email. Please switch to the invited email and try again.',
    emailMismatchDetail:
      'Your current account email {{currentEmail}} does not match the invited email {{invitedEmail}}. Please switch accounts and try again.',
    alreadyMember: 'You are already a member of this organization. Returned to home.',
    cannotVerifyTitle: 'Cannot verify email',
    cannotVerifyDesc:
      'Your current account has no email bound, so this invitation cannot be accepted. Please sign in with the invited email.',
    rejected: 'You have declined the invitation',
    switchAccount: 'Sign in with another account',
    registerWithInviteEmail: 'Register with the invited email',
    welcomeTitle: 'Welcome aboard!',
    joinedOrg: 'You have joined {{name}}',
    orgFallback: 'the organization',
    redirecting: 'Redirecting to the organization…',
    joinTitle: 'Join {{name}}',
    orgDescFallback: 'You are invited to join this organization',
    acceptHint:
      'After accepting, you will be able to access this organization’s projects and resources. If you have questions, please contact the inviter.',
    joining: 'Joining…',
    acceptInvite: 'Accept invitation',
    reject: 'Decline'
  }
} as const
