/**
 * 桌面端自检 —— 一键跑完两条 verify：
 *   ① 新建 → 保存 → 重开 .zmind
 *   ② 删磁盘文件 → 列表失效
 *
 * 只在 dev 构建里挂到列表页角落；生产构建不显示。
 */
import { useCallback, useState } from 'react'
import { CheckCircle2, XCircle, PlayCircle, Loader2 } from 'lucide-react'
import { toast } from '@/shared/app-shared'
import {
  createUUID,
  defaultVaultDir,
  writeBundle,
  readBundle,
  registerProject,
  getProject,
  unregisterProject,
  type ZMindBundle
} from '@/shared/native'
import { exists, mkdir, remove } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'

type Step = { name: string; status: 'pending' | 'ok' | 'fail'; detail?: string }

const INITIAL: Step[] = [
  { name: '新建 .zmind 并落盘', status: 'pending' },
  { name: '入 SqlProjectRepo 索引', status: 'pending' },
  { name: '重新读回 tree 一致', status: 'pending' },
  { name: '删磁盘文件后 exists=false', status: 'pending' },
  { name: '清理测试记录', status: 'pending' }
]

interface SelfCheckProps {
  onFinish?: () => void
}

export function SelfCheck({ onFinish }: SelfCheckProps) {
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<Step[]>(INITIAL)

  const update = useCallback((i: number, patch: Partial<Step>) => {
    setSteps(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }, [])

  const run = useCallback(async () => {
    if (running) return
    setRunning(true)
    setSteps(INITIAL)

    const id = createUUID()
    const probeName = `__selfcheck__${Date.now()}`

    try {
      // 1. 落盘
      const dir = await defaultVaultDir()
      if (!(await exists(dir))) await mkdir(dir, { recursive: true })
      const path = await join(dir, `${probeName}.zmind`)
      const bundle: ZMindBundle = {
        tree: { data: { text: 'self-check root', uid: id, expand: true }, children: [] },
        meta: {
          name: probeName,
          tags: ['selfcheck'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          nodeCount: 1
        }
      }
      await writeBundle(path, bundle)
      update(0, { status: 'ok', detail: path })

      // 2. 入索引
      await registerProject({ id, path, name: probeName, nodeCount: 1 })
      const row = await getProject(id)
      if (!row) throw new Error('registerProject 后 getProject 返回 null')
      update(1, { status: 'ok', detail: `id=${id}` })

      // 3. 读回一致
      const roundtrip = await readBundle(path)
      if (roundtrip.meta.name !== probeName || roundtrip.tree.data.text !== 'self-check root') {
        throw new Error('roundtrip 内容不一致')
      }
      update(2, { status: 'ok', detail: 'tree + meta match' })

      // 4. 删磁盘文件后 exists=false
      await remove(path)
      const afterDelete = await getProject(id)
      if (!afterDelete) throw new Error('getProject 返回 null 而非索引记录')
      if (afterDelete.exists) throw new Error('删除后 exists 仍为 true')
      update(3, { status: 'ok', detail: 'exists=false' })

      // 5. 清理索引
      await unregisterProject(id)
      const purged = await getProject(id)
      if (purged) throw new Error('unregister 后索引仍有记录')
      update(4, { status: 'ok', detail: 'index purged' })

      toast.success('自检通过')
      onFinish?.()
    } catch (error) {
      const msg = (error as Error).message
      setSteps(prev => {
        const firstPending = prev.findIndex(s => s.status === 'pending')
        if (firstPending < 0) return prev
        return prev.map((s, idx) => (idx === firstPending ? { ...s, status: 'fail', detail: msg } : s))
      })
      toast.error(`自检失败：${msg}`)
      // 清理残留
      try {
        await unregisterProject(id)
      } catch {
        /* noop */
      }
    } finally {
      setRunning(false)
    }
  }, [running, update, onFinish])

  return (
    <div className="rounded border bg-card p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">桌面端自检</span>
        <button
          onClick={() => void run()}
          disabled={running}
          className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50"
        >
          {running ? <Loader2 className="size-3 animate-spin" /> : <PlayCircle className="size-3" />}
          {running ? '运行中' : '一键跑'}
        </button>
      </div>
      <ul className="space-y-1">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className="mt-0.5">
              {s.status === 'ok' && <CheckCircle2 className="size-3 text-emerald-500" />}
              {s.status === 'fail' && <XCircle className="size-3 text-destructive" />}
              {s.status === 'pending' && <span className="inline-block size-3 rounded-full border" />}
            </span>
            <span className="flex-1">
              {s.name}
              {s.detail && <span className="ml-1 opacity-60">— {s.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
