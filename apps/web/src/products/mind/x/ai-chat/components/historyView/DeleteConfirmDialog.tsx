// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * 删除确认对话框 — 复用共享 ConfirmDialog
 */
import { ConfirmDialog } from '@zoeymind/ui'
import { useTranslation } from '@zoeymind/i18n'

interface DeleteConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  loading: boolean
}

export const DeleteConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  loading
}: DeleteConfirmDialogProps) => {
  const { t } = useTranslation()
  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={o => !o && onClose()}
      title={t('mindmap.aiChat.history.deleteDialog.title')}
      description={t('mindmap.aiChat.history.deleteDialog.description', { name: title })}
      confirmText={t('common.delete')}
      cancelText={t('common.cancel')}
      variant="destructive"
      onConfirm={onConfirm}
      loading={loading}
    />
  )
}
