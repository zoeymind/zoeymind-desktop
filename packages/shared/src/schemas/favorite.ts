import { z } from 'zod'

/**
 * 收藏/取消收藏思维导图
 */
export const toggleFavoriteSchema = z.object({
  mindmapId: z.string().min(1, '思维导图ID不能为空')
})

/**
 * 获取用户收藏列表
 */
export const getUserFavoritesSchema = z.object({
  page: z.number().min(1, '页码必须大于0').default(1),
  limit: z.number().min(1, '每页数量必须大于0').max(100, '每页最多100条').default(20)
})

/**
 * 检查收藏状态
 */
export const checkFavoriteStatusSchema = z.object({
  mindmapIds: z
    .array(z.string().min(1, '思维导图ID不能为空'))
    .min(1, '至少需要一个思维导图ID')
    .max(50, '最多支持50个ID')
})
