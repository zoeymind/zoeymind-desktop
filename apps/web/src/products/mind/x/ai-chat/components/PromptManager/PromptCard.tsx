/**
 * 单条提示词卡片 (仅"我的指令" 变体, 桌面端无 community).
 * 源仓 x/web/mind/ai-chat/components/PromptManager/PromptCard.tsx 精简版:
 *   - 移除 type='community' 分支 (community tab 桌面端整个不存在)
 *   - 移除 isPublic 切换 (togglePublic / Globe|Lock icon / '公开分享')
 *   - 移除作者头像 (无 user 概念)
 */

import { useTranslation } from "@zoeymind/i18n"
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Switch } from "@zoeymind/ui"
import { Edit2, Loader2, Trash2 } from "lucide-react"
import type { PromptRecord } from "../../storage/prompt-repo"

interface PromptCardProps {
  prompt: PromptRecord
  isTogglingEnable?: boolean
  isDeleting?: boolean
  onToggleEnable: (id: string, current: boolean) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function PromptCard({
  prompt,
  isTogglingEnable = false,
  isDeleting = false,
  onToggleEnable,
  onEdit,
  onDelete,
}: PromptCardProps) {
  const { t } = useTranslation()

  return (
    <Card
      className={`h-[180px] hover:shadow-md transition-shadow ${
        isDeleting ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <CardHeader className="pb-3 shrink-0">
        <div className="flex justify-between items-start gap-2 h-6">
          <CardTitle
            className="text-base font-bold truncate leading-tight flex-1 min-w-0"
            title={prompt.title}
          >
            {prompt.title}
          </CardTitle>
          <Switch
            checked={prompt.isEnabled}
            onCheckedChange={() => onToggleEnable(prompt.id, prompt.isEnabled)}
            disabled={isTogglingEnable}
            aria-label={t("mindmap.aiChat.core.promptLibrary")}
            className="shrink-0"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 py-2 min-h-0">
        <p className="text-xs text-muted-foreground truncate font-mono bg-muted/30 px-2 py-1.5 rounded border leading-tight">
          {prompt.content}
        </p>
      </CardContent>

      <CardFooter className="bg-muted/10 flex justify-end items-center px-4 py-2 shrink-0 min-h-[56px]">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-primary"
            onClick={event => {
              event.stopPropagation()
              onEdit(prompt.id)
            }}
            disabled={isDeleting}
            aria-label={t("common.edit")}
          >
            <Edit2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={event => {
              event.stopPropagation()
              onDelete(prompt.id)
            }}
            disabled={isDeleting}
            aria-label={t("common.delete")}
          >
            {isDeleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
