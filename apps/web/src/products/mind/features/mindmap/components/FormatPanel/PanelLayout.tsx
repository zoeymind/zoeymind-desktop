import React from "react"
import { X } from "lucide-react"
import { useTranslation } from "@zoeymind/i18n"

interface PanelLayoutProps {
  title?: string
  icon?: React.ReactNode
  children: React.ReactNode
  isActive: boolean
  onClose?: () => void
  className?: string
  customHeader?: React.ReactNode
}

export const PanelLayout: React.FC<PanelLayoutProps> = ({
  title,
  icon,
  children,
  isActive,
  onClose,
  className = "",
  customHeader,
}) => {
  const { t } = useTranslation()
  if (!isActive) return null

  return (
    <div className="fixed top-[var(--mind-floating-top,68px)] right-[var(--mind-floating-right,16px)] bottom-[var(--mind-floating-bottom,30px)] z-10 w-[min(320px,var(--mind-floating-max-width,320px))] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      <div className="flex flex-col h-full">
        {/* 头部 */}
        {customHeader ? (
          customHeader
        ) : (
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              {icon}
              <div className="text-base font-medium">{title}</div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                title={t("mindmap.formatPanel.panelLayout.closeTitle", { title })}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}

        {/* 内容区域 */}
        <div className={`flex-1 overflow-y-auto ${className}`}>{children}</div>
      </div>
    </div>
  )
}
