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
  anchorTag: string
  completeness: "structure-only" | "complete"
  canReplaceCompleteSubtree: boolean
}

export const DOCUMENT_SEARCH_FIELD = {
  MODULE: "module",
  CASE_TITLE: "caseTitle",
  PRECONDITION: "precondition",
  OPERATION: "operation",
  EXPECTED: "expected",
} as const

export type DocumentSearchField = (typeof DOCUMENT_SEARCH_FIELD)[keyof typeof DOCUMENT_SEARCH_FIELD]

export interface DocumentSearchRequest {
  documentId: string
  query: string
  scope?: string[]
  fields?: DocumentSearchField[]
  limit?: number
  cursor?: string
}

export interface DocumentSearchHit {
  modulePath: string[]
  readPath: string[]
  field: DocumentSearchField
}

export interface DocumentSearchResult {
  documentId: string
  revision: number
  hits: DocumentSearchHit[]
  total: number
  returned: number
  nextCursor?: string
  truncated: boolean
}
export type DocumentTransformField = "caseTitle" | "precondition" | "operation" | "expected"

export type DocumentIntentOperation =
  | { op: "append_cases"; to: number; tree: string }
  | {
      op: "replace_text"
      within: number
      fields: DocumentTransformField[]
      find: string
      replace: string
      expect: number
    }
  | { op: "set_node"; at: number; value: string }
  | { op: "delete"; at: number }
  | {
      op: "move"
      at: number
      to: number
      position: "before" | "after" | "last-child"
    }

export interface DocumentEditRequest {
  documentId: string
  anchorTag?: string
  patch?: string
  operations?: DocumentIntentOperation[]
  preview?: boolean
  confirmationToken?: string
  returnView?: {
    view?: DocumentReadView
    path?: string[]
    maxLines?: number
  }
}

export type DocumentNodeType = "module" | "case" | "step"

export interface DocumentEditAffectedNode {
  path: string[]
  type: DocumentNodeType
  text: string
  depth: number
  count: number
}

export interface DocumentEditPreview {
  destructive: boolean
  removedNodes: number
  affectedNodes: DocumentEditAffectedNode[]
  confirmationToken?: string
}

export type DocumentEditDiagnosticCode = "CASE_HAS_NO_STEPS" | "STEP_HAS_NO_EXPECTED_RESULT"

export interface DocumentEditDiagnostic {
  severity: "warning"
  code: DocumentEditDiagnosticCode
  path: string[]
  message: string
  line?: number
  repairPatchHint?: string
}
export interface DocumentEditEffect {
  operation: number
  nodes?: number
  cases?: number
  matches?: number
  removed?: number
}

export interface DocumentEditResult {
  documentId: string
  revision: number
  dirty: boolean
  phase: "preview" | "committed"
  changeSummary: DocumentEditPreview
  confirmationToken?: string
  view?: DocumentReadResult
  effects?: DocumentEditEffect[]
  diagnostics: DocumentEditDiagnostic[]
}

export interface DocumentPortal {
  listDocuments: () => DocumentSummary[]
  read: (request: DocumentReadRequest) => DocumentReadResult
  search: (request: DocumentSearchRequest) => DocumentSearchResult
  edit: (request: DocumentEditRequest) => Promise<DocumentEditResult>
}

export const DOCUMENT_PORTAL_ERROR_CODE = {
  NOT_OPEN: "DOCUMENT_NOT_OPEN",
  NOT_READY: "DOCUMENT_NOT_READY",
  PATH_NOT_FOUND: "DOCUMENT_PATH_NOT_FOUND",
  INVALID_READ_LIMIT: "INVALID_DOCUMENT_READ_LIMIT",
  INVALID_SEARCH_QUERY: "INVALID_DOCUMENT_SEARCH_QUERY",
  INVALID_SEARCH_LIMIT: "INVALID_DOCUMENT_SEARCH_LIMIT",
  INVALID_SEARCH_CURSOR: "INVALID_DOCUMENT_SEARCH_CURSOR",
  INVALID_EDIT_PATCH: "INVALID_DOCUMENT_EDIT_PATCH",
  TRANSFORM_COUNT_MISMATCH: "DOCUMENT_TRANSFORM_COUNT_MISMATCH",
  PREVIEW_REQUIRED: "DOCUMENT_PREVIEW_REQUIRED",
  EDIT_CONFLICT: "DOCUMENT_EDIT_CONFLICT",
  ANCHOR_EXPIRED: "DOCUMENT_ANCHOR_EXPIRED",
  CONSISTENCY: "DOCUMENT_CONSISTENCY_ERROR",
}

export type DocumentPortalErrorCode =
  (typeof DOCUMENT_PORTAL_ERROR_CODE)[keyof typeof DOCUMENT_PORTAL_ERROR_CODE]

export class DocumentPortalError extends Error {
  readonly code: DocumentPortalErrorCode
  constructor(code: DocumentPortalErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "DocumentPortalError"
    this.code = code
  }
}
