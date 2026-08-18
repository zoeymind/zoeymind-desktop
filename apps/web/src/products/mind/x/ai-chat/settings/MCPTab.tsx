/**
 * MCP 服务器配置 Tab（数据走 trpc.mcp.*）
 */

import React, { useState } from 'react'
import type { McpServerItem, McpPresetItem } from '../../lib/api-types'
import { useTranslation } from '@zoeymind/i18n'
import { Plus, Server } from 'lucide-react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@zoeymind/ui'
import { trpc } from '../../lib/trpc'
import { useMCPStore } from '../../useMCPStore'
import { MCPServerList } from './MCPServerList'
import { MCPServerForm } from './MCPServerForm'
import { mcpManager } from '../../mcp-client'
import { useToast } from '@/shared/app-shared'

export const MCPTab: React.FC = () => {
  const { t } = useTranslation()
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const { updateServerStatus, clearServerStatus } = useMCPStore()

  const { data: servers = [], isLoading } = trpc.mcp.list.useQuery<McpServerItem[]>()
  const { data: presets = [] } = trpc.mcp.listPresets.useQuery<McpPresetItem[]>()

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingServerId, setEditingServerId] = useState<string | null>(null)
  const [addPreset, setAddPreset] = useState<string | null>(null)
  const [testingServerId, setTestingServerId] = useState<string | null>(null)

  const toggleMutation = trpc.mcp.toggle.useMutation()
  const deleteMutation = trpc.mcp.delete.useMutation()

  const handleAddServer = () => {
    setEditingServerId(null)
    setAddPreset(null)
    setShowAddDialog(true)
  }

  const handleAddPreset = (presetId: string) => {
    setEditingServerId(null)
    setAddPreset(presetId)
    setShowAddDialog(true)
  }

  const handleEditServer = (id: string) => {
    setEditingServerId(id)
    setAddPreset(null)
    setShowAddDialog(true)
  }

  const handleTestConnection = async (id: string) => {
    const server = servers.find(s => s.id === id)
    if (!server || server.disabled || server.preset) return
    setTestingServerId(id)
    try {
      const result = await mcpManager.testConnection({
        name: server.name,
        url: server.url,
        headers: server.headers
      })
      updateServerStatus(id, {
        connected: result.success,
        toolCount: result.toolCount,
        tools: result.tools,
        error: result.error,
        lastChecked: new Date().toISOString()
      })
      if (result.success) {
        toast({
          title: t('mindmap.aiChat.settings.toast.connectSuccess'),
          description: t('mindmap.aiChat.settings.toast.connectSuccessNamed', {
            name: server.name,
            count: result.toolCount ?? 0
          })
        })
      } else {
        toast({
          title: t('mindmap.aiChat.settings.toast.connectFailed'),
          description: result.error || t('mindmap.aiChat.settings.unknownError'),
          variant: 'destructive'
        })
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('mindmap.aiChat.settings.unknownError')
      updateServerStatus(id, {
        connected: false,
        error: message,
        lastChecked: new Date().toISOString()
      })
      toast({
        title: t('mindmap.aiChat.settings.toast.connectFailed'),
        description: message,
        variant: 'destructive'
      })
    } finally {
      setTestingServerId(null)
    }
  }

  const handleToggleServer = async (id: string, enabled: boolean) => {
    await toggleMutation.mutateAsync({ id, disabled: !enabled })
    if (!enabled) clearServerStatus(id)
    await utils.mcp.list.invalidate()
  }

  const handleDeleteServer = async (id: string) => {
    await deleteMutation.mutateAsync({ id })
    clearServerStatus(id)
    await utils.mcp.list.invalidate()
    toast({ description: t('mindmap.aiChat.settings.toast.serverDeleted') })
  }

  const handleFormClose = () => {
    setShowAddDialog(false)
    setEditingServerId(null)
    setAddPreset(null)
  }

  return (
    <div className="space-y-4 py-4 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{t('mindmap.aiChat.settings.tab.heading')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('mindmap.aiChat.settings.tab.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {presets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                nativeButton
                render={
                  <Button size="sm" variant="outline">
                    <Plus className="size-4 mr-1" />
                    {t('mindmap.aiChat.settings.tab.addPreset')}
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {presets.map(p => (
                  <DropdownMenuItem key={p.id} onClick={() => handleAddPreset(p.id)}>
                    {p.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button size="sm" onClick={handleAddServer}>
            <Plus className="size-4 mr-1" />
            {t('mindmap.aiChat.settings.tab.addServer')}
          </Button>
        </div>
      </div>

      {isLoading ? null : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-6 border border-dashed rounded-lg">
          <Server className="size-12 text-muted-foreground/50 mb-3" />
          <div className="text-sm font-medium text-muted-foreground mb-1">
            {t('mindmap.aiChat.settings.tab.emptyTitle')}
          </div>
          <div className="text-xs text-muted-foreground/70 text-center max-w-[300px]">
            {t('mindmap.aiChat.settings.tab.emptyDescription')}
          </div>
          <Button size="sm" variant="outline" className="mt-4" onClick={handleAddServer}>
            <Plus className="size-4 mr-1" />
            {t('mindmap.aiChat.settings.tab.addFirstServer')}
          </Button>
        </div>
      ) : (
        <MCPServerList
          servers={servers}
          onEdit={handleEditServer}
          onTest={handleTestConnection}
          onToggle={handleToggleServer}
          onDelete={handleDeleteServer}
          testingServerId={testingServerId}
        />
      )}

      <MCPServerForm
        open={showAddDialog}
        onClose={handleFormClose}
        serverId={editingServerId}
        preset={addPreset}
      />
    </div>
  )
}
