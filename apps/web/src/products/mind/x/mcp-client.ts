/**
 * MCP 客户端管理服务
 *
 * 通过后端代理访问 MCP 服务器
 */

import { trpcClient } from './lib/trpc'
import type { McpTestResult } from './lib/api-types'
import { logger } from '@zoeymind/logger'

export interface MCPServerConfig {
  url: string
  headers?: Record<string, string>
  disabled?: boolean
}

export interface MCPToolInfo {
  name: string
  description?: string
  inputSchema?: unknown
}

export type MCPToolDefinition = Record<string, MCPToolInfo>

export interface MCPTestResult {
  success: boolean
  toolCount?: number
  tools?: Array<{ name: string; description?: string }>
  error?: string
}

export class MCPClientManager {
  /**
   * 测试服务器连接
   */
  async testConnection(config: { name: string } & MCPServerConfig): Promise<MCPTestResult> {
    if (!config.url) {
      return {
        success: false,
        error: `MCP 服务器 "${config.name}" 缺少 URL`
      }
    }

    try {
      const result = await trpcClient.mcp.testConnection.mutate<McpTestResult>({
        url: config.url,
        headers: config.headers
      })

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test connection'
      }
    }
  }

  /**
   * 获取服务器的工具列表
   */
  async getServerTools(config: { name: string } & MCPServerConfig): Promise<MCPToolDefinition> {
    if (!config.url) {
      logger.warn(`MCP server "${config.name}" has no URL, skip loading tools`)
      return {}
    }

    try {
      const result = await trpcClient.mcp.testConnection.mutate<McpTestResult>({
        url: config.url!,
        headers: config.headers
      })

      // 解析响应
      let tools: MCPToolDefinition = {}
      const toolsList: Array<{ name?: string; description?: string }> =
        result.success && 'tools' in result && Array.isArray(result.tools) ? result.tools : []

      if (toolsList.length > 0) {
        tools = toolsList.reduce(
          (acc: MCPToolDefinition, tool: { name?: string; description?: string }) => {
            if (tool?.name) {
              acc[tool.name] = {
                name: tool.name,
                description: tool.description || ''
              }
            }
            return acc
          },
          {} as MCPToolDefinition
        )
      }

      return tools
    } catch (error) {
      logger.error(`Failed to get tools from server "${config.name}":`, { error })
      throw error
    }
  }

  /**
   * 获取工具的详细信息
   */
  async getToolDetails(config: { name: string } & MCPServerConfig) {
    const tools = await this.getServerTools(config)

    return Object.entries(tools).map(([name, tool]) => ({
      name,
      description: tool.description || '',
      inputSchema: tool.inputSchema
    }))
  }

  /**
   * 清除服务器缓存
   */
  clearServerCache(config: { name: string } & MCPServerConfig) {
    void config
  }

  /**
   * 关闭所有连接
   */
  async closeAll() {
    return
  }

  /**
   * 批量获取多个服务器的工具
   */
  async getMultipleServersTools(configs: Array<{ name: string } & MCPServerConfig>) {
    const results = await Promise.allSettled(
      configs.map(async config => {
        try {
          if (!config.url) {
            return {
              serverName: config.name,
              error: 'Missing URL',
              success: false
            }
          }

          const tools = await this.getServerTools(config)
          return {
            serverName: config.name,
            tools,
            success: true
          }
        } catch (error: unknown) {
          return {
            serverName: config.name,
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false
          }
        }
      })
    )

    return results
  }
}

// 单例实例
export const mcpManager = new MCPClientManager()
