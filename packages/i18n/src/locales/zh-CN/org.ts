/**
 * @zoeymind/i18n core resources — org (zh-CN)
 *
 * This file is the source of truth for this namespace.
 */

export default {
  organization: '组织',
  personal: '个人空间',
  team: '团队',
  createTeam: '创建团队',
  createTeamSubtitle: '起一个名字就好,后续可以邀请成员',
  teamName: '团队名称',
  teamNamePlaceholder: '例: Acme Inc',
  createTeamAction: '创建团队',
  inviteMembers: '邀请成员',
  inviteMembersSubtitle: '通过邮箱邀请你的同事加入',
  skipForNow: '暂时跳过',
  selectPlan: '选择套餐',
  selectPlanSubtitle: '从下方套餐中选择一个,适合你的团队',
  teamCreatedSuccess: '团队创建成功!',
  settings: '设置',
  members: '成员',
  role: '角色',
  leave: '离开团队',
  deleteOrg: '删除团队',
  accountMenu: '账号',
  switchOrg: '切换组织',
  addOrg: '创建团队',
  roleLabel: {
    OWNER: '所有者',
    ADMIN: '管理员',
    MEMBER: '成员',
    GUEST: '访客'
  },
  roleDesc: {
    OWNER: '拥有组织的完全控制权',
    ADMIN: '可以管理成员和项目设置',
    MEMBER: '可以访问和编辑项目内容',
    GUEST: '只能查看被授权的内容'
  },
  invite: {
    invalidTitle: '邀请无效',
    invalidDesc: '无法获取邀请信息，请检查链接是否正确',
    notFoundTitle: '邀请不存在',
    notFoundDesc: '该邀请链接不存在或已被撤销',
    expiredTitle: '邀请已过期',
    expiredDesc: '该邀请链接已过期，请联系组织管理员获取新的邀请',
    backHome: '返回首页',
    invitedTitle: '您被邀请加入组织',
    loginToAccept: '请登录或注册以接受邀请',
    orgLabel: '组织',
    inviterLabel: '邀请人',
    orgAdmin: '组织管理员',
    assignedRole: '分配角色',
    validity: '有效期',
    expiresIn: '{{time}}过期',
    registerNew: '注册新账号',
    haveAccount: '已有账号？登录',
    acceptSuccess: '邀请接受成功！正在跳转...',
    acceptFailed: '接受邀请失败，请稍后重试',
    emailMismatchTitle: '邮箱不匹配',
    emailMismatchDesc: '当前账号邮箱与邀请邮箱不一致，请切换到受邀邮箱后再试。',
    emailMismatchDetail:
      '当前账号邮箱 {{currentEmail}} 与邀请邮箱 {{invitedEmail}} 不一致，请切换账号后再试。',
    alreadyMember: '您已是该组织成员，已返回首页',
    cannotVerifyTitle: '无法验证邮箱',
    cannotVerifyDesc: '当前账号没有绑定邮箱，无法接受该邀请，请切换到受邀邮箱登录。',
    rejected: '您已拒绝该邀请',
    switchAccount: '切换账号登录',
    registerWithInviteEmail: '用邀请邮箱注册',
    welcomeTitle: '欢迎加入！',
    joinedOrg: '您已成功加入 {{name}}',
    orgFallback: '组织',
    redirecting: '正在跳转到组织页面...',
    joinTitle: '加入 {{name}}',
    orgDescFallback: '您被邀请加入此组织',
    acceptHint: '接受邀请后，您将能够访问该组织的项目和资源。如有疑问，请联系邀请人确认。',
    joining: '加入中...',
    acceptInvite: '接受邀请',
    reject: '拒绝'
  }
} as const
