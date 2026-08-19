// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * 获取 MCP 工具列表 Hook（数据走 trpc.mcp.list）
 */

import { useEffect, useMemo, useState } from 'react'
import type { McpServerItem } from '../../lib/api-types'
import { trpc } from '../../lib/trpc'
import { useMCPStore } from '../../useMCPStore'
import { mcpManager } from '../../mcp-client'
import { logger } from '@zoeymind/logger'

export interface MCPToolDisplay {
  serverName: string
  name: string
  description: string
  isMCP: true
}

interface UseMCPToolsOptions {
  enabled?: boolean
}


// stable module-level singleton, 避免 destructure 默认值 `= []` 每次生成新数组
// 引起 useEffect 无限 re-run (Maximum update depth exceeded).
const EMPTY_SERVERS: McpServerItem[] = []
export function useMCPTools(options: UseMCPToolsOptions = {}) {
  const { enabled = true } = options
  const query = trpc.mcp.list.useQuery<McpServerItem[]>(undefined, { enabled })
  const servers = useMemo<McpServerItem[]>(() => query.data ?? EMPTY_SERVERS, [query.data])
  const [tools, setTools] = useState<MCPToolDisplay[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadMCPTools = async () => {
      // 预设(native, 如 Figma REST)由后端直接执行, 无需客户端探测
      const enabledServers = servers.filter(s => !s.disabled && !s.preset && !!s.url)

      if (enabledServers.length === 0) {
        if (!cancelled) {
          setTools([])
        }
        return
      }

      setIsLoading(true)

      try {
        const { updateServerStatus } = useMCPStore.getState()
        const allTools: MCPToolDisplay[] = []

        for (const server of enabledServers) {
          const testResult = await mcpManager.testConnection({
            name: server.name,
            url: server.url,
            headers: server.headers
          })

          updateServerStatus(server.id, {
            connected: testResult.success,
            toolCount: testResult.toolCount,
            tools: testResult.tools,
            error: testResult.error,
            lastChecked: new Date().toISOString()
          })

          if (testResult.success) {
            const toolsFromTest = Array.isArray(testResult.tools) ? testResult.tools : []
            toolsFromTest.forEach(tool => {
              allTools.push({
                serverName: server.name,
                name: tool.name,
                description: tool.description || '',
                isMCP: true
              })
            })
          }
        }

        if (!cancelled) {
          setTools(allTools)
        }
      } catch (error) {
        logger.error('[MCP] 工具加载失败', { error })
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadMCPTools()

    return () => {
      cancelled = true
    }
  }, [enabled, servers])

  return { tools, isLoading }
}