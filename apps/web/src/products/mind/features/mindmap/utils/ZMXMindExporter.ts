import JSZip from 'jszip'
import { logger } from '@zoeymind/logger'
import type { default as MindMap, MindMapNodeTree } from 'simple-mind-map'

interface XMindTopic {
  add: (options: { title: string }) => void
  addChild: (options: { parentId: string }) => XMindTopic
  setTitle: (title: string) => void
  cid: () => string
  on: (id: string) => void
  marker: (marker: string) => void
}

interface XMindSheet {
  [key: string]: unknown
}

interface XMindWorkbook {
  createSheet: (name: string, title: string) => XMindSheet
  toXmind: () => Promise<string>
}

interface XMindMarker {
  priority: (name: string) => string
  star: (color: string) => string
  flag: (color: string) => string
}

interface XMindDumper {
  dumping: () => Array<{ filename: string; value: string | Blob }>
}

interface XMindExportPlugin {
  xmind: (mindMapData: MindMapNodeTree, fileName: string) => Promise<Blob>
}

type MindMapWithXMindExport = MindMap & {
  doExportXMind?: XMindExportPlugin
}

declare global {
  interface Window {
    Workbook: new () => XMindWorkbook
    Topic: new (options: { sheet: XMindSheet }) => XMindTopic
    Marker: new () => XMindMarker
    Dumper: new (options: { workbook: XMindWorkbook }) => XMindDumper
  }
}

/**
 * 节点类型枚举
 */
enum NodeType {
  MODULE = 'sign_2', // 模块节点（通过 sign_2 图标标识）
  TEST_CASE = 'priority', // 测试用例节点（通过 priority_* 图标标识）
  STEP = 'no_icon' // 步骤节点
}

/**
 * 解析后的测试用例数据结构
 */
interface ParsedTestCase {
  title: string // 用例标题（& 前面的内容）
  precondition: string // 前置条件（& 后面的内容）
  hasPrecondition: boolean
  priority: string // 用例等级 P0/P1/P2
  hasPriority: boolean
}

/**
 * 解析后的步骤数据结构
 */
interface ParsedStep {
  description: string // 步骤描述（& 前面）
  expected: string // 预期结果（& 后面）
  isValid: boolean
}

/**
 * MeterSphere XMind 导出器（代码内部以 "ZM" 命名，对应 MeterSphere 测试管理工具的 XMind 导出格式）
 * ----------
 * 将测试用例思维导图导出为 MeterSphere 可以识别的 XMind 文件。
 * 类名保留 ZM 前缀是历史原因；用户可见的字符串一律使用 MeterSphere。
 */
export class ZMXMindExporter {
  private mindMap: MindMap | null

  constructor(mindMap: MindMap | null) {
    this.mindMap = mindMap
  }

  /**
   * 导出思维导图为ZM格式的XMind文件
   */
  public async export(): Promise<void> {
    try {
      if (!this.mindMap || !this.mindMap.renderer) {
        throw new Error('思维导图未初始化')
      }

      const completeData = this.mindMap.getData()
      const rootText = completeData.data?.text || '测试用例'

      // 转换为 MeterSphere 格式（case：前缀、步骤层级、前置条件、优先级）
      const zmData = this.transformDataToZMFormat(completeData)

      const mindMapWithXMindExport = this.mindMap as MindMapWithXMindExport

      if (!mindMapWithXMindExport.doExportXMind) {
        throw new Error('XMind 导出插件未注册')
      }

      const blob = await mindMapWithXMindExport.doExportXMind.xmind(zmData, rootText)
      this.downloadBlob(blob, rootText)
    } catch (error) {
      logger.error('MeterSphere XMind 导出失败:', error)
      throw error
    }
  }

