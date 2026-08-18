import { trpc, useOrganization } from '@/shared/app-shared'

export interface FolderItem {
  id: string
  name: string
  sortOrder: number
  createdAt: string | Date
  mindmapCount: number
}

/**
 * 文件夹列表 + 增删改（组织级，扁平）。
 * 读用 react-query hook（自动缓存/失效），写用 mutation 成功后 invalidate。
 */
export function useFolders() {
  const { currentOrg } = useOrganization()
  const utils = trpc.useUtils()
  const orgId = currentOrg?.id ?? ''

  const listQuery = trpc.mindmap.folder.list.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  )

  const invalidate = () => utils.mindmap.folder.list.invalidate()

  const createMutation = trpc.mindmap.folder.create.useMutation({ onSuccess: invalidate })
  const renameMutation = trpc.mindmap.folder.rename.useMutation({ onSuccess: invalidate })
  const deleteMutation = trpc.mindmap.folder.delete.useMutation({ onSuccess: invalidate })

  const folders = (listQuery.data?.data ?? []) as FolderItem[]

  return {
    folders,
    isLoading: listQuery.isLoading,
    refetch: listQuery.refetch,
    invalidate,
    createFolder: (name: string) => createMutation.mutateAsync({ organizationId: orgId, name }),
    renameFolder: (folderId: string, name: string) =>
      renameMutation.mutateAsync({ folderId, name }),
    deleteFolder: (folderId: string, deleteContents = false) =>
      deleteMutation.mutateAsync({ folderId, deleteContents }),
    isMutating: createMutation.isPending || renameMutation.isPending || deleteMutation.isPending
  }
}
