import { Loader2 } from "lucide-react"
import { useTranslation } from "@zoeymind/i18n"

export function CompactionStatusDivider() {
  const { t } = useTranslation()

  return (
    <div
      role="status"
      className="my-3 flex w-full items-center gap-3 text-[11px] text-muted-foreground"
    >
      <span className="h-px min-w-4 flex-1 bg-border" />
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <Loader2 className="size-3 animate-spin text-warning" />
        {t("mindmap.aiChat.compaction.loadingStatus")}
      </span>
      <span className="h-px min-w-4 flex-1 bg-border" />
    </div>
  )
}
