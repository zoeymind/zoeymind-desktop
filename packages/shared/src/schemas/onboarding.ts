/**
 * Onboarding wizard 的状态机定义
 *
 * 注册 → OTP → 设密码 → wizard
 *   profile        完善 username / displayName / avatar
 *   accountType    选择「个人 vs 团队」
 *   createTeam     仅团队路径，创建团队表单
 *   done           写 onboardingCompletedAt
 */

import { z } from 'zod'

export const OnboardingStepSchema = z.enum([
  'profile',
  'accountType',
  'createTeam',
  'inviteMembers',
  'done'
])
export const OnboardingSteps = OnboardingStepSchema.enum
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>

export const AccountTypeSchema = z.enum(['personal', 'team'])
export const AccountTypes = AccountTypeSchema.enum
export type AccountType = z.infer<typeof AccountTypeSchema>

// 完成 profile 步骤
export const completeProfileSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9_-]+$/i, '用户名仅允许字母、数字、下划线、连字符'),
  displayName: z.string().min(1).max(50),
  avatar: z.string().url().optional()
})
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>

// 选择账户类型
export const chooseAccountTypeSchema = z.object({
  accountType: AccountTypeSchema
})
export type ChooseAccountTypeInput = z.infer<typeof chooseAccountTypeSchema>

// 整体 onboarding state（query 返回）
export interface OnboardingState {
  /** 当前步骤（done 表示已完成） */
  step: OnboardingStep
  /** 是否已完整完成（即 onboardingCompletedAt != null） */
  completed: boolean
  /** 完成时间 ISO 字符串 */
  completedAt: string | null
}
