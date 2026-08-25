/** MCP runtime connection status. Configuration lives in app-data/mcp.json. */

import { create } from "zustand"

export interface MCPServerStatus {
  connected: boolean
  toolCount?: number
  tools?: Array<{ name: string; description?: string }>
  lastChecked?: string
  error?: string
}

interface MCPStatusSlice {
  servers: import("@/shared/native/mcp-config").NamedMcpServer[]
  initialized: boolean
  initializing: boolean
  serverStatus: Record<string, MCPServerStatus>
  setRuntime: (servers: import("@/shared/native/mcp-config").NamedMcpServer[]) => void
  setInitializing: (initializing: boolean) => void
  updateServerStatus: (id: string, status: MCPServerStatus) => void
  clearServerStatus: (id: string) => void
  clearAllStatus: () => void
  getServerStatus: (id: string) => MCPServerStatus | undefined
}

export const useMCPStore = create<MCPStatusSlice>()((set, get) => ({
  serverStatus: {},
  servers: [],
  initialized: false,
  initializing: false,
  setRuntime: servers => set({ servers, initialized: true, initializing: false }),
  setInitializing: initializing => set({ initializing }),

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
