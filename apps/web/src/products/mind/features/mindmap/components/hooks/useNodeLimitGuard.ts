import { useEffect, useRef } from 'react'
import type { default as MindMap } from 'simple-mind-map'
import { MAX_NODE_COUNT } from '@zoeymind/shared'
import { useToast } from '@/shared/app-shared'
import { useTranslation } from '@zoeymind/i18n'
import { logger } from '@zoeymind/logger'

/**
 * 监听 simple-mind-map 的 node_limit_exceeded 事件，弹出 toast 提示
 */
export function useNodeLimitGuard(mindMap: MindMap | null) {
  const { toast } = useToast()
  const { t } = useTranslation()
  // 防抖：避免短时间内连续弹出多次 toast
  const lastToastTimeRef = useRef(0)

  useEffect(() => {
    if (!mindMap) return

    const handleNodeLimitExceeded = (...args: unknown[]) => {
      const data = args[0] as { maxCount: number; currentCount: number }
      const now = Date.now()
      // 3 秒内不重复弹出
      if (now - lastToastTimeRef.current < 3000) return
      lastToastTimeRef.current = now

      logger.warn(`节点数量已达上限: ${data.currentCount}/${data.maxCount}`)

      toast({
        title: t('mindmap.toast.nodeLimitTitle'),
        description: t('mindmap.toast.nodeLimitDesc', {
          current: data.currentCount,
          max: MAX_NODE_COUNT
        }),
        variant: 'destructive'
      })
    }

    mindMap.on('node_limit_exceeded', handleNodeLimitExceeded)

    return () => {
      mindMap.off('node_limit_exceeded', handleNodeLimitExceeded)
    }
  }, [mindMap, toast, t])
}
