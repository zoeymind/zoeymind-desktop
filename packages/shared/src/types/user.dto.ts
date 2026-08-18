/**
 * 用户数据传输对象（DTO）
 * 统一的用户信息返回格式
 */

export interface UserDTO {
  /** 用户唯一标识 */
  id: string
  /** 邮箱地址 */
  email: string | null
  /** 用户名 */
  username: string | null
  /** 用户昵称 */
  name: string | null
  /** 头像URL */
  avatar: string | null
  /** hub 个人页封面 (base64 或 URL) */
  bannerImage: string | null
  /** 用户角色 */
  role: 'ADMIN' | 'USER'
  /** 账户是否激活 */
  isActive: boolean
  /** 创建时间（ISO 8601 格式） */
  createdAt: string
  /** Google 用户ID（可选） */
  googleId?: string | null
  /** GitHub 用户ID（可选） */
  githubId?: string | null
  /** 更新时间（ISO 8601 格式） */
  updatedAt: string
  /** Onboarding 是否完成 */
  onboardingCompletedAt?: string | null
  /** Onboarding 当前步骤 */
  onboardingStep?: string | null
}
