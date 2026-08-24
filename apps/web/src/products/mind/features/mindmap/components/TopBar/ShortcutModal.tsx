import { type FC, useMemo } from "react"
import { useTranslation } from "@zoeymind/i18n"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@zoeymind/ui"
import { Badge } from "@zoeymind/ui"
import { Separator } from "@zoeymind/ui"
import {
  Search,
  Copy,
  Scissors,
  Clipboard,
  FileText,
  Trash2,
  Plus,
  PlusCircle,
  RotateCcw,
  Tag,
  AlertTriangle,
  AlertCircle,
  Info,
  Lightbulb,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface ShortcutItem {
  keys: string[]
  description: string
  icon?: LucideIcon
}

interface ShortcutCategory {
  category: string
  items: ShortcutItem[]
}

interface ShortcutModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ShortcutModal: FC<ShortcutModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation()
  const shortcuts: ShortcutCategory[] = useMemo(
    () => [
      {
        category: t("mindmap.topbar.shortcuts.categorySearch"),
        items: [
          {
            keys: ["Ctrl", "F"],
            description: t("mindmap.topbar.shortcuts.openSearch"),
            icon: Search,
          },
        ],
      },
      {
        category: t("mindmap.topbar.shortcuts.categoryEdit"),
        items: [
          {
            keys: ["Ctrl", "C"],
            description: t("mindmap.topbar.shortcuts.copyNode"),
            icon: Copy,
          },
          {
            keys: ["Ctrl", "X"],
            description: t("mindmap.topbar.shortcuts.cutNode"),
            icon: Scissors,
          },
          {
            keys: ["Ctrl", "V"],
            description: t("mindmap.topbar.shortcuts.pasteNode"),
            icon: Clipboard,
          },
          {
            keys: ["Ctrl", "D"],
            description: t("mindmap.topbar.shortcuts.duplicateNode"),
            icon: FileText,
          },
          {
            keys: ["Delete"],
            description: t("mindmap.topbar.shortcuts.deleteNode"),
            icon: Trash2,
          },
        ],
      },
      {
        category: t("mindmap.topbar.shortcuts.categoryNode"),
        items: [
          {
            keys: ["Enter"],
            description: t("mindmap.topbar.shortcuts.addSibling"),
            icon: Plus,
          },
          {
            keys: ["Tab"],
            description: t("mindmap.topbar.shortcuts.addChild"),
            icon: PlusCircle,
          },
          {
            keys: ["Alt", "/"],
            description: t("mindmap.topbar.shortcuts.toggleExpand"),
            icon: RotateCcw,
          },
        ],
      },
      {
        category: t("mindmap.topbar.shortcuts.categoryIcon"),
        items: [
          {
            keys: ["·"],
            description: t("mindmap.topbar.shortcuts.iconModule"),
            icon: Tag,
          },
          {
            keys: ["1"],
            description: t("mindmap.topbar.shortcuts.iconP1"),
            icon: AlertTriangle,
          },
          {
            keys: ["2"],
            description: t("mindmap.topbar.shortcuts.iconP2"),
            icon: AlertCircle,
          },
          {
            keys: ["3"],
            description: t("mindmap.topbar.shortcuts.iconP3"),
            icon: Info,
          },
        ],
      },
    ],
    [t]
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-semibold">
            {t("mindmap.topbar.shortcuts.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 mt-4 pr-2">
          {shortcuts.map((category, categoryIndex) => (
            <div key={categoryIndex} className="space-y-3">
              <h3 className="text-lg font-medium text-foreground dark:text-muted-foreground">
                {category.category}
              </h3>

              <div className="space-y-2">
                {category.items.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted dark:bg-muted hover:bg-muted dark:hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {shortcut.icon && (
                        <shortcut.icon className="size-4 text-muted-foreground dark:text-muted-foreground" />
                      )}
                      <span className="text-sm text-foreground dark:text-muted-foreground">
                        {shortcut.description}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <div key={keyIndex} className="flex items-center gap-1">
                          <Badge
                            variant="secondary"
                            className="px-2 py-1 text-xs font-mono bg-white dark:bg-muted border border-border dark:border-border shadow-sm"
                          >
                            {key}
                          </Badge>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-xs text-muted-foreground mx-1">+</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {categoryIndex < shortcuts.length - 1 && <Separator className="my-4" />}
            </div>
          ))}

          <div className="mt-6 p-4 bg-primary/10 dark:bg-primary/20 rounded-lg">
            <p className="text-sm text-primary dark:text-primary flex items-start gap-1.5">
              <Lightbulb className="size-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>{t("mindmap.topbar.shortcuts.tipPrefix")}</strong>
                {t("mindmap.topbar.shortcuts.tipBody")}
              </span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
