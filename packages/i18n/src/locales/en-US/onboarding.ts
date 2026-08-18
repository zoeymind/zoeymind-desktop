/**
 * @zoeymind/i18n core resources — onboarding (en-US)
 *
 * This file is the source of truth for this namespace.
 */

export default {
  welcomeTitle: 'Welcome',
  welcomeSubtitle: "Let's spend a minute to set up your account",
  profileTitle: 'Tell us about you',
  profileSubtitle: 'Help others find and recognize you',
  accountTypeTitle: 'How will you use this?',
  accountTypeSubtitle: 'You can create a team anytime later',
  accountTypePersonal: 'For myself',
  accountTypePersonalDesc: 'Personal notes, ideas, learning',
  accountTypeTeam: 'For a team',
  accountTypeTeamDesc: 'Work with teammates',
  finishOnboarding: 'Get started',
  onboardingComplete: 'Welcome aboard!',
  saving: 'Saving…',
  step: {
    accountType: 'Account type',
    createTeam: 'Create team',
    inviteMembers: 'Invite members'
  },
  accountType: {
    question: 'How will you use this?',
    questionSubtitle: 'You can create or join a team anytime — pick whichever fits best now',
    personalLabel: 'For myself',
    personalDesc: 'Organize my own ideas and notes',
    teamLabel: 'I have a team',
    teamDesc: 'Collaborate and share projects with teammates'
  },
  createTeam: {
    title: 'Create your team',
    subtitle: 'Just give it a name'
  },
  inviteMembers: {
    title: 'Invite teammates',
    subtitle: "Enter your teammates' emails. You can invite more later, or skip.",
    emailsLabel: 'Member emails',
    emailsPlaceholder: 'a@example.com\nb@example.com\n(separated by comma, space, or newline)',
    skip: 'Skip',
    sending: 'Sending…',
    sendCount: 'Send {{count}} invitation(s)',
    sentOk: 'Sent {{count}} invitation(s)',
    sentMixed: 'Sent {{ok}} invitation(s), {{failed}} failed',
    sentAllFailed: '{{count}} invitation(s) failed to send',
    teamMissing: 'Team not created yet, cannot invite',
    failed: 'Failed to send invitations'
  },
  profile: {
    title: 'Complete your profile',
    subtitle: 'This is shown to your collaborators — you can edit it later in personal settings',
    username: 'Username',
    usernamePlaceholder: 'e.g. zoey-zhang',
    usernameHelp: 'Used in URLs and @mentions — letters, digits, underscores, or hyphens only',
    usernameMinLength: 'Username must be at least 2 characters',
    usernameInvalid: 'Username allows only letters, digits, underscores, and hyphens',
    displayName: 'Display name',
    displayNamePlaceholder: 'How would you like to be called?'
  },
  wizard: {
    teamInfoLost: 'Team info lost, please retry',
    completeFailed: 'Failed to finish setup'
  },
  setup: {
    title: 'Create admin account',
    subtitle:
      'On first launch you only need to create the platform admin. Everything else can be configured later in the admin panel.',
    doneTitle: 'Initialization complete',
    doneDesc:
      'Admin account created; the setup channel is now closed.\nUnconfigured items can be filled later under Admin → System Settings.',
    toLogin: 'Go to login',
    admin: {
      username: 'Admin username',
      usernamePlaceholder: 'admin',
      usernameMin: 'Username must be at least 3 characters',
      usernameMax: 'Username must be at most 32 characters',
      usernamePattern: 'Username may contain letters, digits, underscore, and dash only',
      password: 'Admin password',
      passwordPlaceholder: 'At least 8 characters',
      passwordMin: 'Password must be at least 8 characters',
      passwordMax: 'Password must be at most 128 characters',
      email: 'Admin email (optional)',
      emailPlaceholder: 'admin@example.com',
      emailInvalid: 'Invalid email format',
      companyName: 'Organization name (optional)',
      companyNamePlaceholder: 'e.g. My Company',
      companyNameHelp: 'Leave blank to use the username as the org name',
      allowRegistration: 'Allow public registration',
      allowRegistrationHelp:
        'When off, only admins can create accounts. Change later in system settings.',
      creating: 'Creating…',
      submit: 'Create admin',
      createFailed: 'Failed to create admin'
    }
  }
} as const
