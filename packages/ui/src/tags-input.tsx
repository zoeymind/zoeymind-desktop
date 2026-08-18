'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import { cn } from '#lib/utils'
import { Badge } from '#components/badge'

export interface TagsInputProps {
  /** 当前标签列表 */
  value: string[]
  /** 标签变化回调 */
  onChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  /** 提交前校验单个标签，返回 false 则拒绝加入 */
  validate?: (tag: string) => boolean
  /** 触发"提交为标签"的按键，默认回车与逗号 */
  addKeys?: string[]
  className?: string
  inputClassName?: string
  'aria-label'?: string
}

/**
 * TagsInput — 标签输入框（自由输入 + 回车成 chip）。
 *
 * shadcn/ui (React) 官方无此组件，按设计系统用 Badge + input 组合实现，
 * 复用 token 与聚焦态，行为对齐 shadcn 输入控件。
 */
function TagsInput({
  value,
  onChange,
  placeholder,
  disabled,
  validate,
  addKeys = ['Enter', ','],
  className,
  inputClassName,
  'aria-label': ariaLabel
}: TagsInputProps) {
  const [input, setInput] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const addTag = (raw: string): void => {
    const tag = raw.trim().replace(/,+$/, '').trim()
    if (!tag) return
    if (validate && !validate(tag)) return
    if (value.includes(tag)) {
      setInput('')
      return
    }
    onChange([...value, tag])
    setInput('')
  }

  const removeTag = (tag: string): void => onChange(value.filter(t => t !== tag))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (addKeys.includes(e.key)) {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && input.length === 0 && value.length > 0) {
      removeTag(value[value.length - 1]!)
    }
  }

  return (
    <div
      data-slot="tags-input"
      data-disabled={disabled || undefined}
      onClick={() => inputRef.current?.focus()}
      className={cn(
        'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 dark:bg-input/30',
        className
      )}
    >
      {value.map(tag => (
        <Badge key={tag} variant="secondary" className="max-w-full gap-1 pr-1 font-normal">
          <span className="truncate">{tag}</span>
          {!disabled && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Remove ${tag}`}
              onClick={e => {
                e.stopPropagation()
                removeTag(tag)
              }}
              className="rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          )}
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={input}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={value.length === 0 ? placeholder : undefined}
        className={cn(
          'min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed',
          inputClassName
        )}
      />
    </div>
  )
}

export { TagsInput }
