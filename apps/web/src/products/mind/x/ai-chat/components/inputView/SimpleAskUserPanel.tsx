/**
 * SimpleAskUserPanel - AI `question` 工具的应答面板（单题分页，模块化）。
 *
 * 结构（无顶部 header）：
 *   - 主体：问题行（左侧 index 徽标 + 问题文本）+ 选项区 / 或编辑态全屏 textarea。
 *   - 底部 footer：常驻 Skip（左）+ 左右切换箭头 + 主按钮（非末题「下一步」/ 末题「全部提交」）。
 *
 * 自定义选项：固定常驻为选项区最后一项。点击进入「编辑态」——选项区整块被一个可换行
 * 的 textarea + 确认/取消替换；确认后自定义值落为底部一个可二次编辑的选项，并自动跳下一题
 * （末题则停留、由用户点提交）。取消则保留当前题。
 */

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Button, Textarea } from "@zoeymind/ui"
import { Check, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react"
import { cn } from "@/shared/app-shared"
import { useTranslation } from "@zoeymind/i18n"

interface QuestionOption {
  label: string
  description?: string
}

export interface SimpleAskUserQuestion {
  header?: string
  question: string
  options?: QuestionOption[]
  multiple?: boolean
  placeholder?: string
}

interface QuestionItem {
  id: string
  question: string
  options?: QuestionOption[]
  multiple?: boolean
  placeholder?: string
  answer?: unknown
}

export interface SimpleAskUserPanelProps {
  questions: SimpleAskUserQuestion[]
  /** 用户提交时调; 每题返回 string[] (单选时长度 1, 多选时长度 0..N) */
  onSubmit: (responses: string[][]) => void
  /** 用户点跳过时调. 不传则隐藏跳过按钮 */
  onSkip?: () => void
}

const OPTION_ROW_CLASS =
  "w-full text-left px-2 py-1 rounded transition-colors hover:bg-muted/50 active:bg-muted/70"

export function SimpleAskUserPanel({
  questions: incomingQuestions,
  onSubmit,
  onSkip,
}: SimpleAskUserPanelProps) {
  const { t } = useTranslation()
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  // 自定义编辑态（仅作用于当前题）
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState("")
  // 多选时正在编辑的既有自定义值（null = 新增）
  const [editingValue, setEditingValue] = useState<string | null>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setQuestions(
        incomingQuestions.map((q, i) => ({
          id: `q${i}`,
          question: q.question,
          options: q.options,
          multiple: q.multiple,
          placeholder: q.placeholder,
          answer: q.multiple ? [] : undefined,
        }))
      )
      setCurrentIndex(0)
      setIsEditing(false)
      setDraft("")
      setEditingValue(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [incomingQuestions])

  const totalQuestions = questions.length
  const currentQuestion = questions[currentIndex]
  const isFirst = currentIndex === 0
  const isLast = currentIndex === totalQuestions - 1
  const hasOptions = !!(currentQuestion?.options && currentQuestion.options.length > 0)

  const customAnswers: string[] = (() => {
    if (!currentQuestion) return []
    const opts = currentQuestion.options ?? []
    if (currentQuestion.multiple) {
      return ((currentQuestion.answer as string[]) || []).filter(
        a => !opts.some(o => o.label === a)
      )
    }
    const a = currentQuestion.answer
    return typeof a === "string" && a && !opts.some(o => o.label === a) ? [a] : []
  })()

  const handleAnswerChange = (questionId: string, answer: unknown) => {
    setQuestions(prev => prev.map(q => (q.id === questionId ? { ...q, answer } : q)))
  }

  const exitEdit = () => {
    setIsEditing(false)
    setDraft("")
    setEditingValue(null)
  }

  const advanceAfterAnswer = () => {
    if (currentIndex < totalQuestions - 1) {
      setTimeout(() => setCurrentIndex(i => i + 1), 150)
    }
  }

  const goPrev = () => {
    if (isFirst) return
    exitEdit()
    setCurrentIndex(i => i - 1)
  }

  const goNext = () => {
    if (isLast) return
    exitEdit()
    setCurrentIndex(i => i + 1)
  }

  const isOptionSelected = (optionLabel: string) => {
    if (!currentQuestion) return false
    if (currentQuestion.multiple) {
      return (
        Array.isArray(currentQuestion.answer) &&
        (currentQuestion.answer as string[]).includes(optionLabel)
      )
    }
    return currentQuestion.answer === optionLabel
  }

  const handleOptionSelect = (optionLabel: string) => {
    if (!currentQuestion) return
    if (currentQuestion.multiple) {
      const current = (currentQuestion.answer as string[]) || []
      const next = current.includes(optionLabel)
        ? current.filter(a => a !== optionLabel)
        : [...current, optionLabel]
      handleAnswerChange(currentQuestion.id, next)
    } else {
      handleAnswerChange(currentQuestion.id, optionLabel)
      advanceAfterAnswer()
    }
  }

  const startCustomEdit = (existingValue?: string) => {
    setEditingValue(existingValue ?? null)
    setDraft(existingValue ?? "")
    setIsEditing(true)
  }

  const confirmCustomEdit = () => {
    if (!currentQuestion) return
    const value = draft.trim()
    if (!value) {
      exitEdit()
      return
    }
    if (currentQuestion.multiple) {
      const current = (currentQuestion.answer as string[]) || []
      const next =
        editingValue !== null
          ? current.map(a => (a === editingValue ? value : a))
          : current.includes(value)
            ? current
            : [...current, value]
      handleAnswerChange(currentQuestion.id, next)
      exitEdit()
    } else {
      handleAnswerChange(currentQuestion.id, value)
      exitEdit()
      advanceAfterAnswer()
    }
  }

  const hasAnswer = () => {
    if (!currentQuestion) return false
    if (currentQuestion.multiple) {
      return (
        Array.isArray(currentQuestion.answer) && (currentQuestion.answer as string[]).length > 0
      )
    }
    return typeof currentQuestion.answer === "string" && currentQuestion.answer.length > 0
  }

  const handleSubmit = () => {
    const responses = questions.map(q => {
      if (Array.isArray(q.answer)) return [...(q.answer as string[])]
      if (typeof q.answer === "string" && q.answer) return [q.answer]
      return []
    })
    onSubmit(responses)
    setQuestions([])
  }

  const handleSkip = () => {
    onSkip?.()
    setQuestions([])
  }

  if (!currentQuestion) return null

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      <div className="mb-2 rounded-md border bg-muted/50">
        {/* 主体 */}
        <div className="px-2 py-2">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* 问题行：左侧 index 徽标 + 问题 */}
            <div className="mb-2 flex items-start gap-1.5">
              <span className="mt-px flex size-4 flex-shrink-0 items-center justify-center rounded bg-muted text-[9px] font-medium text-muted-foreground tabular-nums">
                {currentIndex + 1}
              </span>
              <p className="flex-1 text-[11px] leading-snug text-foreground">
                {currentQuestion.question}
              </p>
            </div>

            {isEditing ? (
              /* 编辑态：整块换为可换行 textarea + 确认/取消 */
              <div className="space-y-1.5">
                <Textarea
                  autoFocus
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    e.stopPropagation()
                    if (e.key === "Escape") {
                      e.preventDefault()
                      exitEdit()
                    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      confirmCustomEdit()
                    }
                  }}
                  placeholder={t("mindmap.aiChat.input.askUserCustomOptionPlaceholder")}
                  rows={3}
                  className="min-h-[64px] resize-none text-[11px]"
                />
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={exitEdit}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={confirmCustomEdit}
                    disabled={!draft.trim()}
                  >
                    <Check className="mr-0.5 size-3" />
                    {t("mindmap.aiChat.input.askUserConfirm")}
                  </Button>
                </div>
              </div>
            ) : hasOptions ? (
              /* 选项态 */
              <div className="space-y-1">
                {currentQuestion.options!.map((option, i) => {
                  const selected = isOptionSelected(option.label)
                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => handleOptionSelect(option.label)}
                      className={cn(OPTION_ROW_CLASS, selected && "bg-primary/10 text-primary")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] leading-tight">{option.label}</div>
                          {option.description && (
                            <div className="mt-0.5 text-[9px] text-muted-foreground">
                              {option.description}
                            </div>
                          )}
                        </div>
                        {selected && <Check className="mt-0.5 size-3 flex-shrink-0 text-primary" />}
                      </div>
                    </button>
                  )
                })}

                {/* 已确认的自定义选项：可二次编辑 */}
                {customAnswers.map((customValue, i) => (
                  <button
                    type="button"
                    key={`custom-${i}`}
                    onClick={() => startCustomEdit(customValue)}
                    className={cn(OPTION_ROW_CLASS, "bg-primary/10 text-primary")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-1">
                        <Pencil className="size-2.5 flex-shrink-0 opacity-60" />
                        <span className="truncate text-[11px] leading-tight">{customValue}</span>
                      </div>
                      <Check className="mt-0.5 size-3 flex-shrink-0 text-primary" />
                    </div>
                  </button>
                ))}

                {/* 自定义入口：固定常驻为最后一项（单选已有自定义时并入上面的可编辑项） */}
                {(currentQuestion.multiple || customAnswers.length === 0) && (
                  <button
                    type="button"
                    onClick={() => startCustomEdit()}
                    className={cn(OPTION_ROW_CLASS, "text-[11px] text-muted-foreground")}
                  >
                    {currentQuestion.multiple
                      ? t("mindmap.aiChat.input.askUserAddCustomOption")
                      : t("mindmap.aiChat.input.askUserCustomInput")}
                  </button>
                )}
              </div>
            ) : (
              /* 纯文本题：可换行 textarea */
              <Textarea
                value={(currentQuestion.answer as string) || ""}
                onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)}
                onKeyDown={e => {
                  e.stopPropagation()
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && hasAnswer()) {
                    e.preventDefault()
                    if (isLast) handleSubmit()
                    else goNext()
                  }
                }}
                placeholder={
                  currentQuestion.placeholder || t("mindmap.aiChat.input.askUserDefaultPlaceholder")
                }
                rows={3}
                className="min-h-[64px] resize-none text-[11px]"
              />
            )}
          </motion.div>
        </div>

        {/* 底部 footer：编辑态隐藏，聚焦输入 */}
        {!isEditing && (
          <div className="flex items-center justify-between border-t px-2 py-1">
            <div className="flex items-center gap-0.5">
              {onSkip && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={handleSkip}
                >
                  <X className="mr-0.5 size-2.5" />
                  {t("mindmap.aiChat.input.askUserSkip")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={goPrev}
                disabled={isFirst}
                title={t("common.prev")}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="px-0.5 text-[10px] text-muted-foreground tabular-nums">
                {currentIndex + 1}/{totalQuestions}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={goNext}
                disabled={isLast}
                title={t("common.next")}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>

            {isLast ? (
              <Button size="sm" className="h-6 px-2 text-[10px]" onClick={handleSubmit}>
                <Check className="mr-1 size-2.5" />
                {t("mindmap.aiChat.input.askUserSubmitAll")}
              </Button>
            ) : (
              <Button size="sm" className="h-6 px-2 text-[10px]" onClick={goNext}>
                {t("common.next")}
                <ChevronRight className="ml-0.5 size-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
