/**
 * MCP 服务器卡片组件（数据来自 trpc.mcp.list）
 */

import React from 'react'
import { useTranslation } from '@zoeymind/i18n'
import { Switch } from '@zoeymind/ui'
import { Button } from '@zoeymind/ui'
import { Card, CardContent } from '@zoeymind/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@zoeymind/ui'
import { Badge } from '@zoeymind/ui'
import { MoreVertical, Globe, CheckCircle2, AlertCircle, CircleDashed } from 'lucide-react'
import { useMCPStore } from '../../useMCPStore'
import { ConfirmDialog } from '@zoeymind/ui'

export interface McpServerView {
  id: string
  name: string
  preset: string | null
  url: string
  maskedToken: string | null
  headers: Record<string, string>
  disabled: boolean
}

interface MCPServerCardProps {
  server: McpServerView
  onEdit: (id: string) => void
  onTest: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
  isTesting: boolean
}

export const MCPServerCard: React.FC<MCPServerCardProps> = ({
  server,
  onEdit,
  onTest,
  onToggle,
  onDelete,
  isTesting
}) => {
  const { t } = useTranslation()
  const { getServerStatus } = useMCPStore()
  const status = getServerStatus(server.id)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const isPreset = !!server.preset

  return (
    <Card className={server.disabled ? 'opacity-60' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Switch
              checked={!server.disabled}
              onCheckedChange={checked => onToggle(server.id, checked)}
              className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{server.name}</h3>
              <p className="text-muted-foreground text-xs truncate">
                {isPreset
                  ? t('mindmap.aiChat.settings.card.presetType', { preset: server.preset })
                  : server.url}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton
              render={
                <Button variant="ghost" size="icon" className="flex-shrink-0">
                  <MoreVertical className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(server.id)}>
                {t('common.edit')}
              </DropdownMenuItem>
              {!isPreset && (
                <DropdownMenuItem
                  onClick={() => onTest(server.id)}
                  disabled={isTesting || server.disabled}
                >
                  {t('mindmap.aiChat.settings.form.testConnection')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} variant="destructive">
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3 text-xs mt-4">
          <Badge variant="outline" className="gap-1">
            <Globe className="size-3" />
            {isPreset ? t('mindmap.aiChat.settings.card.presetBadge') : 'HTTP'}
          </Badge>
          <span className="text-muted-foreground">•</span>
          {server.disabled ? (
            <span className="text-muted-foreground">
              {t('mindmap.aiChat.settings.card.statusDisabled')}
            </span>
          ) : isPreset ? (
            <span className="text-muted-foreground">
              {server.maskedToken
                ? t('mindmap.aiChat.settings.card.tokenConfigured')
                : t('mindmap.aiChat.settings.card.tokenMissing')}
            </span>
          ) : status?.connected ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 />
              {t('mindmap.aiChat.settings.card.statusConnected')}
            </Badge>
          ) : status ? (
            <Badge variant="destructive" className="gap-1" title={status.error || ''}>
              <AlertCircle />
              {t('mindmap.aiChat.settings.card.statusDisconnected')}
            </Badge>
          ) : (
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <CircleDashed className="size-3" />
              {t('mindmap.aiChat.settings.card.statusUnchecked')}
            </span>
          )}
        </div>

        {status?.connected && Array.isArray(status.tools) && status.tools.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] text-muted-foreground mb-1">
              {t('mindmap.aiChat.settings.card.toolList')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {status.tools.map(tool => (
                <Badge
                  key={`${server.id}-${tool.name}`}
                  variant="secondary"
                  title={tool.description || tool.name}
                >
                  {tool.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t('mindmap.aiChat.settings.card.confirmDeleteTitle')}
        description={t('mindmap.aiChat.settings.card.confirmDeleteDescription', {
          name: server.name
        })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="destructive"
        onConfirm={() => onDelete(server.id)}
      />
    </Card>
  )
}