  /**
   * 从数据直接导出ZM格式的XMind文件
   * @param mindMapData 思维导图数据
   * @param fileName 导出文件名
   */
  public async exportFromData(
    mindMapData: MindMapNodeTree,
    fileName: string = '测试用例'
  ): Promise<void> {
    try {
      // 检查 XMind SDK 是否加载
      if (!window.Workbook || !window.Topic || !window.Dumper) {
        throw new Error('XMind SDK 未加载，请稍后重试')
      }

      if (!mindMapData) {
        throw new Error('思维导图数据为空')
      }

      const workbook = new window.Workbook()
      const completeData = mindMapData
      const rootText = completeData.data?.text || fileName

      const sheet = workbook.createSheet('Sheet 1', rootText)
      const topic = new window.Topic({ sheet })
      const rootId = topic.cid()

      // 处理所有子节点
      if (completeData.children && completeData.children.length > 0) {
        completeData.children.forEach(child => {
          this.createTopicsFromJson(topic, rootId, child)
        })
      }

      // 导出为xmind文件
      this.dataToDownload(workbook, rootText)
    } catch (error) {
      logger.error('从数据导出 MeterSphere XMind 失败:', error)
      throw error
    }
  }

  /**
   * 识别节点类型
   * @param node 节点数据
   * @returns 节点类型
   */
  private identifyNodeType(node: MindMapNodeTree): NodeType {
    const icons = node.data.icon || []
    if (icons.includes('sign_2')) return NodeType.MODULE
    if (icons.some((icon: string) => icon.startsWith('priority_'))) return NodeType.TEST_CASE
    return NodeType.STEP
  }

  /**
   * 解析测试用例节点文本
   * 格式：测试标题 & 前置条件
   * @param text 节点文本
   * @param icons 图标数组（用于解析优先级）
   * @returns 解析后的测试用例数据
   */
  private parseTestCase(text: string, icons?: string[]): ParsedTestCase {
    const separatorIndex = text.indexOf('&')
    const baseResult = {
      title: separatorIndex === -1 ? text.trim() : text.substring(0, separatorIndex).trim(),
      precondition: separatorIndex === -1 ? '' : text.substring(separatorIndex + 1).trim(),
      hasPrecondition: separatorIndex !== -1,
      priority: '',
      hasPriority: false
    }

    // 解析优先级
    if (icons && icons.length > 0) {
      const priorityIcon = icons.find(icon => icon.startsWith('priority_'))
      if (priorityIcon) {
        const priorityMap: Record<string, string> = {
          priority_1: 'P0',
          priority_2: 'P1',
          priority_3: 'P2'
        }
        const priority = priorityMap[priorityIcon]
        if (priority) {
          return {
            ...baseResult,
            priority,
            hasPriority: true
          }
        }
      }
    }

    return baseResult
  }

  /**
   * 解析步骤节点文本
   * 格式：步骤描述 & 预期结果
   * @param stepText 步骤文本
   * @returns 解析后的步骤数据
   */
  private parseStep(stepText: string): ParsedStep {
    const separatorIndex = stepText.indexOf('&')
    if (separatorIndex === -1) {
      return {
        description: stepText.trim(),
        expected: '',
        isValid: false
      }
    }
    return {
      description: stepText.substring(0, separatorIndex).trim(),
      expected: stepText.substring(separatorIndex + 1).trim(),
      isValid: true
    }
  }

  /**
   * 从JSON递归创建XMind主题节点
   * @param parentTopic 父主题
   * @param parentId 父节点ID
   * @param data 节点数据
   * @param parentIconType 父节点图标类型（用于判断是否为用例节点）
   */
  private createTopicsFromJson(
    parentTopic: XMindTopic,
    parentId: string,
    data: MindMapNodeTree,
    parentIconType?: string
  ): void {
    try {
      // 如果父节点是用例节点，步骤节点由 createTestCaseNode 统一处理
      // 不再单独递归处理步骤节点
      if (parentIconType === NodeType.TEST_CASE) {
        return
      }

      const nodeType = this.identifyNodeType(data)

      switch (nodeType) {
        case NodeType.MODULE:
          this.createModuleNode(parentTopic, parentId, data)
          break
        case NodeType.TEST_CASE:
          this.createTestCaseNode(parentTopic, parentId, data)
          break
        default:
          this.createNormalNode(parentTopic, parentId, data)
          break
      }
    } catch (error) {
      logger.error('创建主题节点失败:', { nodeText: data.data.text, error })
    }
  }

