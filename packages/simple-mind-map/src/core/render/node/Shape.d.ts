export default class Shape {
  node: {
    getShape(): string
    getBorderWidth(): number
    getPaddingVale(): {
      paddingX: number
      paddingY: number
    }
    style: {
      merge(prop: string, root?: boolean): unknown
    }
    shapePadding: {
      paddingX: number
      paddingY: number
    }
    width: number
    height: number
    mindMap: Record<string, unknown>
    [key: string]: unknown
  }
  mindMap: {
    extendShapeList: {
      name: string
      createShape(node: unknown): unknown
      getPadding(opts: Record<string, unknown>):
        | {
            paddingX: number
            paddingY: number
          }
        | undefined
    }[]
    opt: Record<string, unknown>
    draw: Record<string, unknown>
    [key: string]: unknown
  }
  constructor(node: any)
  getShapePadding(
    width: any,
    height: any,
    paddingX: any,
    paddingY: any
  ): {
    paddingX: number
    paddingY: number
  }
  getShapeFromExtendList(shape: any): {
    name: string
    createShape(node: unknown): unknown
    getPadding(opts: Record<string, unknown>):
      | {
          paddingX: number
          paddingY: number
        }
      | undefined
  }
  createShape(): any
  getNodeSize(): {
    width: number
    height: number
  }
  createPath(pathStr: any): import('@svgdotjs/svg.js').Element
  createPolygon(points: any): import('@svgdotjs/svg.js').Element
  createRect(): import('@svgdotjs/svg.js').Element
  createDiamond(): import('@svgdotjs/svg.js').Element
  createParallelogram(): import('@svgdotjs/svg.js').Element
  createRoundedRectangle(): import('@svgdotjs/svg.js').Element
  createOctagonalRectangle(): import('@svgdotjs/svg.js').Element
  createOuterTriangularRectangle(): import('@svgdotjs/svg.js').Element
  createInnerTriangularRectangle(): import('@svgdotjs/svg.js').Element
  createEllipse(): import('@svgdotjs/svg.js').Element
  createCircle(): import('@svgdotjs/svg.js').Element
}
export declare const shapeList: (
  | {
      name: 'rectangle'
      label: string
    }
  | {
      name: 'diamond'
      label: string
    }
  | {
      name: 'parallelogram'
      label: string
    }
  | {
      name: 'roundedRectangle'
      label: string
    }
  | {
      name: 'octagonalRectangle'
      label: string
    }
  | {
      name: 'outerTriangularRectangle'
      label: string
    }
  | {
      name: 'innerTriangularRectangle'
      label: string
    }
  | {
      name: 'ellipse'
      label: string
    }
  | {
      name: 'circle'
      label: string
    }
)[]
