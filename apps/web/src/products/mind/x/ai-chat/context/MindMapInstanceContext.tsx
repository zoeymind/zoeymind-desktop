/**
 * MindMapInstanceContext — 把 mindMap 实例通过 React Context 暴露给消息组件,
 * 替代之前 UserMessage / AssistantMessage 各自维护的 `globalMindMapInstance` 全局变量.
 *
 * Markdown 组件里点 mention 标签时, 需要拿到 mindMap.execCommand 去定位节点;
 * 之前两个组件各设了一个模块级 `let globalMindMapInstance` 然后在 useEffect 里赋值,
 * 现在统一从 Context 拿, 避免两份相互不同步的全局状态.
 */

import { type ReactNode, type ReactElement } from "react"
import type MindMap from "simple-mind-map"
import { MindMapInstanceContext } from "./mindmap-instance"

interface MindMapInstanceProviderProps {
  /** 当前活跃的 mindMap 实例; 没有时传 null, 消费方需自己兜底 */
  mindMap: MindMap | null
  children: ReactNode
}

export function MindMapInstanceProvider({
  mindMap,
  children,
}: MindMapInstanceProviderProps): ReactElement {
  return (
    <MindMapInstanceContext.Provider value={mindMap}>{children}</MindMapInstanceContext.Provider>
  )
}
