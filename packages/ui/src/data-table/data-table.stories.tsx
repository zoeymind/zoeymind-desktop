import type { Meta, StoryObj } from '@storybook/react'
import { useMemo } from 'react'
import { ArchiveIcon, CircleCheckIcon, CircleIcon, ClockIcon, Trash2Icon } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import { Badge } from '../badge'
import { Button } from '../button'
import { Checkbox } from '../checkbox'
import {
  DataTable,
  DataTableColumnHeader,
  DataTableSkeleton,
  DataTableToolbar,
  useDataTable
} from '.'

// ────────────── 数据 ──────────────

type Task = {
  id: string
  title: string
  owner: string
  status: 'todo' | 'doing' | 'done'
  priority: 1 | 2 | 3
  updatedAt: string
}

const OWNERS = ['张三丰', '李四光', '王五岳', '赵六祖', '钱七海']
const STATUSES: Task['status'][] = ['todo', 'doing', 'done']
const LONG_TITLES = [
  '重构思维导图协作模块，把 Yjs Provider 从内嵌切成 hooks-based 结构，覆盖 20 个场景',
  '优化画布渲染性能：canvas node 数量超过 500 时 60fps 掉到 22fps，需要虚拟化 + 层级分块渲染',
  '接入 SSO：飞书 / 钉钉 / 企业微信 / 腾讯会议四个来源的用户身份统一到 Better Auth session',
  '重新设计权限模型，把 team / project / mindmap 三级 RBAC 简化为 workspace-scoped ACL',
  '整合 Playwright + Vitest 跑 E2E，覆盖新用户注册到发布第一版导图的完整旅程',
  '实现导图导出 XMind / MindManager / Freemind 三种格式，注意 XML 结构差异',
  '迁移旧版评论到 threaded reply，把 flat comments 按父引用重建成树，保留时序',
  '接入 OpenAI Realtime 语音，让 AI 边听边生成节点，需要处理 partial transcript',
  '打通支付：Stripe 订阅 + 支付宝 h5 直连 + 微信 native 三通道回调统一到 checkout session',
  '前端首屏 3s → 800ms：拆 route-level code split，移除 landing 页面 100kb 未用组件'
]

function makeTasks(n = 60): Task[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `TASK-${String(i + 1).padStart(3, '0')}`,
    title: LONG_TITLES[i % LONG_TITLES.length],
    owner: OWNERS[i % OWNERS.length],
    status: STATUSES[i % 3],
    priority: ((i % 3) + 1) as 1 | 2 | 3,
    updatedAt: new Date(Date.now() - i * 3600_000).toISOString().slice(0, 10)
  }))
}

const STATUS_LABEL: Record<Task['status'], string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成'
}
const STATUS_VARIANT: Record<Task['status'], 'secondary' | 'warning' | 'success'> = {
  todo: 'secondary',
  doing: 'warning',
  done: 'success'
}
const STATUS_ICON: Record<Task['status'], typeof CircleIcon> = {
  todo: CircleIcon,
  doing: ClockIcon,
  done: CircleCheckIcon
}

// ────────────── Columns ──────────────

