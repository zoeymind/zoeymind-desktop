import React, { useState } from 'react'
import { Hash } from 'lucide-react'
import { Button } from '@zoeymind/ui'
import { Badge } from '@zoeymind/ui'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@zoeymind/ui'
import { Textarea } from '@zoeymind/ui'
import { cn } from '@/shared/app-shared'
import { useTranslation } from '@zoeymind/i18n'
import type { CaseConfirmItem } from '../../../ai-chat/types'

interface CaseConfirmPanelProps {
  disabled?: boolean
  cases: CaseConfirmItem[]
  operation: 'add_cases' | 'update_cases' | 'delete_cases'
  onConfirm: (
    results: Record<string, { action: 'accept' | 'reject'; feedback?: string }>
  ) => Promise<void>
}

const getPriorityMeta = (text: string) => {
  const match = text.match(/\[(P[1-3])\]/i)
  const priority = match ? match[1].toUpperCase() : null
  const title = match ? text.replace(match[0], '').trim() : text
  return { priority, title }
}

const getPriorityIcon = (priority: string | null) => {
  const config = {
    P1: { label: '1', bg: 'bg-destructive' },
    P2: { label: '2', bg: 'bg-warning' },
    P3: { label: '3', bg: 'bg-muted' }
  } as const

  const key = (priority || 'P3') as keyof typeof config
  const { label, bg } = config[key]

  return (
    <span
      className={`inline-flex size-5 items-center justify-center rounded-full ${bg} flex-shrink-0`}
    >
      <span className="text-[9px] font-semibold text-white">{label}</span>
    </span>
  )
}

export const CaseConfirmPanel: React.FC<CaseConfirmPanelProps> = ({
  disabled,
  cases,
  operation,
  onConfirm
}) => {
  const { t } = useTranslation()
  const operationLabels: Record<CaseConfirmPanelProps['operation'], string> = {
    add_cases: t('mindmap.aiChat.input.caseConfirmAddTitle'),
    update_cases: t('mindmap.aiChat.input.caseConfirmUpdateTitle'),
    delete_cases: t('mindmap.aiChat.input.caseConfirmDeleteTitle')
  }
  const [caseSelections, setCaseSelections] = useState<
    Record<string, { selected: boolean; feedback?: string }>
  >({})

  const handleToggleSelection = (caseId: string) => {
    setCaseSelections(prev => ({
      ...prev,
      [caseId]: {
        selected: !prev[caseId]?.selected,
        feedback: prev[caseId]?.feedback
      }
    }))
  }

  const handleFeedbackChange = (caseId: string, feedback: string) => {
    setCaseSelections(prev => ({
      ...prev,
      [caseId]: {
        selected: true,
        feedback
      }
    }))
  }

  const handleRejectAll = async () => {
    const allActions: Record<string, { action: 'accept' | 'reject'; feedback?: string }> = {}
    cases.forEach(item => {
      allActions[item.caseId] = { action: 'reject' }
    })
    await onConfirm(allActions)
  }

  const handleSubmit = async () => {
    const results: Record<string, { action: 'accept' | 'reject'; feedback?: string }> = {}
    cases.forEach(item => {
      const selection = caseSelections[item.caseId]
      if (selection?.selected) {
        results[item.caseId] = { action: 'reject', feedback: selection.feedback }
      } else {
        results[item.caseId] = { action: 'accept' }
      }
    })
    await onConfirm(results)
  }

  return (
    <div className="absolute left-0 right-0 -top-2 -translate-y-full px-2 z-10">
      <Card className="flex h-[320px] flex-col shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md border bg-background">
              <Hash className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-xs">{operationLabels[operation]}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-[10px] font-normal">
            {t('mindmap.aiChat.input.caseConfirmItemCount', { value: cases.length })}
          </Badge>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto px-3 pb-2 pt-0">
          <div className="space-y-2">
            <div className="text-[10px] text-muted-foreground">
              {t('mindmap.aiChat.input.caseConfirmHint')}
            </div>
            {cases.map(item => {
              const selection = caseSelections[item.caseId]
              const isSelected = selection?.selected
              const feedback = selection?.feedback
              const { priority, title } = getPriorityMeta(item.caseText)

              return (
                <div
                  key={item.caseId}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'border rounded-md px-3 py-2 transition-all cursor-pointer',
                    isSelected
                      ? 'border-warning bg-warning/40'
                      : 'border-border hover:border-border'
                  )}
                  onClick={() => handleToggleSelection(item.caseId)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleToggleSelection(item.caseId)
                    }
                  }}
                >
                  <div className="flex items-start gap-2">
                    {getPriorityIcon(priority)}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-foreground leading-tight whitespace-pre-wrap">
                        {title}
                      </div>
                    </div>
                  </div>

                  {item.steps && item.steps.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {item.steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="w-full text-[11px] text-muted-foreground flex items-start gap-2 rounded-sm bg-muted px-0 py-1"
                        >
                          <span className="flex-shrink-0 text-muted-foreground">{idx + 1}.</span>
                          <span className="flex-1">
                            {step
                              .split('\n')
                              .filter(line => line.trim().length > 0)
                              .map((line, lineIndex) => (
                                <span key={lineIndex} className="block">
                                  {line}
                                </span>
                              ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isSelected && (
                    <div className="mt-2" onClick={event => event.stopPropagation()}>
                      <Textarea
                        disabled={disabled}
                        placeholder={t('mindmap.aiChat.input.caseConfirmFeedbackPlaceholder')}
                        className="text-[11px] min-h-[36px] resize-none"
                        value={feedback || ''}
                        onChange={e => handleFeedbackChange(item.caseId, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between px-3 py-2">
          <div className="text-[10px] text-muted-foreground">
            {t('mindmap.aiChat.input.caseConfirmSelectedCount', {
              selected: Object.values(caseSelections).filter(item => item?.selected).length,
              total: cases.length
            })}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="h-6 px-3 text-[11px]"
              onClick={handleRejectAll}
            >
              {t('mindmap.aiChat.input.caseConfirmRejectAll')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              className="h-6 px-3 text-[11px]"
              onClick={handleSubmit}
            >
              {t('mindmap.aiChat.input.caseConfirmAccept')}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
