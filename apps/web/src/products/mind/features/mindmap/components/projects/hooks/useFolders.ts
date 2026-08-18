/**
 * useFolders —— 桌面端本地版：文件夹是 SqlFolderRepo 里的虚拟标签。
 *
 * 与产品仓 tRPC 版接口对齐：{ folders, isLoading, refetch, invalidate,
 * createFolder, renameFolder, deleteFolder, isMutating }。
 */
import { useCallback, useEffect, useState } from 'react'
import { logger } from '@zoeymind/logger'
import { createUUID } from '@/shared/app-shared'
import {
  listFolders,
  createFolder as sqlCreateFolder,
  renameFolder as sqlRenameFolder,
  deleteFolder as sqlDeleteFolder,
  type FolderRow
} from '@/shared/native'

export type FolderItem = FolderRow

export function useFolders() {
  const [folders, setFolders] = useState<FolderRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setFolders(await listFolders())
    } catch (error) {
      logger.error('load folders failed:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const refetch = load
  const invalidate = load

  const createFolder = useCallback(
    async (name: string) => {
      setIsMutating(true)
      try {
        const id = createUUID()
        const sortOrder = folders.length
        await sqlCreateFolder(id, name, sortOrder)
        await load()
      } finally {
        setIsMutating(false)
      }
    },
    [folders.length, load]
  )

  const renameFolder = useCallback(
    async (folderId: string, name: string) => {
      setIsMutating(true)
      try {
        await sqlRenameFolder(folderId, name)
        await load()
      } finally {
        setIsMutating(false)
      }
    },
    [load]
  )

  const deleteFolder = useCallback(
    async (folderId: string, deleteContents = false) => {
      setIsMutating(true)
      try {
        await sqlDeleteFolder(folderId, deleteContents)
        await load()
      } finally {
        setIsMutating(false)
      }
    },
    [load]
  )

  return {
    folders,
    isLoading,
    refetch,
    invalidate,
    createFolder,
    renameFolder,
    deleteFolder,
    isMutating
  }
}
