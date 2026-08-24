/**
 * Error Boundary 组件
 *
 * 捕获工具执行和 UI 渲染中的错误，防止整个 AI Chat 崩溃
 */

import React, { Component, type ReactNode } from "react"
import { AlertCircle } from "lucide-react"
import { logger } from "@zoeymind/logger"
import { i18next } from "@zoeymind/i18n"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 记录错误日志
    logger.error("[ErrorBoundary] 捕获错误", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })

    // 调用外部错误处理器（如果有）
    this.props.onError?.(error, errorInfo)
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  override render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 默认错误 UI
      return (
        <div className="flex items-center justify-center p-4 bg-destructive/10 border border-destructive/20 rounded-md m-2">
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="size-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-destructive">
                {i18next.t("mindmap.aiChat.core.componentError")}
              </div>
              <div className="text-destructive text-xs mt-1">
                {this.state.error?.message || i18next.t("mindmap.aiChat.core.unknownError")}
              </div>
              <button
                type="button"
                onClick={this.resetError}
                className="mt-2 text-xs text-destructive hover:text-destructive underline"
              >
                {i18next.t("common.retry")}
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * 工具执行错误边界（轻量级）
 * 专门用于包裹单个工具卡片
 */
export const ToolErrorBoundary: React.FC<{ children: ReactNode; toolName?: string }> = ({
  children,
  toolName,
}) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
          {i18next.t("mindmap.aiChat.core.toolRenderFailed", { toolName: toolName || "" })}
        </div>
      }
      onError={error => {
        logger.error(`[ToolErrorBoundary] 工具 ${toolName} 渲染错误`, {
          error: error.message,
          stack: error.stack,
        })
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
