import { logger } from "@zoeymind/logger"

/**
 * ZIP嵌套文件导入导出工具
 * 支持将思维导图导出为文件夹结构的zip，每个节点对应一个文件夹和index.md
 */
import JSZip from "jszip"
import type { default as MindMap } from "simple-mind-map"
import {
  convertMindMapNodeTreeToMarkdownWithIcons,
  convertMarkdownToMindMapNodeTree,
  extractEmojisAndConvertToIcons,
  generateUID,
} from "./markdownParser"
import type { MindMapNodeTree } from "simple-mind-map"

/**
 * ZIP嵌套导出器
 */
export class ZipNestedExporter {
  private mindMap: MindMap | null

  constructor(mindMap: MindMap | null) {
    this.mindMap = mindMap
  }

  /**
   * 导出为ZIP文件
   */
  public async export(): Promise<Blob> {
    try {
      if (!this.mindMap || !this.mindMap.renderer) {
        throw new Error("MindMap is not initialized")
      }
      const zip = new JSZip()
      await this.generateFolderStructure(zip, this.mindMap.getData(), "")
      return zip.generateAsync({ type: "blob" })
    } catch (error) {
      logger.error("ZIP导出失败:", error)
      throw error
    }
  }

  /**
   * 递归生成文件夹结构
   * @param zip JSZip实例
   * @param node 当前节点
   * @param currentPath 当前路径
   */
  private async generateFolderStructure(
    zip: JSZip,
    node: MindMapNodeTree,
    currentPath: string
  ): Promise<void> {
    // 判断是否为模块节点（有子节点且子节点不全是叶子节点）
    const isModuleNode = this.isModuleNode(node)

    if (isModuleNode) {
      // 模块节点：创建文件夹，如果有内容则创建index.md
      const folderName = this.sanitizeFileName(node.data.text)
      const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName

      // 生成index.md内容
      const indexContent = await this.generateCompleteMarkdown(node)

      // 只有当内容不为空时才创建index.md文件
      if (indexContent.trim()) {
        zip.file(`${folderPath}/index.md`, indexContent)
      }

      // 递归处理子模块
      for (const child of node.children) {
        if (this.isModuleNode(child)) {
          await this.generateFolderStructure(zip, child, folderPath)
        }
      }
    }
  }

  /**
   * 判断是否为模块节点（应该创建文件夹的节点）
   * @param node 节点
   * @returns 是否为模块节点
   */
  private isModuleNode(node: MindMapNodeTree): boolean {
    if (!node.children || node.children.length === 0) {
      return false
    }

    // 如果子节点中有任何一个还有子节点，则当前节点是模块节点
    return node.children.some(
      (child: MindMapNodeTree) => child.children && child.children.length > 0
    )
  }

  /**
   * 生成完整的markdown内容（只包含当前层级的用例，不包含子模块内容）
   * @param node 父节点
   * @returns markdown内容
   */
  private async generateCompleteMarkdown(node: MindMapNodeTree): Promise<string> {
    // 只导出子节点内容，不包含当前节点的标题（因为文件夹名称已经是模块名）
    if (!node.children || node.children.length === 0) {
      return ""
    }

    let content = ""
    for (const child of node.children) {
      // 只处理非模块节点（用例节点），跳过子模块
      if (!this.isModuleNode(child)) {
        // 为每个用例生成markdown，确保包含图标信息
        const childMarkdown = await convertMindMapNodeTreeToMarkdownWithIcons(child)

        // 将子节点的markdown转换为列表项格式，保持图标信息
        const lines = childMarkdown.split("\n").filter((line: string) => line.trim())
        if (lines.length > 0) {
          // 处理第一行：从标题转换为列表项
          const firstLine = lines[0]
          if (firstLine.match(/^#+\s/)) {
            // 如果是标题格式，转换为列表项
            const titleContent = firstLine.replace(/^#+\s*/, "")
            content += `- ${titleContent}\n`
          } else {
            content += `- ${firstLine}\n`
          }

          // 处理后续行：保持缩进结构，但增加两个空格的缩进
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i]
            if (line.trim()) {
              content += `  ${line}\n`
            }
          }

          content += "\n" // 在用例之间添加空行
        }
      }
      // 子模块节点会在generateFolderStructure中单独处理，不在index.md中包含
    }

    return content.trim()
  }

