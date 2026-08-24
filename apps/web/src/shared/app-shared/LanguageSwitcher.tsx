/**
 * 语言切换器 — 跟 shadcn dropdown 风格统一.
 *
 * 用法:
 *   <LanguageSwitcher />            // 默认带 Languages 图标的小按钮
 *   <LanguageSwitcher variant="text" />  // 纯文本版 (页脚链接)
 */

import { Languages } from "lucide-react"
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
} from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import { SUPPORTED_LOCALES, type SupportedLocale } from "@zoeymind/i18n"
import { useLocale, useChangeLocale } from "@zoeymind/i18n"

export interface LanguageSwitcherProps {
  /** 'icon' (默认): 图标按钮; 'text': 纯文本 link */
  variant?: "icon" | "text"
  className?: string
}

export function LanguageSwitcher({ variant = "icon", className }: LanguageSwitcherProps) {
  const { t } = useTranslation()
  const current = useLocale()
  const changeLocale = useChangeLocale()

  if (variant === "text") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          nativeButton
          render={
            <button
              type="button"
              className={
                className ?? "text-xs text-muted-foreground hover:text-foreground hover:underline"
              }
            >
              {t(`language.${current}`)}
            </button>
          }
        />
        <DropdownMenuContent align="end">
          {SUPPORTED_LOCALES.map(loc => (
            <DropdownMenuCheckboxItem
              key={loc}
              checked={loc === current}
              onCheckedChange={() => changeLocale(loc)}
            >
              {t(`language.${loc}`)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={className}
            aria-label={t("language.switch")}
          >
            <Languages className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {SUPPORTED_LOCALES.map(loc => (
          <DropdownMenuItem
            key={loc}
            onClick={() => changeLocale(loc)}
            className={loc === current ? "font-medium" : undefined}
          >
            {t(`language.${loc}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export type { SupportedLocale }
