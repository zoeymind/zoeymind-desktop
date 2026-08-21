export const DOCUMENT_READ_VIEW = {
  OUTLINE: "outline",
  SUBTREE: "subtree",
} as const

export type DocumentReadView = (typeof DOCUMENT_READ_VIEW)[keyof typeof DOCUMENT_READ_VIEW]

export interface DocumentSummary {
  documentId: string
  title: string
  active: boolean
  revision: number
  ready: boolean
  dirty: boolean
}

export interface DocumentReadRequest {
  documentId: string
  view: DocumentReadView
  path?: string[]
  maxLines?: number
}

export interface DocumentReadResult {
  documentId: string
  title: string
  revision: number
  view: DocumentReadView
  path?: string[]
  content: string
  lineCount: number
  truncated: boolean
}

export interface DocumentPortal {
  listDocuments: () => DocumentSummary[]
  read: (request: DocumentReadRequest) => DocumentReadResult
}

export const DOCUMENT_PORTAL_ERROR_CODE = {
  NOT_OPEN: "DOCUMENT_NOT_OPEN",
  NOT_READY: "DOCUMENT_NOT_READY",
  PATH_NOT_FOUND: "DOCUMENT_PATH_NOT_FOUND",
  INVALID_READ_LIMIT: "INVALID_DOCUMENT_READ_LIMIT",
} as const

export type DocumentPortalErrorCode =
  (typeof DOCUMENT_PORTAL_ERROR_CODE)[keyof typeof DOCUMENT_PORTAL_ERROR_CODE]

export class DocumentPortalError extends Error {
  readonly code: DocumentPortalErrorCode

  constructor(code: DocumentPortalErrorCode, message: string) {
    super(message)
    this.name = "DocumentPortalError"
    this.code = code
  }
}
