/**
 * useFolders —— 桌面端本地版：SqlFolderRepo。API 表面对齐 tRPC 版。
 */
import { useCallback, useEffect, useState } from "react"
import { logger } from "@zoeymind/logger"
import {
  listFolders,
  createFolder as sqlCreateFolder,
  renameFolder as sqlRenameFolder,
  deleteFolder as sqlDeleteFolder,
  createUUID,
  type FolderRow,
} from "@/shared/native"

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
      logger.error("load folders failed:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load())
    return () => cancelAnimationFrame(frame)
  }, [load])

  const createFolder = useCallback(
    async (name: string) => {
      setIsMutating(true)
      try {
        await sqlCreateFolder(createUUID(), name, folders.length)
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
    async (folderId: string) => {
      setIsMutating(true)
      try {
        await sqlDeleteFolder(folderId)
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
    refetch: load,
    invalidate: load,
    createFolder,
    renameFolder,
    deleteFolder,
    isMutating,
  }
}
