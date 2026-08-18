import { Avatar, AvatarFallback, AvatarImage } from '../avatar'
import { Button } from '../button'
import { Card, CardContent } from '../card'
import { Textarea } from '../textarea'
import { KeyRound, ArrowLeft, Send, CheckCircle2 } from 'lucide-react'

export interface RequestAccessPageCard {
  /** 项目 (mindmap) 名字. */
  title: string
  /** 所属 workspace 名 — 供 requester 判断是否找错入口. */
  workspaceName?: string | null
  creator: {
    name?: string | null
    email?: string | null
    avatar?: string | null
  }
}

interface RequestAccessPageProps {
  /** 展示卡片: 项目名 / 创建者头像 & 名字 / workspace 归属. */
  card: RequestAccessPageCard
  /** 留言内容 (受控). */
  message: string
  /** 留言变更回调. */
  onMessageChange: (value: string) => void
  /** 触发申请 (由消费方注入 tRPC mutation). */
  onRequest: () => void
  /** 返回上一页 / 首页. */
  onBack: () => void
  /** 申请提交中 (mutation.isPending). */
  requesting?: boolean
  /** 已成功提交, 等待创建者审批. */
  requested?: boolean
  // ── i18n 文案 ───────────────────────────
  title?: string
  description?: string
  creatorLabel?: string
  workspaceLabel?: string
  messageLabel?: string
  messagePlaceholder?: string
  backButtonText?: string
  requestButtonText?: string
  requestedHint?: string
  anonymousName?: string
}

function initialOf(name?: string | null, email?: string | null): string {
  const src = name?.trim() || email?.trim() || ''
  return src.charAt(0).toUpperCase() || '?'
}

/**
 * 无权限访问页 — 卡片式.
 *
 * 卡片显示: 项目名 / (可选) workspace 归属 / 创建者头像+名字.
 * 交互: 留言 (可选) + [返回首页] / [申请].
 * 已申请后 requested=true 显示等待提示且按钮禁用.
 */
export function RequestAccessPage({
  card,
  message,
  onMessageChange,
  onRequest,
  onBack,
  requesting = false,
  requested = false,
  title = '需要访问权限',
  description = '你还没有这份思维导图的访问权限, 可以向创建者申请.',
  creatorLabel = '创建者',
  workspaceLabel = '所属项目空间',
  messageLabel = '留言 (可选)',
  messagePlaceholder = '说一下你需要访问的原因, 提高通过率',
  backButtonText = '返回首页',
  requestButtonText = '申请访问',
  requestedHint = '已发送申请, 等待创建者审批.',
  anonymousName = '某位用户'
}: RequestAccessPageProps) {
  const creatorName = card.creator.name?.trim() || card.creator.email?.trim() || anonymousName

  return (
    <div className="min-h-svh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center">
              <KeyRound className="size-6 text-muted-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            {/* 项目名 */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {/* 不加多余 label 避免视觉噪声, 项目名本身足够醒目 */}
              </div>
              <h2 className="text-base font-semibold truncate" title={card.title}>
                {card.title}
              </h2>
              {card.workspaceName ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {workspaceLabel}: <span className="text-foreground">{card.workspaceName}</span>
                </p>
              ) : null}
            </div>

            {/* 创建者 */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">{creatorLabel}</p>
              <div className="flex items-center gap-2.5">
                <Avatar className="size-9 border">
                  {card.creator.avatar ? (
                    <AvatarImage src={card.creator.avatar} alt={creatorName} />
                  ) : null}
                  <AvatarFallback className="text-sm">
                    {initialOf(card.creator.name, card.creator.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{creatorName}</p>
                  {card.creator.email && card.creator.name ? (
                    <p className="text-xs text-muted-foreground truncate">{card.creator.email}</p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* 留言 */}
            <div>
              <label
                htmlFor="access-request-message"
                className="text-xs text-muted-foreground block mb-1.5"
              >
                {messageLabel}
              </label>
              <Textarea
                id="access-request-message"
                value={message}
                onChange={e => onMessageChange(e.target.value)}
                placeholder={messagePlaceholder}
                rows={3}
                maxLength={500}
                disabled={requesting || requested}
              />
            </div>

            {requested ? (
              <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{requestedHint}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="size-4" />
            {backButtonText}
          </Button>
          <Button onClick={onRequest} disabled={requesting || requested} className="gap-2">
            <Send className="size-4" />
            {requestButtonText}
          </Button>
        </div>
      </div>
    </div>
  )
}
