/**
 * useCloudStorageManager —— 桌面端 no-op 版。
 *
 * MindMapCanvas 里 cloudMode ? saveCloudData : saveLocalData 的三元；桌面端
 * cloudMode 恒 false，本 hook 的所有返回值永不被调用，只需 API 表面一致
 * 让 destructure 不 NPE。
 */
import { useMemo } from 'react'
import type { default as MindMap } from 'simple-mind-map'

interface UseCloudStorageManagerResult {
  loadSavedData: () => Promise<{ savedData: null; savedViewData: null }>
  saveData: () => Promise<void>
  uploadPreviewThrottled: () => Promise<void>
}

const NOOP_ASYNC = async (): Promise<void> => undefined

export function useCloudStorageManager(
  _mindMap: MindMap | null,
  _options?: { collaborative?: boolean }
): UseCloudStorageManagerResult {
  return useMemo(
    () => ({
      loadSavedData: async () => ({ savedData: null, savedViewData: null }),
      saveData: NOOP_ASYNC,
      uploadPreviewThrottled: NOOP_ASYNC
    }),
    []
  )
}
