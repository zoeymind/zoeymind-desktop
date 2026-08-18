export enum ErrorCode {
  UNKNOWN = 'UNKNOWN_ERROR',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  // 业务特定错误
  MINDMAP_NOT_FOUND = 'MINDMAP_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SHARE_LINK_INVALID = 'SHARE_LINK_INVALID',
  SHARE_LINK_EXPIRED = 'SHARE_LINK_EXPIRED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  USERNAME_ALREADY_EXISTS = 'USERNAME_ALREADY_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  REGISTRATION_DISABLED = 'REGISTRATION_DISABLED',
  INVALID_VERIFICATION_CODE = 'INVALID_VERIFICATION_CODE',
  VERIFICATION_CODE_EXPIRED = 'VERIFICATION_CODE_EXPIRED',

  /** 数量或用量超限（协作者、席位等） */
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // 用户管理 — 邀请码 / 账号锁定 / 账号删除
  INVITE_CODE_INVALID = 'INVITE_CODE_INVALID',
  INVITE_CODE_EXPIRED = 'INVITE_CODE_EXPIRED',
  INVITE_CODE_EXHAUSTED = 'INVITE_CODE_EXHAUSTED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',

  // TestProwl 域 — 测试相关资源
  TEST_PROJECT_NOT_FOUND = 'TEST_PROJECT_NOT_FOUND',
  TEST_PLAN_NOT_FOUND = 'TEST_PLAN_NOT_FOUND',
  TEST_CASE_NOT_FOUND = 'TEST_CASE_NOT_FOUND',
  TEST_REPORT_NOT_FOUND = 'TEST_REPORT_NOT_FOUND',
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',
  LOCATOR_NOT_FOUND = 'LOCATOR_NOT_FOUND',
  ITERATION_NOT_FOUND = 'ITERATION_NOT_FOUND',
  ITERATION_ARCHIVED = 'ITERATION_ARCHIVED',
  ITERATION_TASK_NOT_FOUND = 'ITERATION_TASK_NOT_FOUND',
  ITERATION_TASK_EDGE_NOT_FOUND = 'ITERATION_TASK_EDGE_NOT_FOUND',
  ITERATION_TASK_COMMENT_NOT_FOUND = 'ITERATION_TASK_COMMENT_NOT_FOUND',
  EXECUTION_NOT_FOUND = 'EXECUTION_NOT_FOUND',

  // 项目识别号 / 编号
  WORKSPACE_KEY_INVALID = 'WORKSPACE_KEY_INVALID',
  WORKSPACE_KEY_TAKEN = 'WORKSPACE_KEY_TAKEN',
  WORKSPACE_KEY_LOCKED = 'WORKSPACE_KEY_LOCKED',

  // 缺陷域（#104）
  BUG_NOT_FOUND = 'BUG_NOT_FOUND',
  BUG_FIELD_NOT_FOUND = 'BUG_FIELD_NOT_FOUND',
  BUG_FIELD_KEY_TAKEN = 'BUG_FIELD_KEY_TAKEN',
  BUG_FIELD_LOCKED = 'BUG_FIELD_LOCKED',
  BUG_INVALID_TRANSITION = 'BUG_INVALID_TRANSITION',
  BUG_FIELD_VALIDATION_FAILED = 'BUG_FIELD_VALIDATION_FAILED',
  BUG_COMMENT_NOT_FOUND = 'BUG_COMMENT_NOT_FOUND',

  // 组织域
  ORGANIZATION_NOT_FOUND = 'ORGANIZATION_NOT_FOUND',

  // 基建域
  AGENT_NOT_CONNECTED = 'AGENT_NOT_CONNECTED',
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  EMBEDDING_NOT_CONFIGURED = 'EMBEDDING_NOT_CONFIGURED',
  VECTOR_STORE_UNAVAILABLE = 'VECTOR_STORE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
  KNOWLEDGE_BASE_NOT_FOUND = 'KNOWLEDGE_BASE_NOT_FOUND',
  PROMPT_NOT_FOUND = 'PROMPT_NOT_FOUND',
  STORAGE_NOT_CONFIGURED = 'STORAGE_NOT_CONFIGURED',

  // License / 授权域
  LICENSE_INVALID = 'LICENSE_INVALID',
  LICENSE_FEATURE_UNAVAILABLE = 'LICENSE_FEATURE_UNAVAILABLE',
  LICENSE_SEAT_EXCEEDED = 'LICENSE_SEAT_EXCEEDED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND'
}

