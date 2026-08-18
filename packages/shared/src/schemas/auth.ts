import { z } from 'zod'

// 用户注册schema
export const registerSchema = z
  .object({
    email: z.string().email('请输入有效的邮箱地址'),
    username: z.string().min(3, '用户名至少3个字符').max(20, '用户名最多20个字符').optional(),
    name: z.string().min(1, '姓名不能为空').max(50, '姓名最多50个字符'),
    password: z.string().min(6, '密码至少6个字符').max(50, '密码最多50个字符'),
    confirmPassword: z.string()
  })
  .refine(data => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword']
  })

// 用户登录schema
export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码')
})

// 修改密码schema
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码'),
    newPassword: z.string().min(6, '新密码至少6个字符').max(50, '新密码最多50个字符'),
    confirmNewPassword: z.string()
  })
  .refine(data => data.newPassword === data.confirmNewPassword, {
    message: '两次输入的新密码不一致',
    path: ['confirmNewPassword']
  })

// 忘记密码schema
export const forgotPasswordSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址')
})

// 重置密码schema
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, '重置令牌不能为空'),
    password: z.string().min(6, '密码至少6个字符').max(50, '密码最多50个字符'),
    confirmPassword: z.string()
  })
  .refine(data => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword']
  })

// 通过验证码重置密码 schema
export const resetPasswordWithCodeSchema = z
  .object({
    email: z.string().email('请输入有效的邮箱地址'),
    code: z.string().length(6, '验证码为6位数字'),
    newPassword: z.string().min(6, '密码至少6个字符').max(50, '密码最多50个字符'),
    confirmPassword: z.string()
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword']
  })

// 认证响应schema
export const authResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: z
    .object({
      id: z.string(),
      email: z.string().nullable(),
      username: z.string().nullable(),
      name: z.string().nullable(),
      avatar: z.string().nullable(),
      role: z.enum(['USER', 'ADMIN']),
      isActive: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string()
    })
    .optional(),
  token: z.string().optional()
})

// 检查用户名是否可用
export const checkUsernameSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(20, '用户名最多20个字符')
})

// 检查邮箱是否可用
export const checkEmailSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址')
})

// 通过token认证
export const authenticateByTokenSchema = z.object({
  token: z.string().min(1, '令牌不能为空')
})

// 发送验证码 schema
export const sendVerificationCodeSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址')
})

// 验证验证码 schema
export const verifyCodeSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  code: z.string().length(6, '验证码为6位数字')
})

// 使用验证码注册 schema
export const registerWithCodeSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  code: z.string().length(6, '验证码为6位数字'),
  name: z.string().min(1, '姓名不能为空').max(50, '姓名最多50个字符'),
  password: z.string().min(6, '密码至少6个字符').max(50, '密码最多50个字符')
})

// 更新个人资料 schema
export const updateProfileSchema = z.object({
  name: z.string().min(2, '昵称至少2个字符').max(30, '昵称最多30个字符').optional(),
  username: z
    .string()
    .min(3, '用户名至少3个字符')
    .max(20, '用户名最多20个字符')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线')
    .optional(),
  avatar: z.string().optional(),
  bannerImage: z.string().optional()
})

// 导出类型
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ResetPasswordWithCodeInput = z.infer<typeof resetPasswordWithCodeSchema>
export type AuthResponse = z.infer<typeof authResponseSchema>
export type CheckUsernameInput = z.infer<typeof checkUsernameSchema>
export type CheckEmailInput = z.infer<typeof checkEmailSchema>
export type SendVerificationCodeInput = z.infer<typeof sendVerificationCodeSchema>
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>
export type RegisterWithCodeInput = z.infer<typeof registerWithCodeSchema>
