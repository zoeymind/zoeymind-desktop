import type { MindMapNode } from 'simple-mind-map'

export interface Position {
  x: number
  y: number
}

export interface DropdownState {
  show: boolean
  position: Position
  isRoot: boolean
  currentNode: MindMapNode | null
  isMultiSelect?: boolean
  selectedNodes?: MindMapNode[]
}

export interface IconToolbarState {
  show: boolean
  position: Position
  node: MindMapNode | null
  iconType: string
  iconName: string
  nodeIconList: string[]
}

export interface ViewData {
  scale: number
  scaleOrigin: [number, number]
  translateX: number
  translateY: number
}
