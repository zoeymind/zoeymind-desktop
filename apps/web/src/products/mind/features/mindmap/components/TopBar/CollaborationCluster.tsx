import { Button } from '@zoeymind/ui'
import { useTranslation } from '@zoeymind/i18n'
import { Avatar, AvatarFallback, AvatarImage } from '@zoeymind/ui'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@zoeymind/ui'
import { cn } from '@/shared/app-shared'
import { Users } from 'lucide-react'
import type { CollaborationState } from '@/products/mind/features/mindmap/components/hooks/useCollaborationManager'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'

interface CollaborationClusterProps {
  collaborationState?: CollaborationState | null
}

const statusStyles: Record<
  CollaborationState['status'],
  { indicator: string; iconClass: string; pulse?: boolean }
> = {
  idle: {
    indicator: 'bg-muted-foreground/60',
    iconClass: 'text-muted-foreground'
  },
  connecting: {
    indicator: 'bg-warning',
    iconClass: 'text-muted-foreground',
    pulse: true
  },
  connected: {
    indicator: 'bg-success',
    iconClass: 'text-success dark:text-success'
  },
  disconnected: {
    indicator: 'bg-destructive',
    iconClass: 'text-destructive dark:text-destructive'
  }
}

const getPeerInitial = (
  name: string | undefined,
  fallback: string | undefined,
  defaultFallback: string
) => {
  const base = name || fallback || defaultFallback
  return base.slice(0, 1).toUpperCase()
}

export function CollaborationCluster({ collaborationState }: CollaborationClusterProps) {
  const { t } = useTranslation()
  // 🚀 从 store 获取项目信息，确保状态一致性
  const { workspaceId, cloudMode } = useProjectContext()
  if (!cloudMode || !workspaceId || !collaborationState?.cooperate) {
    return null
  }

  const { status, synced, peers, provider } = collaborationState
  const statusLabel: Record<CollaborationState['status'], string> = {
    idle: t('mindmap.topbar.collab.statusIdle'),
    connecting: t('mindmap.topbar.collab.statusConnecting'),
    connected: t('mindmap.topbar.collab.statusConnected'),
    disconnected: t('mindmap.topbar.collab.statusDisconnected')
  }
  const meta = statusStyles[status]

  // 3个插槽：最多显示2个头像 + 1个剩余数量
  const MAX_SLOTS = 3
  const displayPeers = peers.slice(0, MAX_SLOTS - 1)
  const remainingCount = Math.max(0, peers.length - displayPeers.length)

  const handleReconnect = () => {
    if (provider && status === 'disconnected') {
      provider.connect()
    }
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={150}
        render={
          <div className="flex items-center cursor-pointer select-none">
            {/* 外框group，自动宽度，状态点在右上角 */}
            <div className="relative inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted/50 border border-border shadow-sm">
              {/* 插槽区域 */}
              <div className="flex -space-x-2">
                {displayPeers.map((peer, index) => (
                  <Avatar
                    key={peer.instanceKey}
                    className="size-6 border-2 shadow-sm bg-muted"
                    style={{
                      borderColor: peer.color || 'hsla(var(--foreground) / 0.4)',
                      zIndex: index + 1
                    }}
                  >
                    {peer.avatar ? (
                      <AvatarImage src={peer.avatar} alt={peer.name} />
                    ) : (
                      <AvatarFallback
                        className="text-[9px] font-medium"
                        style={{
                          backgroundColor: peer.color || 'hsl(var(--cursor-default))',
                          color: 'hsl(var(--cursor-text))'
                        }}
                      >
                        {getPeerInitial(peer.name, peer.id, t('mindmap.topbar.collab.guest'))}
                      </AvatarFallback>
                    )}
                  </Avatar>
                ))}

                {/* 剩余人数圆圈 - z-index最高，与TopBar风格一致 */}
                {remainingCount > 0 && (
                  <div
                    className="size-6 rounded-full bg-muted-foreground/30 backdrop-blur-md border-2 border-border shadow-sm flex items-center justify-center text-[10px] text-foreground font-medium"
                    style={{ zIndex: displayPeers.length + 1 }}
                  >
                    +{remainingCount}
                  </div>
                )}

                {/* 如果没有协作者，显示占位图标 */}
                {peers.length === 0 && (
                  <div className="size-6 rounded-full bg-muted border-2 border-border shadow-sm flex items-center justify-center">
                    <Users className="size-3 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* 状态点在右上角 */}
              <span
                className={cn(
                  'absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background',
                  meta.indicator,
                  meta.pulse && 'animate-pulse'
                )}
              />
            </div>
          </div>
        }
      />
      <HoverCardContent className="w-72 border border-border bg-popover text-popover-foreground shadow-xl">
        {/* 头部：成员数 + 连接/同步状态 */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4 text-muted-foreground" />
            {t('mindmap.topbar.collab.members', { value: peers.length })}
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={cn('size-1.5 rounded-full', meta.indicator, meta.pulse && 'animate-pulse')}
            />
            {statusLabel[status]}
            {status === 'connected' && (
              <>
                <span className="text-muted-foreground/40">·</span>
                {synced ? t('mindmap.topbar.collab.synced') : t('mindmap.topbar.collab.syncing')}
              </>
            )}
          </span>
        </div>

        {peers.length > 0 ? (
          <ul className="-mx-1 max-h-48 space-y-0.5 overflow-auto">
            {peers.map(peer => (
              <li
                key={peer.instanceKey}
                className="flex items-center gap-3 rounded-md px-1 py-1.5 hover:bg-accent/40"
              >
                <Avatar
                  className="size-7 border-2"
                  style={{ borderColor: peer.color || 'hsl(var(--border))' }}
                >
                  {peer.avatar ? (
                    <AvatarImage src={peer.avatar} alt={peer.name} />
                  ) : (
                    <AvatarFallback
                      className="text-xs font-medium"
                      style={{
                        backgroundColor: peer.color || 'hsl(var(--cursor-default))',
                        color: 'hsl(var(--cursor-text))'
                      }}
                    >
                      {getPeerInitial(peer.name, peer.id, t('mindmap.topbar.collab.guest'))}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {peer.name || t('mindmap.topbar.collab.guestUser')}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-success">
                  <span className="size-1.5 rounded-full bg-success" />
                  {t('mindmap.topbar.collab.online')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-5 text-center">
            <div className="flex size-9 items-center justify-center rounded-full bg-muted">
              <Users className="size-4 text-muted-foreground" />
            </div>
            <div className="text-sm font-medium">{t('mindmap.topbar.collab.noOthers')}</div>
            <p className="text-xs text-muted-foreground">
              {t('mindmap.topbar.collab.noOthersHint')}
            </p>
          </div>
        )}

        {status === 'disconnected' && (
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={handleReconnect}>
            {t('mindmap.topbar.collab.reconnect')}
          </Button>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
