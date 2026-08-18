/**
 * AI 欢迎对话框组件
 * 首次使用 AI 功能时显示的欢迎对话框
 */

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@zoeymind/ui'
import { Button } from '@zoeymind/ui'
import { Database } from 'lucide-react'
import { useTranslation } from '@zoeymind/i18n'

interface AIWelcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStartGuide: () => void
}

export function AIWelcomeDialog({ open, onOpenChange, onStartGuide }: AIWelcomeDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] space-y-6 [&>button]:hidden">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="size-16 rounded-full bg-primary flex items-center justify-center">
            <svg
              className="size-8 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {t('mindmap.guides.welcomeTitle')}
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              {t('mindmap.guides.welcomeDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="w-full space-y-3 text-left">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">1</span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm mb-1">
                  {t('mindmap.guides.welcomeAgentTitle')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('mindmap.guides.welcomeAgentDesc')}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">2</span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm mb-1">
                  {t('mindmap.guides.welcomeGenTitle')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('mindmap.guides.welcomeGenDesc')}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Database className="size-3 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm mb-1">{t('mindmap.guides.welcomeKbTitle')}</div>
                <div className="text-xs text-muted-foreground">
                  {t('mindmap.guides.welcomeKbDesc')}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              {t('mindmap.guides.welcomeLater')}
            </Button>
            <Button className="flex-1" onClick={onStartGuide}>
              {t('mindmap.guides.welcomeStart')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
