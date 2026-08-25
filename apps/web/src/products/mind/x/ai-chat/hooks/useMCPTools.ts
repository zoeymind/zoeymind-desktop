import { useCallback } from "react"
import { logger } from "@zoeymind/logger"
import { mcpManager } from "../../mcp-client"
import { useMCPStore } from "../../useMCPStore"

export function useMCPTools() {
  const servers = useMCPStore(state => state.servers)
  const isLoading = useMCPStore(state => state.initializing)

  const refresh = useCallback(async () => {
    try {
      await mcpManager.refresh()
    } catch (error) {
      logger.error("[MCP] 刷新配置失败", { error })
    }
  }, [])

  return { servers, isLoading, refresh }
}
