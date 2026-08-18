/**
 * @zoeymind/i18n core resources — errors (en-US)
 *
 * This file is the source of truth for this namespace.
 */

export default {
  pageNotFoundTitle: 'Page not found',
  pageNotFoundDescription: "The page you're looking for doesn't exist or has been moved.",
  genericTitle: 'Something went wrong',
  routeErrorDescription: 'Sorry, the page failed to load. Try again or go back home.',
  backAction: 'Back',
  refreshAction: 'Retry',
  homeAction: 'Go home',
  accountDeletedTitle: 'Account deleted',
  accountDeletedDescription:
    'This account has been deleted or closed and can no longer be used. Please switch accounts or contact support.',
  accountDisabledTitle: 'Account disabled',
  accountDisabledDescription:
    'This account has been disabled and cannot sign in or use services right now. Please contact an admin or support.',
  accountLockedTitle: 'Account locked',
  accountLockedDescription:
    'This account is temporarily locked. Please try again later or contact support.',
  switchAccountAction: 'Switch account / Sign in again',
  contactSupportAction: 'Contact support',
  sessionExpired: 'Your session has expired. Please sign in again.',
  quotaExceeded: 'You have reached your plan limit. Please upgrade or free up quota and try again.',
  forbidden: 'You do not have permission to access this resource. Please contact an admin.',
  resourceNotFound: 'The requested resource was not found.',
  serverError: 'A server error occurred. Please try again later.',
  gatewayError: 'Gateway error. Please try again later.',
  serviceUnavailable: 'The service is temporarily unavailable. Please try again later.',
  requestTimeout: 'The request timed out. Please check your network connection.'
} as const
