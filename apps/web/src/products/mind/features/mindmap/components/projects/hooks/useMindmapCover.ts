/**
 * 拉思维导图封面图 (base64 data URL).
 *
 * 与 useProjectPreview 相比更薄: 只做 tRPC 查询 + base64 拼装, 不带
 * 老 Express 兼容逻辑. 用于任意需要缩略图的场景 (搜索列表 / preview 卡片).
 *
 * 长 staleTime 让同一 mindmapId 的多处 useQuery 走同一份缓存, 避免高频请求.
 */
import { trpc } from "@/shared/app-shared"

export function useMindmapCover(mindmapId: string, enabled = true) {
  const q = trpc.files.getMindmapCover.useQuery(
    { mindmapId },
    {
      enabled,
      retry: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }
  )
  const dataUrl = q.data?.success && q.data.url ? q.data.url : null
  return { dataUrl, isLoading: q.isLoading, hasCover: dataUrl !== null }
}
