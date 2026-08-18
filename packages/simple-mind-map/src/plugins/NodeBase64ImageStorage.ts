import { walk, createUid } from '../utils/index'

interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  renderer: Record<string, unknown> & {
    renderTree: Record<string, unknown> | null
  }
}

interface WalkNode {
  data: Record<string, unknown>
  children?: WalkNode[]
}

// 修改base64格式的节点图片在数据中的存储方式
// 将base64格式的图片以key-map的形式存储在根节点的imgMap字段里，其他节点只保存key，避免不同的节点引用相同的图片重复存储的问题，普通url格式的图片不处理
class NodeBase64ImageStorage {
  static instanceName: string = 'nodeBase64ImageStorage'

  private opt: Record<string, unknown>
  private mindMap: MindMapInstance

  constructor(opt: { mindMap: MindMapInstance }) {
    this.opt = opt as unknown as Record<string, unknown>
    this.mindMap = opt.mindMap
    this.bindEvent()
  }

  bindEvent(): void {
    this.onBeforeAddHistory = this.onBeforeAddHistory.bind(this)
    this.mindMap.on('beforeAddHistory', this.onBeforeAddHistory)
  }

  unBindEvent(): void {
    this.mindMap.off('beforeAddHistory', this.onBeforeAddHistory)
  }

  isBase64ImgUrl(url: string): boolean {
    return /^data:/.test(url)
  }

  isImageKey(url: string): boolean {
    return /^smm_img_key_/.test(url)
  }

  createImageKey(): string {
    return 'smm_img_key_' + createUid()
  }

  onBeforeAddHistory(): void {
    const renderTree = this.mindMap.renderer.renderTree
    if (!renderTree) return
    let imgMap: Record<string, string> = (renderTree.data as Record<string, unknown>)
      .imgMap as Record<string, string>
    if (!imgMap) {
      imgMap = (renderTree.data as Record<string, unknown>).imgMap = {}
    }
    const useIds: string[] = []

    const getImgIds = (): string[] => {
      return Object.keys(imgMap)
    }

    const getImgId = (image: string): string | undefined => {
      return getImgIds().find(id => {
        return imgMap[id] === image
      })
    }

    walk(
      renderTree,
      null,
      (node: WalkNode) => {
        const image = node.data.image as string | undefined
        if (image) {
          if (this.isBase64ImgUrl(image)) {
            const hasId = getImgId(image)
            if (hasId) {
              useIds.push(hasId)
              node.data.image = hasId
            } else {
              const newId = this.createImageKey()
              node.data.image = newId
              imgMap[newId] = image
              useIds.push(newId)
            }
          } else if (this.isImageKey(image)) {
            if (getImgIds().includes(image)) {
              useIds.push(image)
            }
          }
        }
      },
      null,
      undefined
    )

    getImgIds().forEach(id => {
      if (!useIds.includes(id)) {
        delete imgMap[id]
      }
    })
  }

  // 插件被移除前做的事情
  beforePluginRemove(): void {
    this.unBindEvent()
  }

  // 插件被卸载前做的事情
  beforePluginDestroy(): void {
    this.unBindEvent()
  }
}

export default NodeBase64ImageStorage
