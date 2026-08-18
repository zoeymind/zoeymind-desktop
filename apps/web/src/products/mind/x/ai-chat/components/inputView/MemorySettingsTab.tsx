// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * 长期记忆 (Semantic Recall) 设置 Tab — 由设置 Dialog 渲染.
 *
 * 状态展示:
 *   - disabled: 只显示总开关 + 简介
 *   - downloading-model: 进度条 + bytes 进度
 *   - loading-model: spinner + 文案
 *   - ready: ✓ + 索引统计 + 召回参数滑块 + 清空按钮
 *   - backfilling: ready 之上叠加回填进度
 *   - error: 红字 + 重试按钮
 */

import { Switch, Label, Button, Progress, Slider } from '@zoeymind/ui'
import { useTranslation } from '@zoeymind/i18n'
import { AlertCircle, RotateCcw, Trash2, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/shared/app-shared'
import { useMemoryStatus } from '../../../ai-chat/memory/useMemoryStatus'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function MemorySettingsTab() {
  const { t } = useTranslation()
  const {
    enabled,
    modelStatus,
    backfill,
    stats,
    recallK,
    setEnabled,
    setRecallK,
    clearAll,
    retryLoad
  } = useMemoryStatus()

  return (
    <div className="flex flex-col gap-5 py-2">
      {/* 总开关 + 简介 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="memory-enabled" className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" />
            {t('mindmap.aiChat.memory.enableLabel')}
          </Label>
          <p className="text-xs text-muted-foreground max-w-md">
            {t('mindmap.aiChat.memory.enableHint')}
          </p>
        </div>
        <Switch id="memory-enabled" checked={enabled} onCheckedChange={setEnabled} />
      </div>
      {/* 状态详情 — 只在启用时显示 */}
      {enabled && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          {/* 模型加载状态 */}
          {/* idle 状态 (mount 后到 embedder.load() 触发前的过渡帧, < 1ms 但补一个兜底) */}
          {modelStatus.kind === 'idle' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>{t('mindmap.aiChat.memory.statusLoading')}</span>
            </div>
          )}

          {modelStatus.kind === 'downloading-model' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>{t('mindmap.aiChat.memory.statusDownloading')}</span>
              </div>
              <Progress value={modelStatus.progress * 100} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {modelStatus.loadedBytes > 0
                    ? `${formatBytes(modelStatus.loadedBytes)} / ${formatBytes(modelStatus.totalBytes)}`
                    : ''}
                </span>
                <span>{Math.round(modelStatus.progress * 100)}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('mindmap.aiChat.memory.statusDownloadingHint')}
              </p>
            </div>
          )}

          {modelStatus.kind === 'loading-model' && (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>{t('mindmap.aiChat.memory.statusLoading')}</span>
            </div>
          )}

          {modelStatus.kind === 'error' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4" />
                <span>{t('mindmap.aiChat.memory.statusError')}</span>
              </div>
              <p className="text-xs text-muted-foreground break-words">{modelStatus.message}</p>
              <Button variant="outline" size="sm" onClick={retryLoad} className="gap-1">
                <RotateCcw className="size-3" />
                {t('mindmap.aiChat.memory.retryLoad')}
              </Button>
            </div>
          )}

          {modelStatus.kind === 'ready' && (
            <>
              {/* Ready 状态 */}
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-success" />
                <span className="font-medium">{t('mindmap.aiChat.memory.statusReady')}</span>
              </div>

              {/* 回填进度 (如果在跑) */}
              {backfill.active && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t('mindmap.aiChat.memory.backfillProgress')}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {backfill.current} / {backfill.total}
                    </span>
                  </div>
                  <Progress
                    value={backfill.total > 0 ? (backfill.current / backfill.total) * 100 : 0}
                    className="h-1.5"
                  />
                </div>
              )}

              {/* 索引统计 */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground">
                    {t('mindmap.aiChat.memory.indexedCount')}
                  </div>
                  <div className="font-mono text-sm font-medium">{stats.indexedCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">
                    {t('mindmap.aiChat.memory.storageUsage')}
                  </div>
                  <div className="font-mono text-sm font-medium">
                    {formatBytes(stats.storageBytes)}
                  </div>
                </div>
              </div>

              {/* 召回参数 */}
              <div className="space-y-3 pt-2 border-t">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <Label className="font-medium">{t('mindmap.aiChat.memory.recallKLabel')}</Label>
                    <span className="font-mono text-muted-foreground">{recallK}</span>
                  </div>
                  <Slider
                    value={[recallK]}
                    onValueChange={value => {
                      const v = Array.isArray(value) ? value[0] : value
                      if (v != null) setRecallK(v)
                    }}
                    min={0}
                    max={10}
                    step={1}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t('mindmap.aiChat.memory.recallKHint')}
                  </p>
                </div>
              </div>

              {/* 危险操作 */}
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm(t('mindmap.aiChat.memory.clearConfirm'))) {
                      void clearAll()
                    }
                  }}
                  className={cn('gap-1 text-destructive hover:text-destructive')}
                  disabled={stats.indexedCount === 0}
                >
                  <Trash2 className="size-3" />
                  {t('mindmap.aiChat.memory.clearAll')}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('mindmap.aiChat.memory.clearHint')}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}