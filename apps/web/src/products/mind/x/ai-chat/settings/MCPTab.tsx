import { useCallback } from "react"
import { useTranslation } from "@zoeymind/i18n"
import { Button } from "@zoeymind/ui"
import { ExternalLink, Loader2, RefreshCw, Server } from "lucide-react"
import { openMcpConfigFile, type NamedMcpServer } from "@/shared/native"
import { mcpManager } from "../../mcp-client"
import { useMCPStore } from "../../useMCPStore"
import { MCPServerCard } from "./MCPServerCard"

export function MCPTab() {
  const { t } = useTranslation()
  const servers = useMCPStore(state => state.servers)
  const loading = useMCPStore(state => state.initializing)

  const refresh = useCallback(async () => {
    try {
      await mcpManager.refresh()
    } catch {
      // Per-server failures are already published to the runtime status store.
    }
  }, [])

  const testServer = async (server: NamedMcpServer) => {
    const result = await mcpManager.testConnection(server)
    useMCPStore.getState().updateServerStatus(server.id, {
      connected: result.success,
      toolCount: result.toolCount,
      tools: result.tools,
      error: result.error,
      lastChecked: new Date().toISOString(),
    })
  }

  const setServerEnabled = async (server: NamedMcpServer, enabled: boolean) => {
    await mcpManager.setServerEnabled(server.name, enabled)
  }

  return (
    <div className="w-full space-y-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">{t("mindmap.aiChat.settings.tab.heading")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("mindmap.aiChat.settings.tab.configDescription")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => void openMcpConfigFile()}>
            <ExternalLink />
            {t("mindmap.aiChat.settings.tab.openConfig")}
          </Button>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {t("mindmap.aiChat.settings.tab.refresh")}
          </Button>
        </div>
      </div>

      {loading && servers.length === 0 ? null : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12">
          <Server className="mb-3 size-12 text-muted-foreground/50" />
          <div className="mb-1 text-sm font-medium text-muted-foreground">
            {t("mindmap.aiChat.settings.tab.emptyTitle")}
          </div>
          <div className="max-w-[360px] text-center text-xs text-muted-foreground/70">
            {t("mindmap.aiChat.settings.tab.emptyConfigDescription")}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map(server => (
            <MCPServerCard
              key={server.id}
              server={server}
              onTest={testServer}
              onEnabledChange={setServerEnabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}
