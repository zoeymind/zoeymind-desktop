// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
/**
 * MentionEditor - 基于 Lexical + lexical-beautiful-mentions 的通用 @mention 输入框。
 *
 * 取代旧的 react-mentions。被 AI 对话输入框（InputBox）和评论输入框（CommentTextarea）共用。
 *
 * 对外契约（与下游解析一致，迁移自 react-mentions 时保持不变）：
 *   - value: 含 @[name](id) 标记的纯文本
 *   - onChange(value): 编辑器内容序列化为同一标记格式
 * 触发符固定为 @；建议来源、菜单项渲染、pill 样式、键盘行为均可配置。
 */

import React, { forwardRef, useCallback, useMemo, useRef } from 'react'
import { User } from 'lucide-react'
import {
  $getRoot,
  $createParagraphNode,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  type EditorState
} from 'lexical'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  BeautifulMentionNode,
  BeautifulMentionsPlugin,
  type BeautifulMentionsItem,
  type BeautifulMentionsMenuProps,
  type BeautifulMentionsMenuItemProps
} from 'lexical-beautiful-mentions'
import { cn } from '@/shared/app-shared'
import {
  MENTION_TRIGGER,
  MENTION_DATA_ID_KEY,
  $createNodesFromMarkup,
  $serializeToMarkup
} from '@/products/mind/features/mindmap/utils/lexical-mentions'

/** 建议项：value 为显示名，id 为被提及实体 id，其余为可选展示数据（如头像） */
export interface MentionEditorSuggestion {
  value: string
  id: string
  avatar?: string | null
}

export interface MentionEditorProps {
  /** 含 @[name](id) 标记的纯文本 */
  value: string
  /** 内容变化回调，回传同一标记格式 */
  onChange: (value: string) => void
  /** 键盘事件（Enter/Cmd+Enter/Escape 等由消费方决定语义）。mention 菜单打开时 Enter 不会冒泡到此处 */
  onKeyDown?: (e: React.KeyboardEvent) => void
  /** 按 query 返回建议列表（消费方决定数据源与过滤） */
  onSearch: (query: string) => MentionEditorSuggestion[]
  /** 菜单打开时触发（可用于按需拉取数据，限频由消费方控制） */
  onMentionTrigger?: () => void
  /** 菜单项是否渲染头像（评论 @用户用）。默认 false */
  showAvatar?: boolean
  placeholder?: string
  disabled?: boolean
  /** 紧凑模式：更小字号/内距 */
  compact?: boolean
  /** mention pill 的 className（默认主色淡底） */
  pillClassName?: string
  /** 粘贴文件回调（AI 输入框传图片用） */
  onPasteMedia?: (files: File[]) => void
  /** 挂载后自动聚焦 */
  autoFocus?: boolean
  /** ContentEditable 容器额外 className */
  className?: string
}

/** 建议菜单容器：浮在输入框上方/下方，复用 popover token */
const MentionMenu = forwardRef<HTMLUListElement, BeautifulMentionsMenuProps>(
  ({ loading: _loading, ...props }, ref) => (
    <ul
      ref={ref}
      className="absolute bottom-full left-0 z-10 mb-1.5 max-h-[240px] min-w-[180px] max-w-[280px] overflow-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
      {...props}
    />
  )
)
MentionMenu.displayName = 'MentionMenu'

/** 创建菜单项组件：showAvatar 决定显示头像还是无图标 */
function createMentionMenuItem(showAvatar: boolean) {
  const Item = forwardRef<HTMLLIElement, BeautifulMentionsMenuItemProps>(
    ({ selected, item, itemValue: _itemValue, label: _label, ...props }, ref) => {
      const avatar = item.data?.avatar
      return (
        <li
          ref={ref}
          className={cn(
            'flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-xs transition-colors last:border-b-0',
            selected && 'bg-muted'
          )}
          {...props}
        >
          {showAvatar &&
            (avatar ? (
              <img
                src={String(avatar)}
                alt={item.value}
                className="size-6 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="size-4 text-muted-foreground" />
              </div>
            ))}
          <span className="max-w-[200px] truncate">{item.value}</span>
        </li>
      )
    }
  )
  Item.displayName = 'MentionMenuItem'
  return Item
}

/** 在 EditorState 上读取序列化标记 */
function $readEditorMarkup(state: EditorState): string {
  let result = ''
  state.read(() => {
    result = $serializeToMarkup()
  })
  return result
}

/**
 * 把外部 value（@[name](id) 标记）同步进编辑器。
 * 仅在外部 value 与当前序列化结果不一致时重建内容（如提交后清空、恢复草稿）。
 */
const ControlledValuePlugin: React.FC<{ value: string }> = ({ value }) => {
  const [editor] = useLexicalComposerContext()
  const lastSyncedRef = useRef<string | null>(null)

  if (lastSyncedRef.current === null) {
    lastSyncedRef.current = value
  } else if (lastSyncedRef.current !== value) {
    const current = $readEditorMarkup(editor.getEditorState())
    if (current !== value) {
      editor.update(() => {
        const root = $getRoot()
        root.clear()
        const paragraph = $createParagraphNode()
        paragraph.append(...$createNodesFromMarkup(value))
        root.append(paragraph)
      })
    }
    lastSyncedRef.current = value
  }

  return null
}