  /**
   * 创建模块节点
   * 直接显示纯文本，不添加前缀
   */
  private createModuleNode(topic: XMindTopic, parentId: string, data: MindMapNodeTree): void {
    const title = data.data.text || ''

    topic.add({ title })
    const temId = topic.cid()
    topic.on(temId)

    // 不添加图标

    // 递归处理子节点
    if (data.children && data.children.length > 0) {
      data.children.forEach(child => {
        this.createTopicsFromJson(topic, temId, child, 'sign_2')
      })
    }

    topic.on(parentId)
  }

  /**
   * 创建测试用例节点
   * 添加"case："前缀，提取前置条件和优先级
   */
  private createTestCaseNode(topic: XMindTopic, parentId: string, data: MindMapNodeTree): void {
    const parsed = this.parseTestCase(data.data.text || '', data.data.icon)
    const title = `case：${parsed.title}`

    topic.add({ title })
    const temId = topic.cid()
    topic.on(temId)

    // 不添加图标

    // 添加前置条件子节点
    if (parsed.hasPrecondition) {
      topic.add({ title: `前置条件：${parsed.precondition}` })
      topic.on(temId)
    }

    // 添加用例等级子节点
    if (parsed.hasPriority) {
      topic.add({ title: `用例等级：${parsed.priority}` })
      topic.on(temId)
    }

    // 处理步骤节点：创建一个"步骤描述"父节点，所有步骤作为其子节点
    if (data.children && data.children.length > 0) {
      // 创建唯一的"步骤描述"节点
      topic.add({ title: '步骤描述' })
      const stepDescId = topic.cid()
      topic.on(stepDescId)

      // 将所有步骤作为"步骤描述"的子节点
      data.children.forEach(child => {
        this.createStepChildNode(topic, stepDescId, child.data.text || '')
      })

      // 返回到测试用例节点
      topic.on(temId)
    }

    topic.on(parentId)
  }

  /**
   * 创建普通节点（无特殊图标）
   */
  private createNormalNode(topic: XMindTopic, parentId: string, data: MindMapNodeTree): void {
    topic.add({ title: data.data.text || '' })
    const temId = topic.cid()
    topic.on(temId)

    // 不添加图标

    // 递归处理子节点
    if (data.children && data.children.length > 0) {
      data.children.forEach(child => {
        this.createTopicsFromJson(topic, temId, child)
      })
    }

    topic.on(parentId)
  }

  /**
   * 创建步骤子节点（2层结构）
   * 作为"步骤描述"节点的子节点
   * 结构：
   *   步骤：xxx
   *   └── 预期结果：xxx
   * @param parentTopic 父主题
   * @param parentId 父节点ID（"步骤描述"节点）
   * @param stepText 步骤文本
   */
  private createStepChildNode(parentTopic: XMindTopic, parentId: string, stepText: string): void {
    const parsed = this.parseStep(stepText)

    // 第1层：步骤：xxx
    parentTopic.add({ title: `步骤：${parsed.description}` })
    const detailId = parentTopic.cid()
    parentTopic.on(detailId)

    // 第2层：预期结果：xxx（如果有）
    if (parsed.expected) {
      parentTopic.add({ title: `预期结果：${parsed.expected}` })
      parentTopic.on(detailId)
    }

    // 返回到"步骤描述"节点
    parentTopic.on(parentId)
  }

