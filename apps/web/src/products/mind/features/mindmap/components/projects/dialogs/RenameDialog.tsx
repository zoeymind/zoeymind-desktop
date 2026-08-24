import React from "react"
import { useForm } from "react-hook-form"
import { logger } from "@zoeymind/logger"
import { useTranslation } from "@zoeymind/i18n"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoeymind/ui"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@zoeymind/ui"
import { Input } from "@zoeymind/ui"
import { Button } from "@zoeymind/ui"

interface RenameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  title?: string
  description?: string
  onConfirm: (newName: string) => Promise<void> | void
  loading?: boolean
}

interface FormData {
  name: string
}

export const RenameDialog: React.FC<RenameDialogProps> = ({
  open,
  onOpenChange,
  currentName,
  title,
  description,
  onConfirm,
  loading = false,
}) => {
  const { t } = useTranslation()
  const dialogTitle = title ?? t("projects.dialogs.renameTitle")
  const dialogDescription = description ?? t("projects.dialogs.renameDescription")
  const form = useForm<FormData>({
    defaultValues: {
      name: currentName,
    },
  })

  // 当弹框打开时重置表单
  React.useEffect(() => {
    if (open) {
      form.setValue("name", currentName)
      form.clearErrors()
    }
  }, [open, currentName, form])

  const handleSubmit = async (data: FormData) => {
    if (!data.name.trim()) {
      form.setError("name", {
        type: "required",
        message: t("projects.dialogs.nameRequired"),
      })
      return
    }

    try {
      await onConfirm(data.name.trim())
      onOpenChange(false)
    } catch (error) {
      // 错误处理由父组件负责
      logger.error("重命名失败:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("projects.dialogs.nameLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("projects.dialogs.namePlaceholder")}
                      data-testid="rename-input"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={loading} data-testid="rename-submit">
                {loading ? t("projects.dialogs.processing") : t("common.confirm")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