  /**
   * 清理文件名，移除不允许的字符
   * @param fileName 原始文件名
   * @returns 清理后的文件名
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, "") // 移除Windows不允许的字符
      .replace(/\s+/g, "_") // 空格替换为下划线
      .trim()
  }
}

/**
 * ZIP嵌套导入器
 */
export class ZipNestedImporter {
  /**
   * 解析ZIP文件并转换为思维导图数据
   * @param file ZIP文件
   * @returns 思维导图数据
   */
  public async parseZipFile(file: File): Promise<MindMapNodeTree> {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      throw new Error("不支持的文件类型，请选择.zip文件")
    }
    try {
      // 使用JSZip解压文件
      const zip = new JSZip()
      const zipFile = await zip.loadAsync(await file.arrayBuffer())

      // 构建文件结构映射
      const fileStructure = this.buildFileStructure(zipFile)

      // 创建根节点
      const rootData: MindMapNodeTree = {
        data: {
          text: file.name.replace(".zip", ""),
          uid: generateUID(),
          expand: true,
          isActive: false,
          richText: false,
        },
        children: [],
      }

      // 查找所有顶级文件夹
      const topLevelFolders = this.findSubfolders(fileStructure, "")

      // 解析每个顶级文件夹
      for (const folder of topLevelFolders) {
        const folderData = await this.parseFolder(zipFile, fileStructure, folder)
        if (folderData) {
          rootData.children.push(folderData)
        }
      }

      // 如果根目录有index.md，也处理根目录内容
      const rootFiles = fileStructure.get("") || []
      const rootIndexFile = rootFiles.find(f => f.toLowerCase() === "index.md")
      if (rootIndexFile) {
        const rootIndexContent = await zipFile.files[rootIndexFile].async("string")
        if (rootIndexContent.trim()) {
          // 解析根目录的index.md内容并添加到根节点的children中
          const rootContentData = await convertMarkdownToMindMapNodeTree(rootIndexContent)
          // 只使用children，不包含"Markdown导入"根节点
          rootData.children.unshift(...rootContentData.children)
        }
      }

      return rootData
    } catch (error) {
      logger.error("ZIP导入失败:", error)
      throw new Error(`ZIP导入失败: ${error instanceof Error ? error.message : "未知错误"}`)
    }
  }

  /**
   * 构建文件结构映射
   * @param zipFile JSZip文件实例
   * @returns 文件结构映射
   */
  private buildFileStructure(zipFile: JSZip): Map<string, string[]> {
    const structure = new Map<string, string[]>()

    Object.keys(zipFile.files).forEach(path => {
      const parts = path.split("/")
      const dir = parts.slice(0, -1).join("/")
      const fileName = parts[parts.length - 1]

      if (fileName && !zipFile.files[path].dir) {
        if (!structure.has(dir)) {
          structure.set(dir, [])
        }
        structure.get(dir)!.push(fileName)
      }
    })

    return structure
  }

