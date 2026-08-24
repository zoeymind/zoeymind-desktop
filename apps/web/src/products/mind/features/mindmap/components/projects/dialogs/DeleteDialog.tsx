import { ConfirmDialog } from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  title?: string
  description?: string
  onConfirm: () => Promise<void> | void
  loading?: boolean
  destructiveText?: string
}

export const DeleteDialog = ({
  open,
  onOpenChange,
  itemName,
  title,
  description,
  onConfirm,
  loading = false,
  destructiveText,
}: DeleteDialogProps) => {
  const { t } = useTranslation()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? t("projects.dialogs.deleteTitle", { itemName })}
      description={description ?? t("projects.dialogs.deleteDescription")}
      confirmText={destructiveText ?? t("common.delete")}
      cancelText={t("common.cancel")}
      variant="destructive"
      onConfirm={onConfirm}
      loading={loading}
    />
  )
}
