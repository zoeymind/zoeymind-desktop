import JSZip from "jszip"
import { logger } from "@zoeymind/logger"
import type { default as MindMap, MindMapNodeTree } from "simple-mind-map"

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

export class XMindExporter {
  private mindMap: MindMap | null

  constructor(mindMap: MindMap | null) {
    this.mindMap = mindMap
  }

  public async export(): Promise<Blob> {
    try {
      if (!this.mindMap || !this.mindMap.renderer) {
        throw new Error("MindMap is not initialized")
      }
      const completeData = this.mindMap.getData()
      const rootText = (completeData.data?.text as string) || "思维导图"
      const mindMapWithXMindExport = this.mindMap as MindMapWithXMindExport
      if (!mindMapWithXMindExport.doExportXMind) {
        throw new Error("XMind 导出插件未注册")
      }
      return mindMapWithXMindExport.doExportXMind.xmind(completeData, rootText)
    } catch (error) {
      logger.error("导出失败:", error)
      throw error
    }
  }

  /**
   * 从项目数据直接导出XMind文件
   * @param mindMapData 思维导图数据
   * @param fileName 导出的文件名
   */
  public async exportFromData(
    mindMapData: MindMapNodeTree,
    fileName: string = "思维导图"
  ): Promise<void> {
    try {
      if (!mindMapData) {
        throw new Error("MindMap data is required")
      }

      if (!window.Workbook || !window.Topic || !window.Dumper) {
        throw new Error("XMind SDK 未加载，请稍后重试")
      }
      const workbook = new window.Workbook()

      // 将项目数据转换为MindMapNodeTree格式
      const completeData = mindMapData

      // 使用根节点的文本作为标题，如果没有则使用传入的fileName
      const rootText = completeData.data?.text || fileName

      // 创建工作表和主题
      const sheet = workbook.createSheet("Sheet 1", rootText)
      const topic = new window.Topic({ sheet })
      const rootId = topic.cid()

      // 处理所有子节点
      if (completeData.children && completeData.children.length > 0) {
        completeData.children.forEach(child => {
          this.createTopicsFromJson(topic, rootId, child)
        })
      }

      // 导出为 xmind 文件
      await this.data_to_download(workbook, rootText)
    } catch (error) {
      logger.error("Export from data failed:", error)
      throw error
    }
  }

  private createTopicsFromJson(
    parentTopic: XMindTopic,
    comp_id: string,
    data: MindMapNodeTree
  ): void {
    try {
      if (!window.Workbook || !window.Topic || !window.Dumper) {
        throw new Error("XMind SDK 未加载，请稍后重试")
      }
      const marker = new window.Marker()
      const topic = parentTopic

      // 添加当前节点
      topic.add({ title: data.data.text || "" })
      const tem_id = topic.cid()
      topic.on(tem_id)

      // 处理图标
      const icons = data.data.icon || []
      icons.forEach((icon: string) => {
        const [type, name] = icon.split("_")
        try {
          switch (type) {
            case "priority":
              topic.marker(marker.priority(name))
              break
            case "sign":
              switch (name) {
                case "1":
                  topic.marker(marker.star("red"))
                  break
                case "2":
                  topic.marker(marker.flag("red"))
                  break
              }
              break
          }
        } catch (error) {
          logger.error("Failed to add marker:", { type, name, error })
        }
      })

      // 递归处理子节点
      if (data.children && data.children.length > 0) {
        data.children.forEach(child => {
          this.createTopicsFromJson(topic, tem_id, child)
        })
      }

      // 返回到父节点
      topic.on(comp_id)
    } catch (error) {
      logger.error("Create topic failed:", error)
    }
  }

  private data_to_download(workbook: XMindWorkbook, fileName: string = "思维导图"): void {
    const zip = new JSZip()
    if (!window.Workbook || !window.Topic || !window.Dumper) {
      throw new Error("XMind SDK 未加载，请稍后重试")
    }
    const dumper = new window.Dumper({ workbook })
    const files = dumper.dumping()

    files.forEach(file => {
      zip.file(file.filename, file.value)
    })

    zip
      .generateAsync({ type: "blob" })
      .then(content => {
        const downloadLink = document.createElement("a")
        downloadLink.href = URL.createObjectURL(content)
        downloadLink.download = `${fileName}.xmind`
        downloadLink.style.display = "none"
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(downloadLink.href)
      })
      .catch(e => {
        logger.error("Failed to generate zip:", e)
      })
  }
}
