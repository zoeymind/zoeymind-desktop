import { generateUUID } from '@/shared/app-shared'
import { logger } from '@zoeymind/logger'
import type { default as MindMapClass, MindMapNode } from 'simple-mind-map'

// 使用官方的 NodeData 类型
import type { NodeData } from 'simple-mind-map'

export class NodeManager {
  private mindMap: MindMapClass

  constructor(mindMap: MindMapClass) {
    this.mindMap = mindMap
  }

  // 创建节点数据
  createNodeData(text: string, customData?: Record<string, unknown>): NodeData {
    return {
      data: {
        text,
        uid: generateUUID(),
        expand: true,
        isActive: false,
        ...customData
      },
      children: []
    }
  }

  // 查找节点
  findNodeByUid(uid: string): MindMapNode | null {
    try {
      return this.mindMap.renderer.findNodeByUid(uid)
    } catch (error) {
      logger.error('查找节点失败:', error)
      return null
    }
  }

  // 获取活跃节点
  getActiveNodes(): MindMapNode[] {
    return (this.mindMap.renderer?.activeNodeList || []) as unknown as MindMapNode[]
  }

  // 获取根节点
  getRootNode(): MindMapNode | null {
    return (this.mindMap.renderer?.root || null) as unknown as MindMapNode | null
  }

  // 删除原来的 addChildNode 方法，使用下面重载的版本

  // 删除节点
  removeNode(node: MindMapNode): void {
    try {
      if (node.remove) {
        node.remove()
      }
    } catch (error) {
      logger.error('删除节点失败:', error)
    }
  }

  // 更新节点数据
  updateNodeData(node: MindMapNode, data: Partial<NodeData['data']>): void {
    try {
      Object.assign(node.data, data)
      if (node.update) {
        node.update()
      }
    } catch (error) {
      logger.error('更新节点数据失败:', error)
    }
  }

  // 设置节点图标
  setNodeIcon(node: MindMapNode, icons: string[]): void {
    try {
      if (node.setIcon) {
        node.setIcon(icons)
      }
    } catch (error) {
      logger.error('设置节点图标失败:', error)
    }
  }

  // 激活节点
  activateNode(node: MindMapNode): void {
    try {
      if (node.active) {
        node.active()
      }
    } catch (error) {
      logger.error('激活节点失败:', error)
    }
  }

  // 取消激活节点
  deactivateNode(node: MindMapNode): void {
    try {
      if (node.deactivate) {
        node.deactivate()
      }
    } catch (error) {
      logger.error('取消激活节点失败:', error)
    }
  }

  // 获取节点位置和尺寸
  getNodeRect(node: MindMapNode): { x: number; y: number; width: number; height: number } | null {
    try {
      return node.getRect ? node.getRect() : null
    } catch (error) {
      logger.error('获取节点位置失败:', error)
      return null
    }
  }

  // 检查节点是否为根节点
  isRootNode(node: MindMapNode): boolean {
    return node.isRoot === true
  }

  // 获取节点文本
  getNodeText(node: MindMapNode): string {
    return node.data?.text || ''
  }

  // 设置节点文本
  setNodeText(node: MindMapNode, text: string): void {
    try {
      if (node.data) {
        node.data.text = text
        if (node.update) {
          node.update()
        }
      }
    } catch (error) {
      logger.error('设置节点文本失败:', error)
    }
  }

  // 获取节点层级
  getNodeLevel(node: MindMapNode): number {
    return node.layerIndex || 0
  }

  // 获取节点子节点数量
  getChildrenCount(node: MindMapNode): number {
    return node.children?.length || 0
  }

  // 检查节点是否展开
  isNodeExpanded(node: MindMapNode): boolean {
    return node.data?.expand !== false
  }

  // 展开/收起节点
  toggleNodeExpand(node: MindMapNode): void {
    try {
      if (node.data) {
        node.data.expand = !node.data.expand
        if (node.update) {
          node.update()
        }
      }
    } catch (error) {
      logger.error('切换节点展开状态失败:', error)
    }
  }

  // ===== 补充缺失的方法 =====

  // 通过 UID 激活节点
  activateNodeByUid(uid: string): void {
    // ✅ GO_TARGET_NODE 支持 UID 字符串,会自动展开折叠的节点
    this.mindMap.execCommand('GO_TARGET_NODE', uid)
  }

