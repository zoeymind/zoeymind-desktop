/**
 * @zoeymind/i18n core resources — account (zh-CN)
 *
 * This file is the source of truth for this namespace.
 */

export default {
  dialog: {
    title: '账户'
  },
  menu: {
    newOrg: '创建团队',
    orgSettings: '组织设置',
    personal: '个人空间',
    settings: '账户设置',
    team: '团队',
    unknownUser: '未知用户'
  },
  password: {
    confirmLabel: '确认新密码',
    currentLabel: '当前密码',
    currentRequired: '请输入当前密码',
    mismatch: '两次输入的密码不一致',
    newLabel: '新密码',
    newPlaceholder: '至少 6 个字符',
    submit: '修改密码',
    submitting: '修改中...',
    subtitle: '定期修改密码以保障账号安全',
    title: '修改密码',
    tooShort: '新密码至少 6 个字符',
    updated: '密码已修改'
  },
  profile: {
    avatar: '头像',
    avatarAlt: '用户',
    avatarHint: 'JPG / PNG，不超过 2MB',
    avatarUpdated: '头像已更新',
    avatarUploadFailed: '上传头像失败',
    emailLabel: '邮箱',
    emailUnset: '未设置',
    imageTooLarge: '图片大小不能超过 2MB',
    invalidImage: '请选择图片文件',
    nameLabel: '昵称',
    nameRequired: '昵称不能为空',
    save: '保存更改',
    saving: '保存中...',
    subtitle: '管理你的个人信息',
    title: '个人资料',
    updated: '个人资料已更新',
    usernameLabel: '用户名',
    usernamePlaceholder: '可选'
  },
  sessions: {
    confirmAction: '确认下线',
    confirmDesc: '此操作会使该会话立即失效。',
    confirmTitle: '确认下线该会话',
    current: '当前会话',
    empty: '暂无活跃会话',
    item: '会话',
    revoke: '下线',
    subtitle: '查看和管理你当前登录的会话',
    title: '活跃会话',
    colDevice: '设备',
    colIp: 'IP',
    colStatus: '状态',
    colAction: '操作'
  },
  loginHistory: {
    title: '最近登录',
    subtitle: '你的近期登录记录',
    empty: '暂无登录记录',
    success: '成功',
    failed: '失败',
    colTime: '时间',
    colSource: 'IP / 设备',
    colStatus: '状态'
  },
  tab: {
    profile: '个人信息',
    security: '安全',
    notifications: '通知',
    approvals: '审批',
    apiTokens: 'API 令牌'
  },
  apiTokens: {
    sectionTitle: 'API 令牌',
    sectionDesc:
      '用于 MCP 客户端 (Cursor / Claude Desktop 等) 以你的身份调用思维导图 API. 每个令牌代表你个人, 权限跟随你在各团队的成员身份.',
    nameLabel: '名称',
    namePlaceholder: '例如: Claude MCP',
    nameRequired: '请输入令牌名称',
    createBtn: '创建令牌',
    createFailed: '创建失败',
    listTitle: '已创建的令牌',
    listLoading: '加载中...',
    listEmpty: '暂无令牌',
    createdAtPrefix: '创建于 ',
    lastUsedPrefix: '最近使用：',
    createdDialogTitle: '令牌已创建',
    createdDialogWarn: '请立即复制并妥善保存, 此令牌仅显示一次, 关闭后无法再次查看.',
    acknowledge: '我已复制并妥善保存',
    deleteTitle: '删除令牌',
    deleteDesc: '删除后使用该令牌的客户端将立即失去访问权限, 且不可恢复.',
    deleteAction: '删除',
    deleteSuccess: '令牌已删除',
    renameTitle: '重命名令牌',
    renamed: '已重命名',
    saveAction: '保存',
    connInfoTitle: '连接说明',
    connInfoDesc: '在 Claude Desktop / Cursor 中配置 MCP 服务'
  }
} as const
