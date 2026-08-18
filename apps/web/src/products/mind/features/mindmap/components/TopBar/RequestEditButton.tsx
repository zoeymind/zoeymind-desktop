/**
 * 申请编辑按钮.
 *
 * 出现条件: 云端 + 只读 (canEdit=false) + hasPermission (成员/已知只读).
 * 状态:
 *   - 无 pending 且未审批 → 点击后打开对话框, 输入 message → create.
 *   - 已 PENDING → 显示"审核中", 可撤回.
 *   - APPROVED (会同步 permission, 组件不显示, 上层 canEdit 已 true).
 *   - REJECTED → 可重新申请.
 */
import React, { FC, useState, useMemo, useRef, useCallback } from 'react'
import { PencilLine, Loader2 } from 'lucide-react'
import { useTranslation } from '@zoeymind/i18n'
import { trpc } from '@/shared/app-shared'
import { toast } from '@zoeymind/ui'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea
} from '@zoeymind/ui'

interface RequestEditButtonProps {
  mindmapId: string
}

export const RequestEditButton: FC<RequestEditButtonProps> = ({ mindmapId }) => {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [message, setMessage] = useState('')

  // 图未发布到任何 project (workspaceId=null): 无 org 归属, 后端 editRequest.create 会拒;
  // 前端直接不渲染按钮, 让 UI 一致.
  const meta = trpc.mindmap.getById.useQuery({ mindmapId }, { staleTime: 60_000 })
  const hasProject = Boolean(
    (meta.data?.mindmap as { workspaceId?: string | null } | undefined)?.workspaceId
  )

  const listMy = trpc.mindmap.editRequest.listMy.useQuery(undefined, {
    refetchInterval: 15_000,
    staleTime: 10_000
  })
  const utils = trpc.useUtils()

  // 提交锁: 成功回调前不可再点
  const submitLockRef = useRef(false)

  const createReq = trpc.mindmap.editRequest.create.useMutation({
    onMutate: () => {
      submitLockRef.current = true
    },
    onSuccess: () => {
      submitLockRef.current = false
      toast({ title: t('mindmap.editRequest.submitted') })
      setDialogOpen(false)
      setMessage('')
      void listMy.refetch()
      void utils.mindmap.list.invalidate()
    },
    onError: err => {
      submitLockRef.current = false
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' })
    }
  })

  const cancelReq = trpc.mindmap.editRequest.cancel.useMutation({
    onSuccess: () => {
      toast({ title: t('mindmap.editRequest.canceled') })
      void utils.mindmap.editRequest.listMy.invalidate()
    }
  })

  // 找该 mindmap 最新一条记录: 先找 PENDING, 若无再检查 REJECTED
  const myLatest = useMemo(() => {
    if (!listMy.data) return null
    const matches = listMy.data.filter(r => r.mindmapId === mindmapId)
    if (matches.length === 0) return null
    // 先看是否有 PENDING
    const pending = matches.find(r => r.status === 'PENDING')
    if (pending) return pending
    // 取最新一条 (按 created_at 倒序取第一条)
    return matches.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]
  }, [listMy.data, mindmapId])

  const myPending = myLatest?.status === 'PENDING' ? myLatest : null
  const myRejected = myLatest?.status === 'REJECTED' ? myLatest : null

  const handleSubmit = useCallback(() => {
    if (submitLockRef.current) return
    createReq.mutate({ mindmapId, message: message.trim() || undefined })
  }, [createReq, mindmapId, message])

  // 未发布图: 隐藏申请编辑入口 (需要 owner 先发布到项目后才能申请)
  if (!hasProject) return null
  // PENDING → 显示审核中
  if (myPending) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={cancelReq.isPending}
        onClick={() => cancelReq.mutate({ requestId: myPending.id })}
      >
        {cancelReq.isPending ? (
          <Loader2 className="mr-1 size-3 animate-spin" />
        ) : (
          <PencilLine className="mr-1 size-3" />
        )}
        {t('mindmap.editRequest.pendingLabel')}
      </Button>
    )
  }

  return (
    <>
      {myRejected && (
        <p className="text-xs text-muted-foreground mb-1 text-center">
          {t('mindmap.editRequest.rejectedHint')}
        </p>
      )}
      <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        <PencilLine className="mr-1 size-3" />
        {t('mindmap.editRequest.requestLabel')}
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mindmap.editRequest.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('mindmap.editRequest.dialogDesc')}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={t('mindmap.editRequest.messagePlaceholder')}
            rows={3}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={createReq.isPending || submitLockRef.current} onClick={handleSubmit}>
              {createReq.isPending && <Loader2 className="mr-1 size-3 animate-spin" />}
              {t('mindmap.editRequest.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
