export declare const CONSTANTS: {
  readonly CHANGE_THEME: 'changeTheme'
  readonly CHANGE_LAYOUT: 'changeLayout'
  readonly MODE: {
    readonly READONLY: 'readonly'
    readonly EDIT: 'edit'
  }
  readonly LAYOUT: {
    readonly LOGICAL_STRUCTURE: 'logicalStructure'
    readonly LOGICAL_STRUCTURE_LEFT: 'logicalStructureLeft'
    readonly MIND_MAP: 'mindMap'
    readonly ORGANIZATION_STRUCTURE: 'organizationStructure'
    readonly CATALOG_ORGANIZATION: 'catalogOrganization'
    readonly TIMELINE: 'timeline'
    readonly TIMELINE2: 'timeline2'
    readonly FISHBONE: 'fishbone'
    readonly FISHBONE2: 'fishbone2'
    readonly RIGHT_FISHBONE: 'rightFishbone'
    readonly RIGHT_FISHBONE2: 'rightFishbone2'
    readonly VERTICAL_TIMELINE: 'verticalTimeline'
    readonly VERTICAL_TIMELINE2: 'verticalTimeline2'
    readonly VERTICAL_TIMELINE3: 'verticalTimeline3'
  }
  readonly DIR: {
    readonly UP: 'up'
    readonly LEFT: 'left'
    readonly DOWN: 'down'
    readonly RIGHT: 'right'
  }
  readonly KEY_DIR: {
    readonly LEFT: 'Left'
    readonly UP: 'Up'
    readonly RIGHT: 'Right'
    readonly DOWN: 'Down'
  }
  readonly SHAPE: {
    readonly RECTANGLE: 'rectangle'
    readonly DIAMOND: 'diamond'
    readonly PARALLELOGRAM: 'parallelogram'
    readonly ROUNDED_RECTANGLE: 'roundedRectangle'
    readonly OCTAGONAL_RECTANGLE: 'octagonalRectangle'
    readonly OUTER_TRIANGULAR_RECTANGLE: 'outerTriangularRectangle'
    readonly INNER_TRIANGULAR_RECTANGLE: 'innerTriangularRectangle'
    readonly ELLIPSE: 'ellipse'
    readonly CIRCLE: 'circle'
  }
  readonly MOUSE_WHEEL_ACTION: {
    readonly ZOOM: 'zoom'
    readonly MOVE: 'move'
  }
  readonly INIT_ROOT_NODE_POSITION: {
    readonly LEFT: 'left'
    readonly TOP: 'top'
    readonly RIGHT: 'right'
    readonly BOTTOM: 'bottom'
    readonly CENTER: 'center'
  }
  readonly LAYOUT_GROW_DIR: {
    readonly LEFT: 'left'
    readonly TOP: 'top'
    readonly RIGHT: 'right'
    readonly BOTTOM: 'bottom'
  }
  readonly PASTE_TYPE: {
    readonly CLIP_BOARD: 'clipBoard'
    readonly CANVAS: 'canvas'
  }
  readonly SCROLL_BAR_DIR: {
    readonly VERTICAL: 'vertical'
    readonly HORIZONTAL: 'horizontal'
  }
  readonly CREATE_NEW_NODE_BEHAVIOR: {
    readonly DEFAULT: 'default'
    readonly NOT_ACTIVE: 'notActive'
    readonly ACTIVE_ONLY: 'activeOnly'
  }
  readonly TAG_PLACEMENT: {
    readonly RIGHT: 'right'
    readonly BOTTOM: 'bottom'
  }
  readonly IMG_PLACEMENT: {
    readonly LEFT: 'left'
    readonly TOP: 'top'
    readonly RIGHT: 'right'
    readonly BOTTOM: 'bottom'
  }
}
export declare const initRootNodePositionMap: Record<string, number>
export interface LayoutItem {
  name: string
  value: string
}
export declare const layoutList: LayoutItem[]
export declare const layoutValueList: string[]
export declare const nodeDataNoStylePropList: string[]
export declare const ERROR_TYPES: {
  readonly READ_CLIPBOARD_ERROR: 'read_clipboard_error'
  readonly PARSE_PASTE_DATA_ERROR: 'parse_paste_data_error'
  readonly CUSTOM_HANDLE_CLIPBOARD_TEXT_ERROR: 'custom_handle_clipboard_text_error'
  readonly LOAD_CLIPBOARD_IMAGE_ERROR: 'load_clipboard_image_error'
  readonly BEFORE_TEXT_EDIT_ERROR: 'before_text_edit_error'
  readonly EXPORT_ERROR: 'export_error'
  readonly EXPORT_LOAD_IMAGE_ERROR: 'export_load_image_error'
  readonly DATA_CHANGE_DETAIL_EVENT_ERROR: 'data_change_detail_event_error'
}
export declare const cssContent: string
export declare const selfCloseTagList: string[]
export declare const noneRichTextNodeLineHeight: number
export declare const richTextSupportStyleList: string[]
