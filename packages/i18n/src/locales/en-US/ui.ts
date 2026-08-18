/**
 * @zoeymind/i18n core resources — ui (en-US)
 *
 * Built-in copy for @zoeymind/ui design-system components (defaults / aria-labels / status pages).
 * This file is the source of truth for this namespace.
 */

export default {
  theme: {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    toggle: 'Toggle theme'
  },
  confirmDialog: {
    processing: 'Processing…'
  },
  multiSelect: {
    placeholder: 'Select…',
    empty: 'No options found',
    search: 'Search…'
  },
  preview: {
    deleteFile: 'Delete file',
    imagePreview: 'Image preview',
    previewImage: 'Preview image',
    close: 'Close preview'
  },
  error: {
    title: 'Something went wrong',
    description: 'Sorry, the system ran into a problem. Please try again later.'
  },
  loadingPage: {
    title: 'Loading',
    description: 'Preparing content for you, please wait…'
  },
  loginRequired: {
    title: 'Sign-in required',
    description: 'Please sign in to your account to access this feature',
    action: 'Sign in now'
  },
  maintenance: {
    title: 'Under maintenance',
    description: 'The system is being upgraded to bring you a better experience',
    estimatedTime: 'Estimated completion:',
    refresh: 'Refresh page'
  },
  notFound: {
    title: 'Page not found',
    description: 'Sorry, the page you are looking for does not exist or has been removed',
    back: 'Go back'
  },
  unauthorized: {
    title: 'Access restricted',
    description:
      'Sorry, you do not have permission to access this page. Please contact your administrator.',
    relogin: 'Sign in again'
  }
} as const