/** Enter 命令转交消费方：低优先级，mention 菜单打开时插件已在高优先级拦截 Enter */
const EnterCommandPlugin: React.FC<{
  onEnter?: (e: React.KeyboardEvent) => void
}> = ({ onEnter }) => {
  const [editor] = useLexicalComposerContext()
  React.useEffect(() => {
    if (!onEnter) return
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      event => {
        if (event) {
          onEnter(event as unknown as React.KeyboardEvent)
          // 仅当 Enter（无修饰键、非 Shift）时阻断默认换行；其余交还编辑器
          if (!event.shiftKey && !event.metaKey && !event.ctrlKey) {
            return true
          }
        }
        return false
      },
      COMMAND_PRIORITY_LOW
    )
  }, [editor, onEnter])
  return null
}

/**
 * 运行时切换编辑器只读态。
 * editable 只在 initialConfig 里算一次，因此 disabled 变化必须通过 setEditable 生效，
 * 从而让同一个编辑器实例在“只读 ↔ 可编辑”之间切换而不重新挂载。
 * 从只读切换为可编辑时把焦点移入编辑器，让文字光标出现（复用实例不会自动聚焦）。
 */
const EditablePlugin: React.FC<{ disabled: boolean }> = ({ disabled }) => {
  const [editor] = useLexicalComposerContext()
  const previousDisabledRef = useRef(disabled)
  React.useEffect(() => {
    editor.setEditable(!disabled)

    const wasDisabled = previousDisabledRef.current
    previousDisabledRef.current = disabled

    // 仅在“只读 → 可编辑”这次变化时聚焦，避免每次渲染都抢焦点。
    // 用 rAF 等 setEditable 的 DOM 更新落地后再聚焦，避免同步时序把焦点丢掉。
    if (wasDisabled && !disabled) {
      const rafId = requestAnimationFrame(() => {
        editor.focus(undefined, { defaultSelection: 'rootEnd' })
      })
      return () => cancelAnimationFrame(rafId)
    }
    return undefined
  }, [editor, disabled])
  return null
}

export const MentionEditor = forwardRef<HTMLDivElement, MentionEditorProps>(
  (
    {
      value,
      onChange,
      onKeyDown,
      onSearch,
      onMentionTrigger,
      showAvatar = false,
      placeholder,
      disabled = false,
      compact = false,
      pillClassName,
      onPasteMedia,
      autoFocus = false,
      className
    },
    ref
  ) => {
    const initialConfig = useMemo(
      () => ({
        namespace: 'mention-editor',
        theme: {
          beautifulMentions: {
            '@': pillClassName ?? 'rounded bg-primary/15 text-primary px-0.5'
          }
        },
        nodes: [BeautifulMentionNode],
        editable: !disabled,
        onError: (error: Error) => {
          throw error
        },
        editorState: () => {
          const root = $getRoot()
          if (root.getFirstChild() === null) {
            const paragraph = $createParagraphNode()
            if (value) {
              paragraph.append(...$createNodesFromMarkup(value))
            }
            root.append(paragraph)
          }
        }
      }),
      // 仅挂载时构建一次；后续 value 由 ControlledValuePlugin 同步
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    )

    const MenuItem = useMemo(() => createMentionMenuItem(showAvatar), [showAvatar])

    const handleSearch = useCallback(
      (_trigger: string, query?: string | null): Promise<BeautifulMentionsItem[]> => {
        onMentionTrigger?.()
        const items: BeautifulMentionsItem[] = onSearch(query ?? '').map(s => ({
          value: s.value,
          [MENTION_DATA_ID_KEY]: s.id,
          avatar: s.avatar ?? null
        }))
        return Promise.resolve(items)
      },
      [onSearch, onMentionTrigger]
    )

    const handleEditorChange = useCallback(
      (state: EditorState) => {
        onChange($readEditorMarkup(state))
      },
      [onChange]
    )

    const handlePaste = useCallback(
      (event: React.ClipboardEvent) => {
        if (!onPasteMedia) return
        const items = event.clipboardData.items
        const files: File[] = []
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.kind === 'file') {
            const file = item.getAsFile()
            if (file) files.push(file)
          }
        }
        if (files.length > 0) {
          onPasteMedia(files)
        }
      },
      [onPasteMedia]
    )

    return (
      <div
        ref={ref}
        className={cn('relative', compact ? 'text-xs' : 'text-sm')}
        onKeyDown={e => e.stopPropagation()}
        onCopy={e => e.stopPropagation()}
        onPaste={e => e.stopPropagation()}
        onCut={e => e.stopPropagation()}
      >
        <LexicalComposer initialConfig={initialConfig}>
          <div className="relative">
            <PlainTextPlugin
              contentEditable={
                <ContentEditable
                  className={cn(
                    'max-h-[100px] w-full resize-none overflow-auto outline-none',
                    compact ? 'min-h-[20px] py-[3px]' : 'min-h-[24px] py-[5px]',
                    !disabled && 'cursor-text',
                    className
                  )}
                  onKeyDown={onKeyDown}
                  onPaste={handlePaste}
                  aria-disabled={disabled}
                />
              }
              placeholder={
                <div
                  className={cn(
                    'pointer-events-none absolute left-0 text-muted-foreground/60',
                    compact ? 'top-[3px]' : 'top-[5px]'
                  )}
                >
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <BeautifulMentionsPlugin
            triggers={[MENTION_TRIGGER]}
            onSearch={handleSearch}
            menuComponent={MentionMenu}
            menuItemComponent={MenuItem}
            allowSpaces
            creatable={false}
            menuItemLimit={20}
          />
          <OnChangePlugin onChange={handleEditorChange} />
          <ControlledValuePlugin value={value} />
          <EnterCommandPlugin onEnter={onKeyDown} />
          <EditablePlugin disabled={disabled} />
          {autoFocus && <AutoFocusPlugin />}
        </LexicalComposer>
      </div>
    )
  }
)
MentionEditor.displayName = 'MentionEditor'
