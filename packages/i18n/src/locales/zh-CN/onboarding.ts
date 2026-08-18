/**
 * @zoeymind/i18n core resources — onboarding (zh-CN)
 *
 * This file is the source of truth for this namespace.
 */

export default {
  welcomeTitle: '欢迎使用',
  welcomeSubtitle: '让我们花一分钟完成账号设置',
  profileTitle: '完善你的资料',
  profileSubtitle: '让其他人更容易找到你',
  accountTypeTitle: '你的使用场景',
  accountTypeSubtitle: '稍后你随时可以创建团队',
  accountTypePersonal: '个人使用',
  accountTypePersonalDesc: '个人笔记、想法、学习',
  accountTypeTeam: '团队协作',
  accountTypeTeamDesc: '跟同事一起工作',
  finishOnboarding: '开始使用',
  onboardingComplete: '欢迎加入!',
  saving: '保存中…',
  step: {
    accountType: '使用方式',
    createTeam: '创建团队',
    inviteMembers: '邀请成员'
  },
  accountType: {
    question: '你打算怎么用？',
    questionSubtitle: '稍后随时可以创建团队 / 加入团队，先选一个最贴近的方式',
    personalLabel: '个人使用',
    personalDesc: '我自己整理想法、写笔记',
    teamLabel: '我有一个团队',
    teamDesc: '跟同事协作、共享项目'
  },
  createTeam: {
    title: '创建你的团队',
    subtitle: '起一个名字就好'
  },
  inviteMembers: {
    title: '邀请团队成员',
    subtitle: '输入伙伴邮箱,稍后也可以邀请,可跳过',
    emailsLabel: '成员邮箱',
    emailsPlaceholder: 'a@example.com\nb@example.com\n(逗号 / 空格 / 换行分隔)',
    skip: '跳过',
    sending: '发送中…',
    sendCount: '发送 {{count}} 个邀请',
    sentOk: '已发送 {{count}} 个邀请',
    sentMixed: '已发送 {{ok}} 个邀请,{{failed}} 个失败',
    sentAllFailed: '{{count}} 个邀请发送失败',
    teamMissing: '团队尚未创建, 无法邀请',
    failed: '邀请失败'
  },
  profile: {
    title: '完善你的个人资料',
    subtitle: '这些信息会显示给你的协作者，稍后可以在「个人设置」中修改',
    username: '用户名',
    usernamePlaceholder: '例：zoey-zhang',
    usernameHelp: '用于 URL 和 @提及，仅字母 / 数字 / 下划线 / 连字符',
    usernameMinLength: '用户名至少 2 个字符',
    usernameInvalid: '用户名仅允许字母、数字、下划线、连字符',
    displayName: '显示名',
    displayNamePlaceholder: '你想让别人怎么称呼你'
  },
  wizard: {
    teamInfoLost: '团队信息丢失,请重试',
    completeFailed: '完成失败'
  },
  setup: {
    title: '创建管理员账号',
    subtitle: '首次启动只需创建平台管理员即可开始使用; 其余配置稍后在管理后台按需补配',
    doneTitle: '初始化完成',
    doneDesc: '管理员账号已创建, setup 通道已关闭.\n未配置的项目可稍后在管理后台"系统设置"中补配.',
    toLogin: '前往登录',
    admin: {
      username: '管理员用户名',
      usernamePlaceholder: 'admin',
      usernameMin: '用户名至少 3 个字符',
      usernameMax: '用户名最多 32 个字符',
      usernamePattern: '用户名只允许字母/数字/下划线/连字符',
      password: '管理员密码',
      passwordPlaceholder: '至少 8 位',
      passwordMin: '密码至少 8 个字符',
      passwordMax: '密码最多 128 个字符',
      email: '管理员邮箱 (选填)',
      emailPlaceholder: 'admin@example.com',
      emailInvalid: '邮箱格式无效',
      companyName: '组织名 (选填)',
      companyNamePlaceholder: '例如 我的公司',
      companyNameHelp: '留空将使用用户名作为组织名',
      allowRegistration: '允许公开注册',
      allowRegistrationHelp: '关闭后仅管理员可在后台建号. 稍后可在系统设置里改.',
      creating: '创建中…',
      submit: '创建管理员',
      createFailed: '创建管理员失败'
    }
  }
} as const
