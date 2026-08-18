/**
 * @zoeymind/i18n core resources — auth (en-US)
 */
export default {
  welcomeBack: 'Welcome back',
  login: 'Sign in',
  ssoForcedHint: 'This email must sign in via {{name}}',
  ssoLoginWith: 'Sign in with {{name}}',
  ssoCodeLoginTitle: 'Sign in with company code',
  ssoCodeLoginTrigger: 'Use company code',
  ssoCodeLoginDesc: 'Enter the company code your IT provided to jump directly to your SSO sign-in.',
  ssoCodePlaceholder: 'e.g. acme',
  ssoCodeContinue: 'Continue',
  ssoCodeInvalid: 'No SSO found for this company code — check with your IT admin.',
  ssoRememberedHint: 'Last signed in via {{name}}',
  ssoRememberedContinue: 'Continue with {{name}}',
  ssoRememberedForget: 'No, use another method',
  ssoSwitchTrigger: 'Use another method',
  ssoErrorFallback:
    'SSO sign-in failed: {{code}}. Please verify the company code with your IT admin, or contact your IT admin.',
  ssoPickProviderHint: 'Pick a sign-in method',
  ssoTypeFeishu: 'Feishu',
  ssoTypeWecom: 'WeCom',
  ssoTypeDingtalk: 'DingTalk',
  ssoTypeOidc: 'OIDC',
  ssoTypeSaml: 'SAML',
  ssoTypeGeneric: 'SSO',
  register: {
    consent: {
      prefix: 'I have read and agree to the ',
      terms: 'Terms of Service',
      and: ' and ',
      privacy: 'Privacy Policy'
    },
    stepEmail: {
      title: 'Create account',
      subtitle: 'Enter your email to start registration',
      sending: 'Sending...',
      sendFailed: 'Failed to send verification code',
      inviteCode: 'Invite code',
      inviteCodePlaceholder: 'Enter invite code',
      inviteRequired: 'An invite code is required to register',
      inviteInvalid: 'Invalid or expired invite code'
    },
    stepCode: {
      verifying: 'Verifying...',
      verify: 'Verify',
      resend: 'Resend verification code',
      resent: 'Verification code resent',
      resendFailed: 'Failed to resend',
      codeError: 'Invalid verification code',
      codeLength: 'Code must be 6 digits'
    },
    stepPassword: {
      title: 'Set password',
      subtitle: 'Set your name and login password',
      displayName: 'Display name',
      displayNamePlaceholder: 'Your name',
      passwordPlaceholder: 'At least 6 characters',
      confirmPasswordPlaceholder: 'Enter again',
      saving: 'Saving...',
      submit: 'Complete registration',
      success: 'Registration complete!',
      setPasswordFailed: 'Failed to set password',
      nameRequired: 'Please enter your name',
      nameMaxLength: 'Name must be at most 50 characters',
      passwordMaxLength: 'Password must be at most 50 characters'
    }
  },
  forgotPassword: 'Forgot password?',
  email: 'Email',
  identifier: 'Account',
  identifierPlaceholder: 'Email or username',
  identifierRequired: 'Enter your email or username',
  identifierInvalid:
    'Invalid email, or username may only contain letters/digits/underscore/hyphen (3-32)',
  emailRequiredPlaceholder: 'Enter your email',
  passwordPlaceholder: 'Enter your password',
  loginSubtitle: 'Sign in to your account',
  signingIn: 'Signing in...',
  redirecting: 'Redirecting...',
  agreement:
    'By clicking continue, you agree to our <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>.',
  password: 'Password',
  confirmPassword: 'Confirm password',
  verificationCode: 'Verification code',
  sendCode: 'Send code',
  sendingCode: 'Sending…',
  resendCode: 'Resend',
  resendIn: 'Resend in {{seconds}}s',
  backToLogin: 'Back to sign in',
  noAccount: "Don't have an account?",
  haveAccount: 'Already have an account?',
  signUp: 'Sign up',
  signIn: 'Sign in',
  or: 'or',
  loginWithGoogle: 'Continue with Google',
  loginWithGithub: 'Continue with GitHub',
  loginFailed: 'Sign in failed, please try again',
  invalidEmail: 'Please enter a valid email',
  passwordTooShort: 'Password must be at least 6 characters',
  passwordMismatch: 'Passwords do not match',
  emailNotRegistered: 'This email is not registered, please check or sign up',
  codeSent: 'Verification code sent to {{email}}',
  checkSpam: "Didn't get it? Check your spam folder",
  verifyEmail: 'Verify email',
  forgot: {
    email: {
      title: 'Forgot password',
      subtitle: "Enter your email and we'll send you a code",
      sendFailed: 'Failed to send, please try again'
    },
    code: {
      title: 'Enter code',
      subtitlePrefix: 'Code sent to ',
      invalidLength: 'Code must be 6 digits',
      resendFailed: 'Failed to resend'
    },
    password: {
      title: 'Set new password',
      subtitle: 'Enter your new password',
      newPasswordLabel: 'New password',
      newPasswordPlaceholder: 'At least 6 characters',
      confirmLabel: 'Confirm password',
      confirmPlaceholder: 'Re-enter password',
      submit: 'Reset password',
      submitting: 'Submitting…',
      back: 'Back',
      passwordMin: 'Password must be at least 6 characters',
      passwordMax: 'Password must be at most 50 characters',
      passwordMismatch: 'Passwords do not match',
      resetFailed: 'Failed to reset password',
      resetFailedInvalid: 'Failed to reset, invalid or expired code'
    },
    success: {
      title: 'Password reset successful',
      subtitle: 'Sign in with your new password',
      backToLogin: 'Back to sign in'
    }
  }
} as const
