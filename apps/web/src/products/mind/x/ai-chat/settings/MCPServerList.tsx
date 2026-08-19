// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * MCP 服务器列表组件
 */

import React from 'react'
import { MCPServerCard, type McpServerView } from './MCPServerCard'

interface MCPServerListProps {
  servers: McpServerView[]
  onEdit: (id: string) => void
  onTest: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
  testingServerId: string | null
}

export const MCPServerList: React.FC<MCPServerListProps> = ({
  servers,
  onEdit,
  onTest,
  onToggle,
  onDelete,
  testingServerId
}) => {
  const sortedServers = [...servers].sort((a, b) => {
    if (a.disabled && !b.disabled) return 1
    if (!a.disabled && b.disabled) return -1
    return 0
  })

  return (
    <div className="space-y-3">
      {sortedServers.map(server => (
        <MCPServerCard
          key={server.id}
          server={server}
          onEdit={onEdit}
          onTest={onTest}
          onToggle={onToggle}
          onDelete={onDelete}
          isTesting={testingServerId === server.id}
        />
      ))}
    </div>
  )
}