export type ErrorCategory = 'CLIENT' | 'SERVER' | 'SECURITY' | 'SYSTEM'

export interface ErrorDescriptor {
  code: ErrorCode
  category: ErrorCategory
  message: string
  httpStatus: number
}

export const ERROR_DESCRIPTORS: Record<ErrorCode, ErrorDescriptor> = {
  [ErrorCode.UNKNOWN]: {
    code: ErrorCode.UNKNOWN,
    category: 'SYSTEM',
    message: '发生未知错误，请稍后重试。',
    httpStatus: 500
  },
  [ErrorCode.AUTH_REQUIRED]: {
    code: ErrorCode.AUTH_REQUIRED,
    category: 'SECURITY',
    message: '需要先登录才能执行此操作。',
    httpStatus: 401
  },
  [ErrorCode.FORBIDDEN]: {
    code: ErrorCode.FORBIDDEN,
    category: 'SECURITY',
    message: '当前账号无权执行此操作。',
    httpStatus: 403
  },
  [ErrorCode.NOT_FOUND]: {
    code: ErrorCode.NOT_FOUND,
    category: 'CLIENT',
    message: '资源不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.VALIDATION_FAILED]: {
    code: ErrorCode.VALIDATION_FAILED,
    category: 'CLIENT',
    message: '提交的数据不符合要求，请检查后重试。',
    httpStatus: 422
  },
  [ErrorCode.CONFLICT]: {
    code: ErrorCode.CONFLICT,
    category: 'CLIENT',
    message: '数据状态冲突，请刷新后重试。',
    httpStatus: 409
  },
  [ErrorCode.RATE_LIMITED]: {
    code: ErrorCode.RATE_LIMITED,
    category: 'SECURITY',
    message: '请求过于频繁，请稍后再试。',
    httpStatus: 429
  },
  [ErrorCode.INTERNAL_ERROR]: {
    code: ErrorCode.INTERNAL_ERROR,
    category: 'SERVER',
    message: '服务暂时不可用，请稍后再试。',
    httpStatus: 500
  },
  [ErrorCode.MINDMAP_NOT_FOUND]: {
    code: ErrorCode.MINDMAP_NOT_FOUND,
    category: 'CLIENT',
    message: '思维导图不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.PERMISSION_DENIED]: {
    code: ErrorCode.PERMISSION_DENIED,
    category: 'SECURITY',
    message: '您没有权限执行此操作。',
    httpStatus: 403
  },
  [ErrorCode.SHARE_LINK_INVALID]: {
    code: ErrorCode.SHARE_LINK_INVALID,
    category: 'CLIENT',
    message: '分享链接无效或已失效。',
    httpStatus: 400
  },
  [ErrorCode.SHARE_LINK_EXPIRED]: {
    code: ErrorCode.SHARE_LINK_EXPIRED,
    category: 'CLIENT',
    message: '分享链接已过期。',
    httpStatus: 410
  },
  [ErrorCode.USER_NOT_FOUND]: {
    code: ErrorCode.USER_NOT_FOUND,
    category: 'CLIENT',
    message: '用户不存在。',
    httpStatus: 404
  },
  [ErrorCode.EMAIL_ALREADY_EXISTS]: {
    code: ErrorCode.EMAIL_ALREADY_EXISTS,
    category: 'CLIENT',
    message: '该邮箱已被注册，请使用其他邮箱。',
    httpStatus: 409
  },
  [ErrorCode.USERNAME_ALREADY_EXISTS]: {
    code: ErrorCode.USERNAME_ALREADY_EXISTS,
    category: 'CLIENT',
    message: '该用户名已被使用，请选择其他用户名。',
    httpStatus: 409
  },
  [ErrorCode.INVALID_CREDENTIALS]: {
    code: ErrorCode.INVALID_CREDENTIALS,
    category: 'SECURITY',
    message: '邮箱或密码错误，请重新输入。',
    httpStatus: 401
  },
  [ErrorCode.ACCOUNT_DISABLED]: {
    code: ErrorCode.ACCOUNT_DISABLED,
    category: 'SECURITY',
    message: '账户已被禁用，请联系管理员。',
    httpStatus: 403
  },
  [ErrorCode.REGISTRATION_DISABLED]: {
    code: ErrorCode.REGISTRATION_DISABLED,
    category: 'SECURITY',
    message: '注册功能已关闭。',
    httpStatus: 403
  },
  [ErrorCode.INVALID_VERIFICATION_CODE]: {
    code: ErrorCode.INVALID_VERIFICATION_CODE,
    category: 'CLIENT',
    message: '验证码不正确或已过期。',
    httpStatus: 400
  },
  [ErrorCode.VERIFICATION_CODE_EXPIRED]: {
    code: ErrorCode.VERIFICATION_CODE_EXPIRED,
    category: 'CLIENT',
    message: '验证码已过期，请重新获取。',
    httpStatus: 400
  },
  [ErrorCode.QUOTA_EXCEEDED]: {
    code: ErrorCode.QUOTA_EXCEEDED,
    category: 'CLIENT',
    message: '已达数量上限，请删除部分内容后重试。',
    httpStatus: 409
  },
  [ErrorCode.INVITE_CODE_INVALID]: {
    code: ErrorCode.INVITE_CODE_INVALID,
    category: 'SECURITY',
    message: '邀请码无效。',
    httpStatus: 400
  },
  [ErrorCode.INVITE_CODE_EXPIRED]: {
    code: ErrorCode.INVITE_CODE_EXPIRED,
    category: 'SECURITY',
    message: '邀请码已过期。',
    httpStatus: 400
  },
  [ErrorCode.INVITE_CODE_EXHAUSTED]: {
    code: ErrorCode.INVITE_CODE_EXHAUSTED,
    category: 'SECURITY',
    message: '邀请码使用次数已达上限。',
    httpStatus: 400
  },
  [ErrorCode.ACCOUNT_LOCKED]: {
    code: ErrorCode.ACCOUNT_LOCKED,
    category: 'SECURITY',
    message: '账号已被锁定，请稍后再试或联系管理员。',
    httpStatus: 429
  },
  [ErrorCode.ACCOUNT_DELETED]: {
    code: ErrorCode.ACCOUNT_DELETED,
    category: 'SECURITY',
    message: '账号已被删除。',
    httpStatus: 403
  },
  // TestProwl 域
  [ErrorCode.TEST_PROJECT_NOT_FOUND]: {
    code: ErrorCode.TEST_PROJECT_NOT_FOUND,
    category: 'CLIENT',
    message: '测试项目不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.TEST_PLAN_NOT_FOUND]: {
    code: ErrorCode.TEST_PLAN_NOT_FOUND,
    category: 'CLIENT',
    message: '测试计划不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.TEST_CASE_NOT_FOUND]: {
    code: ErrorCode.TEST_CASE_NOT_FOUND,
    category: 'CLIENT',
    message: '测试用例不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.TEST_REPORT_NOT_FOUND]: {
    code: ErrorCode.TEST_REPORT_NOT_FOUND,
    category: 'CLIENT',
    message: '测试报告不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.MODULE_NOT_FOUND]: {
    code: ErrorCode.MODULE_NOT_FOUND,
    category: 'CLIENT',
    message: '模块不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.LOCATOR_NOT_FOUND]: {
    code: ErrorCode.LOCATOR_NOT_FOUND,
    category: 'CLIENT',
    message: '定位器不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.ITERATION_NOT_FOUND]: {
    code: ErrorCode.ITERATION_NOT_FOUND,
    category: 'CLIENT',
    message: '迭代不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.ITERATION_ARCHIVED]: {
    code: ErrorCode.ITERATION_ARCHIVED,
    category: 'CLIENT',
    message: '已归档迭代无法修改。',
    httpStatus: 409
  },
  [ErrorCode.ITERATION_TASK_NOT_FOUND]: {
    code: ErrorCode.ITERATION_TASK_NOT_FOUND,
    category: 'CLIENT',
    message: '迭代任务不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.ITERATION_TASK_EDGE_NOT_FOUND]: {
    code: ErrorCode.ITERATION_TASK_EDGE_NOT_FOUND,
    category: 'CLIENT',
    message: '任务依赖边不存在。',
    httpStatus: 404
  },
  [ErrorCode.ITERATION_TASK_COMMENT_NOT_FOUND]: {
    code: ErrorCode.ITERATION_TASK_COMMENT_NOT_FOUND,
    category: 'CLIENT',
    message: '任务评论不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.WORKSPACE_KEY_INVALID]: {
    code: ErrorCode.WORKSPACE_KEY_INVALID,
    category: 'CLIENT',
    message: '项目识别号必须为 2-10 位大写英文/数字，且以字母开头。',
    httpStatus: 400
  },
  [ErrorCode.WORKSPACE_KEY_TAKEN]: {
    code: ErrorCode.WORKSPACE_KEY_TAKEN,
    category: 'CLIENT',
    message: '项目识别号已被其他项目占用。',
    httpStatus: 409
  },
  [ErrorCode.WORKSPACE_KEY_LOCKED]: {
    code: ErrorCode.WORKSPACE_KEY_LOCKED,
    category: 'CLIENT',
    message: '项目已存在缺陷或用例编号，识别号不可修改。',
    httpStatus: 409
  },
  [ErrorCode.BUG_NOT_FOUND]: {
    code: ErrorCode.BUG_NOT_FOUND,
    category: 'CLIENT',
    message: '缺陷不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.BUG_FIELD_NOT_FOUND]: {
    code: ErrorCode.BUG_FIELD_NOT_FOUND,
    category: 'CLIENT',
    message: '字段不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.BUG_FIELD_KEY_TAKEN]: {
    code: ErrorCode.BUG_FIELD_KEY_TAKEN,
    category: 'CLIENT',
    message: '字段标识已被占用。',
    httpStatus: 409
  },
  [ErrorCode.BUG_FIELD_LOCKED]: {
    code: ErrorCode.BUG_FIELD_LOCKED,
    category: 'CLIENT',
    message: '内置字段结构不可删除或改类型。',
    httpStatus: 409
  },
  [ErrorCode.BUG_INVALID_TRANSITION]: {
    code: ErrorCode.BUG_INVALID_TRANSITION,
    category: 'CLIENT',
    message: '不允许从当前状态流转到目标状态。',
    httpStatus: 400
  },
  [ErrorCode.BUG_FIELD_VALIDATION_FAILED]: {
    code: ErrorCode.BUG_FIELD_VALIDATION_FAILED,
    category: 'CLIENT',
    message: '字段值校验失败。',
    httpStatus: 400
  },
  [ErrorCode.BUG_COMMENT_NOT_FOUND]: {
    code: ErrorCode.BUG_COMMENT_NOT_FOUND,
    category: 'CLIENT',
    message: '评论不存在或已被删除。',
    httpStatus: 404
  },
  [ErrorCode.EXECUTION_NOT_FOUND]: {
    code: ErrorCode.EXECUTION_NOT_FOUND,
    category: 'CLIENT',
    message: '执行记录不存在或已被删除。',
    httpStatus: 404
  },
  // 组织 / 账务域
  [ErrorCode.ORGANIZATION_NOT_FOUND]: {
    code: ErrorCode.ORGANIZATION_NOT_FOUND,
    category: 'CLIENT',
    message: '组织不存在或已被删除。',
    httpStatus: 404
  },
  // 基建域
  [ErrorCode.AGENT_NOT_CONNECTED]: {
    code: ErrorCode.AGENT_NOT_CONNECTED,
    category: 'SERVER',
    message: 'Agent 服务未连接，请稍后再试。',
    httpStatus: 503
  },
  [ErrorCode.AI_SERVICE_UNAVAILABLE]: {
    code: ErrorCode.AI_SERVICE_UNAVAILABLE,
    category: 'SERVER',
    message: 'AI 服务暂不可用，请稍后再试。',
    httpStatus: 503
  },
  [ErrorCode.EMBEDDING_NOT_CONFIGURED]: {
    code: ErrorCode.EMBEDDING_NOT_CONFIGURED,
    category: 'SERVER',
    message: 'Embedding 服务未配置。',
    httpStatus: 503
  },
  [ErrorCode.VECTOR_STORE_UNAVAILABLE]: {
    code: ErrorCode.VECTOR_STORE_UNAVAILABLE,
    category: 'SERVER',
    message: '向量存储服务暂不可用。',
    httpStatus: 503
  },
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: {
    code: ErrorCode.EXTERNAL_SERVICE_ERROR,
    category: 'SERVER',
    message: '外部服务调用异常。',
    httpStatus: 502
  },
  [ErrorCode.DOCUMENT_NOT_FOUND]: {
    code: ErrorCode.DOCUMENT_NOT_FOUND,
    category: 'CLIENT',
    message: '文档不存在。',
    httpStatus: 404
  },
  [ErrorCode.KNOWLEDGE_BASE_NOT_FOUND]: {
    code: ErrorCode.KNOWLEDGE_BASE_NOT_FOUND,
    category: 'CLIENT',
    message: '知识库不存在。',
    httpStatus: 404
  },
  [ErrorCode.PROMPT_NOT_FOUND]: {
    code: ErrorCode.PROMPT_NOT_FOUND,
    category: 'CLIENT',
    message: '提示词模板不存在。',
    httpStatus: 404
  },
  [ErrorCode.STORAGE_NOT_CONFIGURED]: {
    code: ErrorCode.STORAGE_NOT_CONFIGURED,
    category: 'SERVER',
    message: '文件存储服务未配置。',
    httpStatus: 503
  },
  [ErrorCode.LICENSE_INVALID]: {
    code: ErrorCode.LICENSE_INVALID,
    category: 'CLIENT',
    message: '许可证无效或已损坏，请检查内容后重新提交。',
    httpStatus: 400
  },
  [ErrorCode.LICENSE_FEATURE_UNAVAILABLE]: {
    code: ErrorCode.LICENSE_FEATURE_UNAVAILABLE,
    category: 'SECURITY',
    message: '当前部署未启用该功能。',
    httpStatus: 403
  },
  [ErrorCode.LICENSE_SEAT_EXCEEDED]: {
    code: ErrorCode.LICENSE_SEAT_EXCEEDED,
    category: 'CLIENT',
    message: '席位数已达当前许可上限。',
    httpStatus: 403
  },
  [ErrorCode.FILE_NOT_FOUND]: {
    code: ErrorCode.FILE_NOT_FOUND,
    category: 'CLIENT',
    message: '文件不存在。',
    httpStatus: 404
  }
}

export type ErrorPayload = {
  code: ErrorCode
  message: string
  category: ErrorCategory
  httpStatus: number
  details?: Record<string, unknown>
}

export function resolveErrorDescriptor(code: ErrorCode): ErrorDescriptor {
  return ERROR_DESCRIPTORS[code] ?? ERROR_DESCRIPTORS[ErrorCode.UNKNOWN]
}

export function buildErrorPayload(
  code: ErrorCode,
  options?: { details?: Record<string, unknown> }
): ErrorPayload {
  const descriptor = resolveErrorDescriptor(code)
  return {
    ...descriptor,
    details: options?.details
  }
}
