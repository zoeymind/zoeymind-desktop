/**
 * 提示词编辑器. 源仓精简版:
 *   - 无 preview mode (community 相关)
 *   - 无 isPublic 开关
 *   - 无 AI 优化按钮 (源版是占位 UI 无实际接线)
 *   - trpc 换成 usePrompts hooks
 */

import { useEffect, useMemo } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import {
  Button,
  Input,
  Label,
  ScrollArea,
  Textarea
} from '@zoeymind/ui'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useCreatePrompt, usePromptsQuery, useUpdatePrompt } from '../../hooks/usePrompts'

interface PromptEditorProps {
  editPromptId: string | null
  onCancel: () => void
  onSuccess: () => void
}

interface PromptForm {
  title: string
  content: string
}

export function PromptEditor({ editPromptId, onCancel, onSuccess }: PromptEditorProps) {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<PromptForm>({ defaultValues: { title: '', content: '' } })

  const { data: prompts, isLoading: isLoadingData } = usePromptsQuery()
  const promptData = useMemo(
    () => (editPromptId ? prompts?.find(p => p.id === editPromptId) : undefined),
    [editPromptId, prompts]
  )

  useEffect(() => {
    if (promptData && editPromptId) {
      setValue('title', promptData.title)
      setValue('content', promptData.content)
    } else if (!editPromptId) {
      reset({ title: '', content: '' })
    }
  }, [editPromptId, promptData, reset, setValue])

  const createMutation = useCreatePrompt()
  const updateMutation = useUpdatePrompt()

  const handleSubmitPrompt = async (data: PromptForm) => {
    try {
      if (editPromptId) {
        await updateMutation.mutateAsync({ id: editPromptId, ...data })
      } else {
        await createMutation.mutateAsync(data)
      }
      onSuccess()
      reset()
    } catch {
      // react-query 会把 error 塞到 mutation state, 需要吐 toast 时再补
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (editPromptId && isLoadingData) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(handleSubmitPrompt)}
      className="flex flex-col h-full overflow-hidden"
    >
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                {t('mindmap.aiChat.prompt.titleLabel')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                {...register('title', { required: t('mindmap.aiChat.prompt.titleRequired') })}
                placeholder={t('mindmap.aiChat.prompt.titlePlaceholder')}
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">
                {t('mindmap.aiChat.prompt.systemPromptLabel')}{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="content"
                {...register('content', {
                  required: t('mindmap.aiChat.prompt.contentRequired')
                })}
                className={`min-h-[300px] font-mono text-sm resize-none ${
                  errors.content ? 'border-destructive' : ''
                }`}
                placeholder={t('mindmap.aiChat.prompt.contentPlaceholder')}
              />
              {errors.content && (
                <p className="text-xs text-destructive">{errors.content.message}</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-muted/10 flex justify-end gap-2 shrink-0">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isPending
            ? t('mindmap.aiChat.prompt.saving')
            : t('mindmap.aiChat.prompt.savePrompt')}
        </Button>
      </div>
    </form>
  )
}
