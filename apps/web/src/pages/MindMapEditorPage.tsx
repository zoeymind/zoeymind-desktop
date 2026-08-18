/**
 * 桌面端思维导图编辑器路由入口 —— 骨架 stub。
 *
 * 后续挂载 MindMapCanvas + TopBar + FormatPanel + StatusBar；
 * 全屏，不共享 MainLayout 侧栏；从 URL :id 通过 SQLite 索引解析出磁盘路径 + .zmind 读取。
 */
import { useParams, useNavigate } from 'react-router-dom'

export function MindMapEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <button onClick={() => navigate('/')}>← 返回列表</button>
        <div className="text-sm text-muted-foreground">编辑器 stub — id: {id}</div>
      </div>
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        MindMapCanvas 待接入
      </div>
    </div>
  )
}
