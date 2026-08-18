import { walk, getNodeDataIndex } from '../utils/index'

interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown> & {
    rainbowLinesConfig: Record<string, unknown>
  }
  renderer: Record<string, unknown> & {
    renderTree: Record<string, unknown> | null
  }
  command: Record<string, unknown> & {
    addHistory(): void
  }
  render(): void
}

interface RainbowTreeNode {
  data: Record<string, unknown>
  layerIndex: number
  parent: RainbowTreeNode | null
  children?: RainbowTreeNode[]
}

const defaultColorsList: string[] = [
  'rgb(255, 213, 73)',
  'rgb(255, 136, 126)',
  'rgb(107, 225, 141)',
  'rgb(151, 171, 255)',
  'rgb(129, 220, 242)',
  'rgb(255, 163, 125)',
  'rgb(152, 132, 234)'
]

// 彩虹线条插件
class RainbowLines {
  static instanceName: string = 'rainbowLines'

  private mindMap: MindMapInstance

  constructor({ mindMap }: { mindMap: MindMapInstance }) {
    this.mindMap = mindMap
  }

  // 更新彩虹线条配置
  updateRainLinesConfig(config: Record<string, unknown> = {}): void {
    const newConfig: Record<string, unknown> = this.mindMap.opt.rainbowLinesConfig || {}
    newConfig.open = !!config.open
    newConfig.colorsList = Array.isArray(config.colorsList) ? config.colorsList : []
    if (this.mindMap.opt.rainbowLinesConfig.open) {
      this.removeNodeLineColor()
    }
    this.mindMap.render()
  }

  // 删除所有节点的连线颜色
  removeNodeLineColor(): void {
    const tree = this.mindMap.renderer.renderTree
    if (!tree) return
    walk(
      tree,
      null,
      (cur: RainbowTreeNode) => {
        delete cur.data.lineColor
      },
      null,
      true
    )
    this.mindMap.command.addHistory()
  }

  // 获取一个节点的第二层级的祖先节点
  getSecondLayerAncestor(node: RainbowTreeNode): RainbowTreeNode | null {
    if (node.layerIndex === 0) {
      return null
    } else if (node.layerIndex === 1) {
      return node
    } else {
      let res: RainbowTreeNode | null = null
      let parent = node.parent
      while (parent) {
        if (parent.layerIndex === 1) {
          return parent
        }
        parent = parent.parent
      }
      return res
    }
  }

  // 获取颜色列表
  getColorsList(): string[] {
    const { rainbowLinesConfig } = this.mindMap.opt
    return rainbowLinesConfig &&
      Array.isArray(rainbowLinesConfig.colorsList) &&
      (rainbowLinesConfig.colorsList as string[]).length > 0
      ? (rainbowLinesConfig.colorsList as string[])
      : [...defaultColorsList]
  }

  // 获取一个节点的彩虹线条颜色
  getNodeColor(node: RainbowTreeNode): string {
    const { rainbowLinesConfig } = this.mindMap.opt
    if (!rainbowLinesConfig || !rainbowLinesConfig.open) return ''
    const ancestor = this.getSecondLayerAncestor(node)
    if (!ancestor) return ''
    const index = getNodeDataIndex(ancestor)
    const colorsList = this.getColorsList()
    return colorsList[index % colorsList.length]
  }
}

export default RainbowLines
