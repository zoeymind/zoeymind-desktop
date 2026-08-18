/**
 * RecoveryDialog —— App boot 时扫 `<appData>/recovery/*.zmind`。
 *
 * 若列出的每条 recovery：
 *   - Reopen：从 recovery 里读回 tree/meta，若 sourcePath 仍存在就把 .zmind
 *     覆盖回原路径并把 recovery 删掉，然后跳编辑器；若 sourcePath 缺失（源被删）
 *     就走"另存为"落新路径 + 重新入库 → 再删 recovery。
 *   - Discard：仅删 recovery 文件，不动源，不入库。
 *
 * 弹框会一次展示所有异常 recovery，用户可逐项处理，处理完自动关闭。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/shared/app-shared'
import {
  listRecoveries,
  readRecoveryBundle,
  clearRecovery,
  writeBundle,
  registerProject,
  findByPath,
  refreshProjectIndex,
  defaultVaultDir,
  createUUID,
  type RecoveryDescriptor
} from '@/shared/native'
import { exists, mkdir } from '@tauri-apps/plugin-fs'
import { save as saveDialog } from '@tauri-apps/plugin-dialog'
import { join } from '@tauri-apps/api/path'

export function RecoveryDialog() {
  const navigate = useNavigate()
  const [items, setItems] = useState<RecoveryDescriptor[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const list = await listRecoveries()
        setItems(list)
      } catch {
        setItems([])
      }
    })()
  }, [])

  const closeIfEmpty = (next: RecoveryDescriptor[]) => {
    if (next.length === 0) setItems(null)
    else setItems(next)
  }

  const handleReopen = async (desc: RecoveryDescriptor) => {
    setBusy(true)
    try {
      const bundle = await readRecoveryBundle(desc.projectId)
      if (!bundle) throw new Error('recovery bundle missing')

      let targetPath = desc.sourcePath
      if (!targetPath || !(await exists(targetPath))) {
        const picked = await saveDialog({
          defaultPath: await join(await defaultVaultDir(), `${desc.name || 'recovered'}.zmind`),
          filters: [{ name: 'ZoeyMind', extensions: ['zmind'] }]
        })
        if (!picked) {
          setBusy(false)
          return
        }
        targetPath = picked
      }

      await writeBundle(targetPath, bundle)

      const existing = await findByPath(targetPath)
      let id = existing?.id ?? desc.projectId
      if (existing) {
        await refreshProjectIndex(existing.id, {
          name: bundle.meta.name,
          nodeCount: bundle.meta.nodeCount
        })
      } else {
        id = createUUID()
        const dir = await defaultVaultDir()
        if (!(await exists(dir))) await mkdir(dir, { recursive: true })
        await registerProject({
          id,
          path: targetPath,
          name: bundle.meta.name,
          nodeCount: bundle.meta.nodeCount
        })
      }

      await clearRecovery(desc.projectId)
      toast.success('已恢复')
      closeIfEmpty((items ?? []).filter(i => i.projectId !== desc.projectId))
      navigate(`/editor/${id}`)
    } catch (error) {
      toast.error(`恢复失败: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = async (desc: RecoveryDescriptor) => {
    setBusy(true)
    try {
      await clearRecovery(desc.projectId)
      closeIfEmpty((items ?? []).filter(i => i.projectId !== desc.projectId))
    } finally {
      setBusy(false)
    }
  }

  if (!items || items.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[540px] max-h-[80vh] overflow-y-auto rounded-lg bg-background shadow-lg">
        <div className="border-b p-4">
          <h2 className="font-semibold">检测到 {items.length} 个未保存的编辑</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            上次异常关闭时留下了容灾快照。可以选择恢复到原位置，或直接丢弃。
          </p>
        </div>
        <ul className="divide-y">
          {items.map(desc => (
            <li key={desc.projectId} className="p-4">
              <div className="font-medium">{desc.name || '(未命名)'}</div>
              <div className="mt-0.5 text-xs text-muted-foreground truncate">
                {desc.sourcePath ?? '源文件已丢失，将走另存为'}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                快照时间：{new Date(desc.savedAt).toLocaleString()}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => void handleReopen(desc)}
                  className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-60"
                >
                  恢复
                </button>
                <button
                  disabled={busy}
                  onClick={() => void handleDiscard(desc)}
                  className="rounded border px-3 py-1 text-xs disabled:opacity-60"
                >
                  丢弃
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
