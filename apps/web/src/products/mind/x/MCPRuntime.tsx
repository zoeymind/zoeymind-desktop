import { useEffect } from "react"
import { logger } from "@zoeymind/logger"
import { mcpManager } from "./mcp-client"

export function MCPRuntime() {
  useEffect(() => {
    void mcpManager.initialize().catch(error => {
      logger.error("[MCP] 应用级运行时初始化失败", { error })
    })
  }, [])

  return null
}
