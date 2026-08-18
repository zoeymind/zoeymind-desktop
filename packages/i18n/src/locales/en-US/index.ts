/**
 * @zoeymind/i18n core resources — en-US
 *
 * This file is the source of truth for this namespace.
 */

import common from './common'
import language from './language'
import errors from './errors'
import auth from './auth'
import org from './org'
import onboarding from './onboarding'
import project from './project'
import feishu from './feishu'
import oauth from './oauth'
import account from './account'
import orgSettings from './orgSettings'
import ui from './ui'
import appLauncher from './appLauncher'

export default {
  common,
  language,
  errors,
  auth,
  org,
  onboarding,
  project,
  feishu,
  oauth,
  account,
  orgSettings,
  ui,
  appLauncher
} as const