  /**
   * 解析文件夹
   * @param zipFile JSZip文件实例
   * @param fileStructure 文件结构映射
   * @param folderPath 文件夹路径
   * @returns 思维导图数据
   */
  private async parseFolder(
    zipFile: JSZip,
    fileStructure: Map<string, string[]>,
    folderPath: string
  ): Promise<MindMapNodeTree | null> {
    const files = fileStructure.get(folderPath) || []
    const indexFile = files.find(f => f.toLowerCase() === "index.md")

    if (!indexFile) {
      return null
    }

    // 读取index.md文件
    const indexPath = folderPath ? `${folderPath}/${indexFile}` : indexFile
    const indexContent = await zipFile.files[indexPath].async("string")

    // 从文件夹路径获取模块名称
    const folderName = folderPath.split("/").pop() || "模块"

    // 创建当前模块的节点，使用文件夹名作为标题，添加🚩图标
    const baseData: MindMapNodeTree = {
      data: {
        text: folderName,
        uid: generateUID(),
        expand: true,
        isActive: false,
        richText: false,
        icon: ["sign_2"], // 添加🚩图标
      },
      children: [],
    }

    // 如果有内容，解析markdown并添加到children中
    if (indexContent.trim()) {
      // 使用专门的解析函数处理缩进层级
      baseData.children = this.parseMarkdownWithIndentation(indexContent)
    }

    // 查找子文件夹（子模块）
    const subfolders = this.findSubfolders(fileStructure, folderPath)

    // 处理子文件夹（子模块）
    for (const subfolder of subfolders) {
      const subfolderPath = folderPath ? `${folderPath}/${subfolder}` : subfolder
      const childData = await this.parseFolder(zipFile, fileStructure, subfolderPath)
      if (childData) {
        // 将子模块添加到baseData的children中
        baseData.children.push(childData)
      }
    }

    return baseData
  }

  /**
   * 查找子文件夹
   * @param fileStructure 文件结构映射
   * @param parentPath 父路径
   * @returns 子文件夹列表
   */
  private findSubfolders(fileStructure: Map<string, string[]>, parentPath: string): string[] {
    const subfolders: string[] = []

    for (const [path] of fileStructure) {
      if (path.startsWith(parentPath) && path !== parentPath) {
        const relativePath = parentPath ? path.substring(parentPath.length + 1) : path
        const parts = relativePath.split("/")
        if (parts.length === 1 && parts[0]) {
          subfolders.push(parts[0])
        }
      }
    }

    return [...new Set(subfolders)] // 去重
  }

  /**
   * 解析带缩进的markdown内容
   * @param content markdown内容
   * @returns 解析后的节点数组
   */
  private parseMarkdownWithIndentation(content: string): MindMapNodeTree[] {
    const lines = content.split("\n").filter(line => line.trim())
    const result: MindMapNodeTree[] = []
    const stack: Array<{ node: MindMapNodeTree; level: number }> = []

    for (const line of lines) {
      if (!line.trim()) continue

      // 计算缩进级别（每两个空格为一级）
      const indentMatch = line.match(/^(\s*)/)
      const indentLevel = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0

      // 提取内容（移除缩进和列表标记）
      const content = line.trim().replace(/^[-*]\s*/, "")

      if (!content) continue

      // 创建节点，使用现有的图标转换功能
      const { cleanText, icons } = extractEmojisAndConvertToIcons(content)
      const newNode: MindMapNodeTree = {
        data: {
          text: cleanText,
          uid: generateUID(),
          expand: true,
          isActive: false,
          richText: false,
        },
        children: [],
      }

      if (icons.length > 0) {
        newNode.data.icon = icons
      }

      // 调整栈到合适的层级
      while (stack.length > 0 && stack[stack.length - 1].level >= indentLevel) {
        stack.pop()
      }

      // 添加到父节点或根节点
      if (stack.length === 0) {
        result.push(newNode)
      } else {
        stack[stack.length - 1].node.children.push(newNode)
      }

      // 将当前节点加入栈
      stack.push({ node: newNode, level: indentLevel })
    }

    return result
  }
}

/**
 * 导出思维导图为ZIP嵌套文件结构
 * @param mindMap 思维导图实例
 */
export const exportToZipNested = async (mindMap: MindMap): Promise<Blob> => {
  return new ZipNestedExporter(mindMap).export()
}

/**
 * 从ZIP嵌套文件结构导入思维导图
 * @param file ZIP文件
 * @returns 思维导图数据
 */
export const importFromZipNested = async (file: File): Promise<MindMapNodeTree> => {
  const importer = new ZipNestedImporter()
  return await importer.parseZipFile(file)
}
