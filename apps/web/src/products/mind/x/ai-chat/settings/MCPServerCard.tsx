import { useState } from "react"
import { useTranslation } from "@zoeymind/i18n"
import { Badge, Button, Card, CardContent, Switch } from "@zoeymind/ui"
import { CheckCircle2, CircleDashed, Loader2, RefreshCw, Server } from "lucide-react"
import type { NamedMcpServer } from "@/shared/native"
import { useMCPStore } from "../../useMCPStore"

interface MCPServerCardProps {
  server: NamedMcpServer
  onTest: (server: NamedMcpServer) => Promise<void>
  onEnabledChange: (server: NamedMcpServer, enabled: boolean) => Promise<void>
}

export function MCPServerCard({ server, onTest, onEnabledChange }: MCPServerCardProps) {
  const { t } = useTranslation()
  const status = useMCPStore(state => state.serverStatus[server.id])
  const [testing, setTesting] = useState(false)
  const [toggling, setToggling] = useState(false)

  let endpoint = ""
  if (server.kind === "stdio" && "command" in server && typeof server.command === "string") {
    const args = "args" in server && Array.isArray(server.args) ? server.args : []
    endpoint = [server.command, ...args].join(" ")
  } else if ("url" in server && typeof server.url === "string") {
    endpoint = server.url
  }
  const test = async () => {
    setTesting(true)
    try {
      await onTest(server)
    } finally {
      setTesting(false)
    }
  }

  const toggle = async (enabled: boolean) => {
    setToggling(true)
    try {
      await onEnabledChange(server, enabled)
    } finally {
      setToggling(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Server className="size-4 text-muted-foreground" />
              <h3 className="truncate text-sm font-semibold">{server.name}</h3>
              <Badge variant="outline">{server.kind.toUpperCase()}</Badge>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{endpoint}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={testing || toggling || server.disabled === true}
              onClick={() => void test()}
            >
              {testing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {t("mindmap.aiChat.settings.form.testConnection")}
            </Button>
            <Switch
              aria-label={t("mindmap.aiChat.settings.card.toggleServer", { name: server.name })}
              checked={server.disabled !== true}
              disabled={toggling}
              onCheckedChange={enabled => void toggle(enabled)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {status?.connected ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 />
              {t("mindmap.aiChat.settings.card.statusConnected")}
            </Badge>
          ) : status ? (
            <Badge variant="destructive" title={status.error}>
              {t("mindmap.aiChat.settings.card.statusDisconnected")}
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <CircleDashed className="size-3" />
              {t("mindmap.aiChat.settings.card.statusUnchecked")}
            </span>
          )}
        </div>

        {status?.tools?.length ? (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {t("mindmap.aiChat.settings.card.toolList")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {status.tools.map(tool => (
                <Badge key={tool.name} variant="secondary" title={tool.description ?? tool.name}>
                  {tool.name}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
