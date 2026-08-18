// @ts-nocheck — vendored shared package, erasable syntax not applicable
/**
 * 飞书 API 相关类型定义
 *
 * 用于替代 any 类型，提供更好的类型安全性
 */

// ============================================
// 飞书文档块类型
// ============================================

/**
 * 飞书文本元素
 */
export interface FeishuTextElement {
  text_run?: {
    content: string
    text_element_style?: {
      bold?: boolean
      italic?: boolean
      strikethrough?: boolean
      underline?: boolean
      inline_code?: boolean
      text_color?: number
      background_color?: number
      link?: {
        url: string
      }
    }
  }
  mention_user?: {
    user_id: string
    text_element_style?: Record<string, unknown>
  }
  mention_doc?: {
    token: string
    obj_type: number
    url: string
    title: string
  }
  file?: {
    file_token: string
    source_block_id?: string
  }
  equation?: {
    content: string
  }
  content?: string // 兼容格式
}

/**
 * 飞书文档块类型枚举
 */
export enum FeishuBlockType {
  Page = 1, // 页面
  Text = 2, // 文本
  Heading1 = 3, // 标题1
  Heading2 = 4, // 标题2
  Heading3 = 5, // 标题3
  Heading4 = 6, // 标题4
  Heading5 = 7, // 标题5
  Heading6 = 8, // 标题6
  Heading7 = 9, // 标题7
  Heading8 = 10, // 标题8
  Heading9 = 11, // 标题9
  Bullet = 12, // 无序列表
  Ordered = 13, // 有序列表
  Code = 14, // 代码块
  Quote = 15, // 引用
  Todo = 17, // 待办
  Divider = 21, // 分割线
  Image = 27, // 图片
  Table = 31, // 表格
  TableCell = 32 // 表格单元格
}

/**
 * 飞书文档块文本内容结构
 */
export interface FeishuBlockTextContent {
  elements: FeishuTextElement[]
  style?: {
    align?: number
    done?: boolean // 用于 todo 块
    folded?: boolean
    language?: number // 用于代码块
    wrap?: boolean
  }
}

/**
 * 飞书文档块
 */
export interface FeishuBlock {
  block_id: string
  parent_id?: string | null
  block_type: number
  children?: string[]
  // 各种块类型的内容字段
  page?: FeishuBlockTextContent
  text?: FeishuBlockTextContent
  heading1?: FeishuBlockTextContent
  heading2?: FeishuBlockTextContent
  heading3?: FeishuBlockTextContent
  heading4?: FeishuBlockTextContent
  heading5?: FeishuBlockTextContent
  heading6?: FeishuBlockTextContent
  heading7?: FeishuBlockTextContent
  heading8?: FeishuBlockTextContent
  heading9?: FeishuBlockTextContent
  bullet?: FeishuBlockTextContent
  ordered?: FeishuBlockTextContent
  code?: FeishuBlockTextContent
  quote?: FeishuBlockTextContent
  todo?: FeishuBlockTextContent
  // 特殊块类型
  table?: {
    property?: {
      row_size?: number
      column_size?: number
      column_width?: number[]
      merge_info?: Array<{
        row_span: number
        col_span: number
      }>
    }
    cells?: string[][]
  }
  image?: {
    width?: number
    height?: number
    token?: string
  }
  file?: {
    name?: string
    token?: string
  }
  bitable?: {
    token?: string
    view_type?: number
  }
  diagram?: {
    diagram_type?: number
  }
}

/**
 * 飞书文档块 API 响应
 */
export interface FeishuBlocksResponse {
  items?: FeishuBlock[]
  data?: {
    items?: FeishuBlock[]
  }
  result?: {
    data?: {
      items?: FeishuBlock[]
    }
  }
}

// ============================================
// 飞书搜索相关类型
// ============================================

/**
 * 飞书文档实体
 */
export interface FeishuDocEntity {
  docs_token: string
  doc_type: string
  title: string
  owner_id: string
  create_time?: string
  edit_time?: string
  edit_user_id?: string
  url?: string
  preview?: string
}

/**
 * 飞书文档搜索结果
 */
export interface FeishuDocSearchResult {
  docs_entities?: FeishuDocEntity[]
  result?: {
    data?: {
      docs_entities?: FeishuDocEntity[]
    }
  }
  data?: {
    docs_entities?: FeishuDocEntity[]
  }
  has_more?: boolean
  page_token?: string
}

// ============================================
// 飞书用户相关类型
// ============================================

/**
 * 飞书用户信息
 */
export interface FeishuUserInfo {
  user_id: string
  open_id?: string
  union_id?: string
  name?: string
  en_name?: string
  nickname?: string
  email?: string
  mobile?: string
  avatar?: {
    avatar_72?: string
    avatar_240?: string
    avatar_640?: string
    avatar_origin?: string
  }
  department_ids?: string[]
  tenant_key?: string
}

// ============================================
// 飞书事件相关类型
// ============================================

/**
 * 飞书事件基础结构
 */
export interface FeishuEventHeader {
  event_id: string
  event_type: string
  create_time: string
  token: string
  app_id: string
  tenant_key: string
}

/**
 * 飞书 URL 预览事件
 */
export interface FeishuUrlPreviewEvent {
  header: FeishuEventHeader
  event: {
    context?: {
      open_chat_id?: string
      open_message_id?: string
      preview_token?: string
    }
    url?: string
    user_id?: string
    tenant_key?: string
  }
}

// ============================================
// 类型守卫函数
// ============================================

/**
 * 检查是否为有效的飞书块
 */
export function isFeishuBlock(value: unknown): value is FeishuBlock {
  if (!value || typeof value !== 'object') return false
  const block = value as Record<string, unknown>
  return typeof block.block_id === 'string' && typeof block.block_type === 'number'
}

/**
 * 检查是否为有效的飞书文档实体
 */
export function isFeishuDocEntity(value: unknown): value is FeishuDocEntity {
  if (!value || typeof value !== 'object') return false
  const doc = value as Record<string, unknown>
  return typeof doc.docs_token === 'string' && typeof doc.doc_type === 'string'
}

/**
 * 从飞书块响应中提取块列表
 */
export function extractFeishuBlocks(response: FeishuBlocksResponse): FeishuBlock[] {
  if (response.items) return response.items
  if (response.data?.items) return response.data.items
  if (response.result?.data?.items) return response.result.data.items
  return []
}

/**
 * 从飞书搜索结果中提取文档列表
 */
export function extractFeishuDocs(response: FeishuDocSearchResult): FeishuDocEntity[] {
  if (response.docs_entities) return response.docs_entities
  if (response.data?.docs_entities) return response.data.docs_entities
  if (response.result?.data?.docs_entities) return response.result.data.docs_entities
  return []
}