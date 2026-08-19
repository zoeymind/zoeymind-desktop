/**
 * 提示词管理弹框. 源仓精简版:
 *   - 无 Tabs (community 桌面端不存在, 只保留"我的指令" 列表)
 *   - 无 preview mode 分支
 */

import { useState } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@zoeymind/ui'
import { ArrowLeft, Plus, Sparkles } from 'lucide-react'
import { PromptEditor } from './PromptEditor'
import { PromptList } from './PromptList'

interface PromptManagerModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PromptManagerModal({ isOpen, onClose }: PromptManagerModalProps) {
  const { t } = useTranslation()
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const isEditorView = Boolean(editingPromptId) || isCreating

  const handleEdit = (id: string) => {
    setEditingPromptId(id)
    setIsCreating(false)
  }

  const handleCreate = () => {
    setEditingPromptId(null)
    setIsCreating(true)
  }

  const handleBackToList = () => {
    setEditingPromptId(null)
    setIsCreating(false)
  }

  const title = editingPromptId
    ? t('mindmap.aiChat.prompt.modal.editTitle')
    : isCreating
      ? t('mindmap.aiChat.prompt.modal.createTitle')
      : t('mindmap.aiChat.prompt.modal.libraryTitle')

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent
        size="xl"
        className="h-[80vh] flex flex-col p-0 gap-0 overflow-hidden outline-none"
      >
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2">
            {isEditorView ? (
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 size-8 rounded-full"
                onClick={handleBackToList}
                aria-label={t('common.back')}
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : (
              <div className="size-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
            )}
            <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-background relative">
          {isEditorView ? (
            <div className="absolute inset-0 z-10 bg-background animate-in slide-in-from-right-4 fade-in duration-300">
              <PromptEditor
                editPromptId={editingPromptId}
                onCancel={handleBackToList}
                onSuccess={handleBackToList}
              />
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="px-6 py-2 border-b bg-muted/40 flex justify-between items-center shrink-0">
                <div className="text-sm font-medium text-muted-foreground">
                  {t('mindmap.aiChat.prompt.tabs.my')}
                </div>
                <Button onClick={handleCreate} size="sm" className="gap-1 shadow-sm">
                  <Plus className="size-4" />
                  {t('mindmap.aiChat.prompt.modal.createTitle')}
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <PromptList onEdit={handleEdit} />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