  // 获取所有节点
  getAllNodes(): MindMapNode[] {
    const nodes: MindMapNode[] = []

    const traverse = (node: MindMapNode) => {
      nodes.push(node)
      if (node.children) {
        node.children.forEach(child => traverse(child))
      }
    }

    const rootNode = this.getRootNode()
    if (rootNode) {
      traverse(rootNode)
    }

    return nodes
  }

  // 获取单个活跃节点（返回第一个）
  getActiveNode(): MindMapNode | null {
    const activeNodes = this.getActiveNodes()
    return activeNodes.length > 0 ? activeNodes[0] : null
  }

  // 递归折叠/展开节点 - 用户建议的简洁实现
  toggleFold(node: MindMapNode): void {
    try {
      if (!node) return
      const { expand, uid } = node.getData()
      if (expand) {
        this.mindMap.execCommand('UNEXPAND_ALL', false, uid)
      } else {
        this.mindMap.execCommand('EXPAND_ALL', uid)
      }
    } catch (error) {
      logger.error('递归折叠/展开节点失败:', error)
      // 降级处理：使用简单的展开/收起
      this.toggleNodeExpand(node)
    }
  }

  // 复制节点（使用 renderer.copy 以支持飞书/XMind格式）
  copyNode(): void {
    try {
      if (this.mindMap.renderer && typeof this.mindMap.renderer.copy === 'function') {
        this.mindMap.renderer.copy()
      } else {
        this.mindMap.execCommand('COPY')
      }
    } catch (error) {
      logger.error('复制节点失败:', error)
    }
  }

  // 剪切节点
  cutNode(): void {
    try {
      this.mindMap.execCommand('CUT_NODE', () => {
        logger.debug('节点已剪切到剪贴板')
      })
    } catch (error) {
      logger.error('剪切节点失败:', error)
    }
  }

  // 粘贴节点（使用 renderer.paste 以支持飞书/XMind格式）
  pasteNode(): void {
    try {
      if (this.mindMap.renderer && typeof this.mindMap.renderer.paste === 'function') {
        this.mindMap.renderer.paste()
      } else {
        this.mindMap.execCommand('PASTE_NODE')
      }
    } catch (error) {
      logger.error('粘贴节点失败:', error)
    }
  }

  // 删除节点
  deleteNode(): void {
    try {
      this.mindMap.execCommand('REMOVE_NODE')
    } catch (error) {
      logger.error('删除节点失败:', error)
    }
  }

  // 复制节点 - 在同级位置复制当前激活的节点
  duplicateNode(): void {
    try {
      const activeNodes = this.mindMap.renderer.activeNodeList
      if (activeNodes.length === 0) {
        logger.warn('没有激活的节点可以复制')
        return
      }

      // 遍历所有激活的节点进行复制
      activeNodes.forEach(node => {
        // 如果是根节点，不能复制
        if (node.isRoot) {
          logger.warn('根节点不能被复制')
          return
        }

        // 获取节点的纯数据（移除激活状态和ID）
        const nodeData = (node as unknown as MindMapNode).getPureData(true, true)

        // 使用 INSERT_NODE 命令在同级位置插入复制的节点
        // 参数：openEdit=false, appointNodes=[当前节点], appointData=复制的数据, appointChildren=复制的子节点
        this.mindMap.execCommand(
          'INSERT_NODE',
          false,
          [node],
          nodeData.data,
          nodeData.children || []
        )
      })

      logger.info('节点复制完成')
    } catch (error) {
      logger.error('复制节点失败:', error)
    }
  }

  // 添加同级节点
  addNode(text: string): void {
    try {
      this.mindMap.execCommand('INSERT_NODE', false, [], { text })
    } catch (error) {
      logger.error('添加节点失败:', error)
    }
  }

  // 添加子节点（重载方法，兼容旧的调用方式）
  addChildNode(parentNodeOrText: MindMapNode | string, nodeData?: NodeData): void {
    try {
      if (typeof parentNodeOrText === 'string') {
        // 旧的调用方式：addChildNode('新子节点')
        this.mindMap.execCommand('INSERT_CHILD_NODE', false, [], { text: parentNodeOrText })
      } else {
        // 新的调用方式：addChildNode(parentNode, nodeData)
        if (!nodeData) {
          throw new Error('nodeData is required when parentNode is provided')
        }

        const parentNode = parentNodeOrText
        this.mindMap.renderer.insertChildNode(
          true, // openEdit
          [parentNode], // appointNodes
          nodeData.data, // appointData
          nodeData.children || [] // appointChildren
        )
      }
    } catch (error) {
      logger.error('添加子节点失败:', error)
    }
  }
}
