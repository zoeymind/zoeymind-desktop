/**
 * @zoeymind/i18n core resources — project (zh-CN)
 *
 * "项目空间" (workspace) 是所有业务数据的容器 — mind/kb/qms 都基于当前项目空间过滤.
 * QMS 保留旧 createFirst* 键做兼容, 语义统一到"项目空间".
 */

export default {
  // 通用命名
  workspace: '项目空间',
  workspacePlural: '项目空间',

  // 首次引导 wizard (mind/kb/qms 共用)
  createFirstTitle: '创建你的第一个项目空间',
  createFirstSubtitle: '所有数据都归属项目空间, 先起一个名字开始',
  projectName: '项目名称',
  projectNamePlaceholder: '例: 移动端 App',
  projectDescription: '项目描述 (可选)',
  projectDescriptionPlaceholder: '简单描述一下这个项目空间的用途',
  projectKeyLabel: '项目识别号',
  projectKeyPlaceholder: '如 ZOEY',
  projectKeyHint:
    '缺陷 / 用例编号前缀（例：ZOEY-BUG-42）。2-10 位大写英文数字，首位字母。有编号引用后不可修改。',
  createAndEnter: '创建并进入',
  creating: '创建中…',
  createSuccess: '项目空间创建成功!',
  createFailed: '创建失败',

  avatarLabel: '项目空间头像',
  avatarHint: '选填, 建议正方形图片, ≤ 2MB',
  // 顶栏项目空间切换器
  switcher: {
    placeholder: '选择项目空间',
    newProject: '新建项目空间',
    empty: '还没有项目空间',
    searchPlaceholder: '搜索项目空间…',
    noMatch: '没有匹配的项目空间',
    mindmapCount_zero: '暂无思维导图',
    mindmapCount_one: '{{count}} 个思维导图',
    mindmapCount_other: '{{count}} 个思维导图',
    mindmapCount: '{{count}} 个思维导图',
    manage: '项目管理'
  },

  search: {
    button: '搜索思维导图',
    title: '搜索思维导图',
    desc: '搜索你可访问的所有思维导图',
    placeholder: '输入名称或描述…',
    empty: '没有匹配的思维导图',
    recent: '最近',
    matches: '匹配',
    nodeCount: '{{n}} 用例',
    other: '其它'
  },

  // 空状态引导 (等价于 wizard, 作为 fallback 使用)
  empty: {
    title: '还没有项目空间',
    descAdmin: '创建你的第一个项目空间, 开始组织团队工作',
    descMember: '你还未被邀请加入任何项目空间, 请联系管理员',
    create: '创建项目空间'
  },

  // 项目空间成员管理
  member: {
    title: '成员',
    add: '添加成员',
    addHint: '把已在本组织内的成员加入项目空间',
    selectUser: '选择用户',
    selectUserPlaceholder: '选择一位组织成员',
    selectRole: '选择角色',
    noEligibleUsers: '组织内没有可添加的成员',
    confirmAdd: '添加',
    added: '成员已添加',
    remove: '移除',
    removed: '成员已移除',
    roleUpdated: '角色已更新',
    empty: '暂无成员',
    you: '我',
    creator: '创建者',
    actions: '操作',
    editRole: '编辑角色',
    columnMember: '成员',
    columnRole: '角色',
    searchPlaceholder: '搜索成员',
    searchInListPlaceholder: '按名字或邮箱搜索成员…',
    removeConfirmTitle: '移除成员',
    removeConfirmDesc: '确认将 {{name}} 移出本项目? 该成员将失去项目访问权限。',
    allMembersHint: '组织全体成员默认可只读访问本项目（成员）；管理员可为每人分配项目角色。',
    roleEmpty: '暂无成员',
    role: {
      OWNER: '所有者',
      ADMIN: '管理员',
      MEMBER: '成员',
      VIEWER: '查看',
      PM: '项目经理',
      PRODUCT: '产品',
      TESTER: '测试',
      DEVELOPER: '开发',
      GUEST: '访客'
    }
  },

  // 项目角色管理
  roles: {
    title: '项目角色',
    description: '管理项目内的角色与权限。内置角色不可编辑，可复制为自定义角色。',
    builtin: '内置',
    custom: '自定义',
    create: '新建角色',
    createFromBuiltin: '复制内置角色',
    edit: '编辑角色',
    delete: '删除角色',
    deleted: '角色已删除',
    created: '角色已创建',
    updated: '角色已更新',
    nameLabel: '角色名称',
    namePlaceholder: '如 QA 负责人',
    baseRoleLabel: '基于内置角色',
    permissionsLabel: '权限',
    permissionCount: '{{count}} 项权限',
    deleteConfirm: '确认删除该自定义角色? 仍有成员使用时无法删除.',
    empty: '暂无自定义角色',
    resource: {
      bug: '缺陷',
      testCase: '测试用例',
      testPlan: '测试计划',
      testReport: '测试报告',
      version: '软件版本',
      member: '项目成员',
      role: '项目角色',
      workspace: '项目空间'
    }
  },

  // 项目空间设置对话框
  settings: {
    subtitle: '管理项目空间的基础信息和成员',
    tab: {
      general: '基础信息',
      members: '成员',
      roles: '角色',
      notifications: '通知',
      bugFields: '缺陷字段'
    },
    updated: '已保存',
    deleted: '项目已删除',
    deleteConfirm: '确认删除该项目空间? 此操作不可恢复.',
    basic: '基础信息',
    readonlyHint: '仅管理员可修改',
    danger: '危险区',
    archive: '归档项目',
    unarchive: '恢复项目',
    archiveHint: '归档后项目变只读, 会置于列表底部.',
    unarchiveHint: '恢复后项目重新可编辑, 列表中不再置底.',
    archiveAction: '归档',
    unarchiveAction: '恢复',
    delete: '删除项目',
    deleteAction: '删除',
    deleteHint: '项目下所有导图 / 知识库 / QMS 数据一并删除, 不可恢复.',
    notifications: {
      feishuTitle: '飞书群机器人通知',
      feishuDescription: '配置飞书自定义机器人 Webhook, 提测/驳回/复测/通过时推送到群',
      configured: '已配置飞书通知',
      webhookLabel: 'Webhook 地址',
      webhookPlaceholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...',
      helpText: '在飞书群设置中添加自定义机器人, 复制 Webhook 地址粘贴到这里。',
      viewDocs: '查看文档',
      invalidUrl: 'Webhook 地址格式不正确, 应以 https://open.feishu.cn/open-apis/bot/ 开头',
      triggerScenes: '触发场景',
      sceneSubmit: '提测通知',
      sceneReject: '驳回通知',
      sceneResubmit: '复测通知',
      scenePass: '通过通知',
      modify: '修改',
      remove: '移除',
      save: '保存',
      saving: '保存中…',
      cancel: '取消',
      updateSuccess: '飞书通知配置已更新',
      updateFailed: '更新失败'
    }
  }
} as const
