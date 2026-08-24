import { createContext, useContext } from "react"
import type MindMap from "simple-mind-map"

export const MindMapInstanceContext = createContext<MindMap | null>(null)

export function useMindMapInstance(): MindMap | null {
  return useContext(MindMapInstanceContext)
}