const columns: ColumnDef<Task>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false
        }
        onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
        aria-label="全选"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={value => row.toggleSelected(!!value)}
        aria-label={`选择 ${row.original.id}`}
      />
    ),
    size: 40,
    enableSorting: false,
    enableHiding: false
  },
  {
    accessorKey: 'id',
    header: ({ column }) => <DataTableColumnHeader column={column} label="ID" />,
    cell: ({ row }) => <span className="font-medium">{row.original.id}</span>,
    size: 100,
    meta: { label: 'ID', variant: 'text', placeholder: '搜索 ID...' },
    enableColumnFilter: true
  },
  {
    accessorKey: 'title',
    header: ({ column }) => <DataTableColumnHeader column={column} label="标题" />,
    cell: ({ row }) => (
      <span className="block truncate" title={row.original.title}>
        {row.original.title}
      </span>
    ),
    meta: { label: '标题', variant: 'text', placeholder: '搜索标题...' },
    enableColumnFilter: true
  },
  {
    accessorKey: 'owner',
    header: ({ column }) => <DataTableColumnHeader column={column} label="负责人" />,
    cell: ({ row }) => row.original.owner,
    size: 120,
    meta: {
      label: '负责人',
      variant: 'multiSelect',
      options: OWNERS.map(o => ({ label: o, value: o }))
    },
    enableColumnFilter: true
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} label="状态" />,
    cell: ({ row }) => {
      const s = row.original.status
      return <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABEL[s]}</Badge>
    },
    size: 100,
    meta: {
      label: '状态',
      variant: 'multiSelect',
      options: STATUSES.map(s => ({
        label: STATUS_LABEL[s],
        value: s,
        icon: STATUS_ICON[s]
      }))
    },
    enableColumnFilter: true
  },
  {
    accessorKey: 'updatedAt',
    header: ({ column }) => <DataTableColumnHeader column={column} label="更新时间" />,
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.updatedAt}</span>,
    size: 120,
    meta: { label: '更新时间', variant: 'date' },
    enableColumnFilter: true
  }
]

// ────────────── Stories ──────────────

const meta: Meta = {
  title: 'Data/DataTable',
  tags: ['autodocs'],
  parameters: { layout: 'padded' }
}

export default meta

/**
 * 完整表格：分页 + 排序 + 过滤 + 多选 + 列显隐 + toolbar 批量操作。
 * URL 状态由 nuqs 同步（`?page=`/`?perPage=`/`?sort=`/过滤器等）。
 */
export const FullFeatured: StoryObj = {
  render: () => <FullDemo />
}

function FullDemo() {
  const data = useMemo(() => makeTasks(60), [])
  const { table } = useDataTable({
    data,
    columns,
    pageCount: Math.ceil(data.length / 10),
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    getRowId: row => row.id
  })
  const selected = table.getFilteredSelectedRowModel().rows

  return (
    <DataTable
      table={table}
      actionBar={
        <div className="flex items-center gap-2 rounded-md border bg-background p-1.5 shadow-sm">
          <span className="text-sm text-muted-foreground">已选 {selected.length}</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline">
              <ArchiveIcon data-icon="inline-start" />
              归档
            </Button>
            <Button size="sm" variant="destructive">
              <Trash2Icon data-icon="inline-start" />
              删除
            </Button>
          </div>
        </div>
      }
    >
      <DataTableToolbar table={table} />
    </DataTable>
  )
}

/** 极简：无 toolbar，仅表体 + 分页。 */
export const Minimal: StoryObj = {
  render: () => <MinimalDemo />
}

function MinimalDemo() {
  const data = useMemo(() => makeTasks(20), [])
  const { table } = useDataTable({
    data,
    columns: columns.slice(1),
    pageCount: Math.ceil(data.length / 5),
    initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
    getRowId: row => row.id
  })
  return <DataTable table={table} />
}

/** 加载骨架：真实 caller 里 `if (isLoading) return <DataTableSkeleton />`。 */
export const LoadingSkeleton: StoryObj = {
  render: () => (
    <DataTableSkeleton
      columnCount={5}
      rowCount={8}
      filterCount={2}
      cellWidths={['3rem', '6rem', '20rem', '8rem', '6rem']}
    />
  )
}

/** 空态：无数据。 */
export const Empty: StoryObj = {
  render: () => <EmptyDemo />
}

function EmptyDemo() {
  const { table } = useDataTable({
    data: [] as Task[],
    columns: columns.slice(1),
    pageCount: 0,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    getRowId: row => row.id
  })
  return <DataTable table={table} />
}

/** 单列排序（不带 toolbar 展示纯排序交互）。 */
export const SortOnly: StoryObj = {
  render: () => <SortDemo />
}

function SortDemo() {
  const data = useMemo(() => makeTasks(8), [])
  const { table } = useDataTable({
    data,
    columns: columns.slice(1),
    pageCount: 1,
    initialState: { pagination: { pageIndex: 0, pageSize: 8 } },
    getRowId: row => row.id
  })
  return <DataTable table={table} />
}