  /**
   * 生成XMind文件并触发下载
   */
  private dataToDownload(workbook: XMindWorkbook, fileName: string = '测试用例'): void {
    const zip = new JSZip()
    const dumper = new window.Dumper({ workbook })
    const files = dumper.dumping()

    files.forEach(file => {
      zip.file(file.filename, file.value)
    })

    zip
      .generateAsync({ type: 'blob' })
      .then(content => {
        const downloadLink = document.createElement('a')
        downloadLink.href = URL.createObjectURL(content)
        downloadLink.download = `${fileName}.xmind`
        downloadLink.style.display = 'none'
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(downloadLink.href)
      })
      .catch(e => {
        logger.error('生成XMind文件失败:', e)
      })
  }

  /**
   * 将思维导图数据转换为 MeterSphere XMind 格式
   * 为测试用例节点加上 case：前缀，重构步骤层级，提取前置条件和优先级
   */
  private transformDataToZMFormat(data: MindMapNodeTree): MindMapNodeTree {
    const result: MindMapNodeTree = {
      data: { ...data.data },
      children: []
    }

    if (data.children && data.children.length > 0) {
      result.children = this.transformChildrenToZMFormat(data.children)
    }

    return result
  }

  /**
   * 递归转换子节点为 MeterSphere 格式
   */
  private transformChildrenToZMFormat(children: MindMapNodeTree[]): MindMapNodeTree[] {
    const result: MindMapNodeTree[] = []
    for (const child of children) {
      const transformed = this.transformSingleNode(child)
      result.push(...transformed)
    }
    return result
  }

  /**
   * 转换单个节点为 MeterSphere 格式
   * - 模块节点（sign_2 图标）：保持原样，递归处理子节点
   * - 测试用例节点（priority_X 图标）：加 case：前缀，重构步骤层级
   * - 普通节点：保持原样，递归处理子节点
   */
  private transformSingleNode(node: MindMapNodeTree): MindMapNodeTree[] {
    const icons = node.data.icon || []

    // 模块节点 - 保持原样，递归子节点
    if (icons.includes('sign_2')) {
      const result: MindMapNodeTree = { data: { ...node.data }, children: [] }
      if (node.children && node.children.length > 0) {
        result.children = this.transformChildrenToZMFormat(node.children)
      }
      return [result]
    }

    // 测试用例节点 - 转换为 MeterSphere 格式
    if (icons.some((icon: string) => icon.startsWith('priority_'))) {
      const parsed = this.parseTestCase(node.data.text || '', node.data.icon)

      const result: MindMapNodeTree = {
        data: {
          ...node.data,
          text: `case：${parsed.title}`
        },
        children: []
      }

      // 添加前置条件子节点
      if (parsed.hasPrecondition) {
        result.children.push({
          data: { text: `前置条件：${parsed.precondition}` },
          children: []
        })
      }

      // 添加用例等级子节点
      if (parsed.hasPriority) {
        result.children.push({
          data: { text: `用例等级：${parsed.priority}` },
          children: []
        })
      }

      // 创建步骤层级
      if (node.children && node.children.length > 0) {
        const stepDescNode: MindMapNodeTree = {
          data: { text: '步骤描述' },
          children: []
        }

        for (const child of node.children) {
          const stepParsed = this.parseStep(child.data.text || '')
          const stepNode: MindMapNodeTree = {
            data: { text: `步骤：${stepParsed.description}` },
            children: []
          }
          if (stepParsed.expected) {
            stepNode.children.push({
              data: { text: `预期结果：${stepParsed.expected}` },
              children: []
            })
          }
          stepDescNode.children.push(stepNode)
        }

        result.children.push(stepDescNode)
      }

      return [result]
    }

    // 普通节点 - 保持原样，递归子节点
    const result: MindMapNodeTree = { data: { ...node.data }, children: [] }
    if (node.children && node.children.length > 0) {
      result.children = this.transformChildrenToZMFormat(node.children)
    }
    return [result]
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${fileName}.xmind`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }
}
