/**
 * MCP 连接状态存储（仅内存）
 *
 * MCP 服务器配置已后端化（按 userId 存库，走 trpc.mcp.*）。
 * 此 store 只保留前端「连接测试状态」这种纯 UI 临时态，不持久化。
 */

import { create } from "zustand"

export interface MCPServerStatus {
  connected: boolean
  toolCount?: number
  tools?: Array<{ name: string; description?: string }>
  lastChecked?: string
  error?: string
}

interface MCPStatusSlice {
  serverStatus: Record<string, MCPServerStatus>
  updateServerStatus: (name: string, status: MCPServerStatus) => void
  clearServerStatus: (name: string) => void
  clearAllStatus: () => void
  getServerStatus: (name: string) => MCPServerStatus | undefined
}

export const useMCPStore = create<MCPStatusSlice>()((set, get) => ({
  serverStatus: {},

  updateServerStatus: (name, status) => {
    set(state => ({
      serverStatus: { ...state.serverStatus, [name]: status },
    }))
  },

  clearServerStatus: name => {
    set(state => {
      const next = { ...state.serverStatus }
      delete next[name]
      return { serverStatus: next }
    })
  },

  clearAllStatus: () => set({ serverStatus: {} }),

  getServerStatus: name => get().serverStatus[name],
}))
