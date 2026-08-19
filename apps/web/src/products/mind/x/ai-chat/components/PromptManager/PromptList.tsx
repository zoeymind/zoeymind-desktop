/**
 * 提示词列表 (仅"我的指令"). 源仓 PromptList.tsx 精简版:
 *   - 无 type 参数, 只列本地 prompts
 *   - 无 community/publicPrompts 查询, 无 saveToLibrary
 *   - trpc.prompt.* 换成 usePrompts.* (react-query + sqlite)
 */

import { useMemo, useState } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  ScrollArea,
  Skeleton
} from '@zoeymind/ui'
import { AlertCircle, Edit2 } from 'lucide-react'
import { DeleteDialog } from '@/products/mind/features/mindmap/components/projects/dialogs/DeleteDialog'
import {
  useDeletePrompt,
  usePromptsQuery,
  useTogglePromptEnable
} from '../../hooks/usePrompts'

interface PromptListProps {
  onEdit: (id: string) => void
}

export function PromptList({ onEdit }: PromptListProps) {
  const { t } = useTranslation()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: prompts, isLoading, isError, refetch } = usePromptsQuery()
  const toggleEnableMutation = useTogglePromptEnable()
  const deleteMutation = useDeletePrompt()

  const promptToDelete = useMemo(
    () => prompts?.find(p => p.id === deleteId),
    [deleteId, prompts]
  )

  const handleToggleEnable = (id: string, current: boolean) => {
    toggleEnableMutation.mutate({ id, isEnabled: !current })
  }

  const handleConfirmDelete = async () => {
    if (!deleteId) return
    await deleteMutation.mutateAsync(deleteId)
    setDeleteId(null)
  }

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(index => (
            <Card key={index} className="h-48">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent className="py-2">
                <Skeleton className="h-16 w-full rounded-md" />
              </CardContent>
              <CardFooter className="py-3">
                <Skeleton className="h-8 w-20" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </ScrollArea>
    )
  }

  if (isError) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
        <div className="bg-muted p-4 rounded-full mb-4">
          <AlertCircle className="size-8 opacity-50" />
        </div>
        <p className="text-sm text-center max-w-sm">
          {t('mindmap.aiChat.error.requestFailed.body')}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  if (!prompts?.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
        <div className="bg-muted p-4 rounded-full mb-4">
          <Edit2 className="size-8 opacity-50" />
        </div>
        <p className="text-lg font-medium">{t('mindmap.aiChat.prompt.empty.title')}</p>
        <p className="text-sm opacity-70 mt-1">{t('mindmap.aiChat.prompt.empty.myHint')}</p>
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {prompts.map(prompt => {
            const isTogglingEnable =
              toggleEnableMutation.isPending && toggleEnableMutation.variables?.id === prompt.id
            const isDeleting = deleteMutation.isPending && deleteMutation.variables === prompt.id

            return (
              <PromptCardLazy
                key={prompt.id}
                prompt={prompt}
                isTogglingEnable={isTogglingEnable}
                isDeleting={isDeleting}
                onToggleEnable={handleToggleEnable}
                onEdit={onEdit}
                onDelete={setDeleteId}
              />
            )
          })}
        </div>
      </ScrollArea>

      <DeleteDialog
        open={Boolean(deleteId)}
        onOpenChange={open => !open && setDeleteId(null)}
        itemName={promptToDelete?.title ?? ''}
        title={t('mindmap.aiChat.prompt.delete.title')}
        description={t('mindmap.aiChat.prompt.delete.description', {
          name: promptToDelete?.title ?? ''
        })}
        onConfirm={handleConfirmDelete}
        loading={deleteMutation.isPending}
      />
    </>
  )
}

// 单独抽 lazy import 会更好, 但目前 PromptCard 已经足够轻, 直接引入即可.
import { PromptCard } from './PromptCard'
const PromptCardLazy = PromptCard
