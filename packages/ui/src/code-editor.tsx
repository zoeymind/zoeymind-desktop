import React from 'react'
import AceEditorImport from 'react-ace'

import 'ace-builds/src-noconflict/mode-python'
import 'ace-builds/src-noconflict/snippets/python'
import 'ace-builds/src-noconflict/theme-one_dark'
import 'ace-builds/src-noconflict/ext-language_tools'

// 兼容 CJS/ESM 导出差异
const AceEditor =
  (AceEditorImport as unknown as { default: typeof AceEditorImport }).default || AceEditorImport

import { cn } from './cn'

interface CodeEditorProps {
  /** 代码内容 */
  value: string
  /** 内容变更回调 */
  onChange?: (value: string) => void
  /** 编程语言，默认 python */
  language?: string
  /** 占位符文本 */
  placeholder?: string
  /** 编辑器高度，默认 200px */
  height?: string
  /** 是否只读 */
  readOnly?: boolean
  /** 自定义类名 */
  className?: string
}

/**
 * 基于 Ace Editor 的代码编辑器组件
 * 内置 Python 语法高亮、关键字/内置函数补全、代码片段、Tab 缩进等
 */
export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'python',
  placeholder,
  height = '200px',
  readOnly = false,
  className
}) => {
  return (
    <div className={cn('rounded-md border overflow-hidden', className)}>
      <AceEditor
        mode={language}
        theme="one_dark"
        value={value}
        onChange={onChange}
        name={`code-editor-${React.useId()}`}
        width="100%"
        height={height}
        fontSize={13}
        showGutter={true}
        showPrintMargin={false}
        highlightActiveLine={true}
        readOnly={readOnly}
        placeholder={placeholder}
        tabSize={4}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
          showLineNumbers: true,
          tabSize: 4,
          useSoftTabs: true,
          wrap: true
        }}
        editorProps={{ $blockScrolling: Infinity }}
      />
    </div>
  )
}
