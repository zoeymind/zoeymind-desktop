import { logger } from '@zoeymind/logger'

/**
 * XML 解析工具
 * 使用 fast-xml-parser 库实现高效的 XML 解析
 */
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser'

/**
 * XML 解析选项
 */
export interface XmlParserOptions {
  /**
   * 是否忽略属性
   * @default false
   */
  ignoreAttributes?: boolean

  /**
   * 属性前缀
   * @default '@'
   */
  attributeNamePrefix?: string

  /**
   * 是否解析属性值
   * @default true
   */
  parseAttributeValue?: boolean

  /**
   * 是否解析标签值
   * @default true
   */
  parseTagValue?: boolean

  /**
   * 是否保留标签顺序
   * @default false
   */
  preserveOrder?: boolean

  /**
   * 是否解析注释
   * @default false
   */
  commentPropName?: string | false

  /**
   * 是否忽略命名空间
   * @default false
   */
  ignoreNameSpace?: boolean

  /**
   * 是否允许使用 HTML 实体
   * @default true
   */
  allowBooleanAttributes?: boolean

  /**
   * 是否处理 CDATA
   * @default true
   */
  cdataPropName?: string | false
}

/**
 * 默认解析选项
 */
const defaultOptions: XmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseAttributeValue: true,
  parseTagValue: true,
  preserveOrder: false,
  commentPropName: '#comment',
  ignoreNameSpace: false,
  allowBooleanAttributes: true,
  cdataPropName: '#cdata'
}

/**
 * 验证 XML 字符串是否有效
 * @param xmlString XML 字符串
 * @returns 验证结果，如果有效返回 true，否则返回包含错误信息的对象
 */
export const validateXml = (xmlString: string) => {
  return XMLValidator.validate(xmlString)
}

/**
 * 解析 XML 字符串为 JSON 对象
 * @param xmlString XML 字符串
 * @param options 解析选项
 * @returns 解析后的 JSON 对象
 */
export const parseXml = (xmlString: string, options: XmlParserOptions = {}) => {
  // 合并默认选项和用户选项
  const parserOptions = { ...defaultOptions, ...options }

  // 创建解析器实例
  const parser = new XMLParser(parserOptions)

  // 解析 XML 字符串
  return parser.parse(xmlString)
}

/**
 * 将 JSON 对象转换为 XML 字符串
 * @param jsonObj JSON 对象
 * @param options 构建选项
 * @returns XML 字符串
 */
export const buildXml = (jsonObj: Record<string, unknown>, options: XmlParserOptions = {}) => {
  // 合并默认选项和用户选项
  const builderOptions = { ...defaultOptions, ...options }

  // 创建构建器实例
  const builder = new XMLBuilder(builderOptions)

  // 构建 XML 字符串
  return builder.build(jsonObj)
}

/**
 * 从文件中读取 XML 并解析
 * @param xmlContent XML 内容
 * @param options 解析选项
 * @returns 解析后的 JSON 对象
 */
export const parseXmlContent = (xmlContent: string, options: XmlParserOptions = {}) => {
  try {
    // 验证 XML 是否有效
    const validationResult = validateXml(xmlContent)
    if (validationResult !== true) {
      throw new Error(`无效的 XML 内容: ${JSON.stringify(validationResult)}`)
    }

    // 解析 XML
    return parseXml(xmlContent, options)
  } catch (error) {
    logger.error('解析 XML 内容失败:', error)
    throw new Error(`解析 XML 内容失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 解析 XML 文件
 * 支持从 Blob, File, 或字符串解析
 * @param source XML 源 (File, Blob 或字符串)
 * @param options 解析选项
 * @returns 解析后的 JSON 对象
 */
export const parseXmlSource = async (
  source: File | Blob | string,
  options: XmlParserOptions = {}
) => {
  try {
    let xmlContent: string

    // 根据源类型获取 XML 内容
    if (typeof source === 'string') {
      xmlContent = source
    } else if (source instanceof File || source instanceof Blob) {
      xmlContent = await source.text()
    } else {
      throw new Error('不支持的源类型')
    }

    // 解析 XML 内容
    return parseXmlContent(xmlContent, options)
  } catch (error) {
    logger.error('解析 XML 源失败:', error)
    throw new Error(`解析 XML 源失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}
