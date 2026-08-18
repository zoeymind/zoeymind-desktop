/**
 * InputBox - AI 对话文本输入框（@模块提及）。
 *
 * 基于通用 MentionEditor；建议来源为思维导图模块列表，pill 为主色淡底，
 * 回车发送（mention 菜单打开时由 MentionEditor 拦截 Enter，不会误发）。
 * 对外接口（value/onChange/onKeyDown/onPasteMedia）与历史实现保持一致。
 */

import React, { useCallback } from 'react'
import {
  MentionEditor,
  type MentionEditorSuggestion
} from '@/products/mind/features/mindmap/components/MentionEditor/MentionEditor'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useMindMapModules } from '@/products/mind/features/mindmap/hooks/useMindMapModules'
import { MENTION_PILL_CLASS } from '../../../ai-chat/utils/mentions'
import { useTranslation } from '@zoeymind/i18n'

interface InputBoxProps {
  value: string
  onChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  placeholder?: string
  disabled?: boolean
  onPasteMedia?: (files: File[]) => void
}

export const InputBox: React.FC<InputBoxProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled = false,
  onPasteMedia
}) => {
  const { t } = useTranslation()
  const effectivePlaceholder = placeholder ?? t('mindmap.aiChat.input.inputPlaceholder')
  const { mindMap } = useMindMapStore()
  const { moduleList, refreshModules } = useMindMapModules(mindMap)

  const handleSearch = useCallback(
    (query: string): MentionEditorSuggestion[] => {
      const q = query.toLowerCase()
      return moduleList
        .filter(m => (q ? m.display.toLowerCase().includes(q) : true))
        .map(m => ({ value: m.display, id: m.id }))
    },
    [moduleList]
  )

  return (
    <MentionEditor
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onSearch={handleSearch}
      onMentionTrigger={refreshModules}
      placeholder={effectivePlaceholder}
      disabled={disabled}
      compact
      pillClassName={MENTION_PILL_CLASS}
      className="max-h-[200px]"
      onPasteMedia={onPasteMedia}
    />
  )
}
