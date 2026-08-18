export declare const getAssociativeLineTargetIndex: (node: any, toNode: any) => any
export declare const computeCubicBezierPathPoints: (
  x1: any,
  y1: any,
  x2: any,
  y2: any
) => {
  x: any
  y: any
}[]
export declare const joinCubicBezierPath: (
  startPoint: any,
  endPoint: any,
  point1: any,
  point2: any
) => string
export declare const cubicBezierPath: (x1: any, y1: any, x2: any, y2: any) => string
export declare const calcPoint: (
  node: any,
  e: any
) => {
  x: any
  y: any
  dir: string
  range: number
}
export declare const getNodePoint: (
  node: any,
  dir?: string,
  range?: number,
  e?: any
) =>
  | {
      x: any
      y: any
      dir: string
      range: number
    }
  | {
      x: any
      y: any
      dir: string
    }
export declare const computeNodePoints: (
  fromNode: any,
  toNode: any
) => {
  x: any
  y: any
  dir: string
}[]
export declare const getNodeLinePath: (
  startPoint: any,
  endPoint: any,
  node: any,
  toNode: any
) => {
  path: string
  controlPoints: any[]
}
export declare const getDefaultControlPointOffsets: (
  startPoint: any,
  endPoint: any
) => {
  x: number
  y: number
}[]
