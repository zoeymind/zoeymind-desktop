declare const _default: {
  top: {
    renderExpandBtn({
      node,
      btn,
      expandBtnSize,
      translateX,
      translateY,
      width,
      height
    }: {
      node: any
      btn: any
      expandBtnSize: any
      translateX: any
      translateY: any
      width: any
      height: any
    }): void
    renderLine({
      node,
      line,
      top,
      x,
      lineLength,
      height,
      expandBtnSize,
      maxy,
      ctx
    }: {
      node: any
      line: any
      top: any
      x: any
      lineLength: any
      height: any
      expandBtnSize: any
      maxy: any
      ctx: any
    }): void
    computedLeftTopValue({ layerIndex, node, ctx }: { layerIndex: any; node: any; ctx: any }): void
    adjustLeftTopValueBefore({
      node,
      parent,
      ctx,
      layerIndex
    }: {
      node: any
      parent: any
      ctx: any
      layerIndex: any
    }): void
    adjustLeftTopValueAfter({ parent, node, ctx }: { parent: any; node: any; ctx: any }): void
  }
  bottom: {
    renderExpandBtn({
      node,
      btn,
      expandBtnSize,
      translateX,
      translateY,
      width,
      height
    }: {
      node: any
      btn: any
      expandBtnSize: any
      translateX: any
      translateY: any
      width: any
      height: any
    }): void
    renderLine({
      node,
      line,
      top,
      x,
      lineLength,
      height,
      miny,
      ctx
    }: {
      node: any
      line: any
      top: any
      x: any
      lineLength: any
      height: any
      miny: any
      ctx: any
    }): void
    computedLeftTopValue({ layerIndex, node, ctx }: { layerIndex: any; node: any; ctx: any }): void
    adjustLeftTopValueBefore({
      node,
      ctx,
      layerIndex
    }: {
      node: any
      ctx: any
      layerIndex: any
    }): void
    adjustLeftTopValueAfter({ parent, node, ctx }: { parent: any; node: any; ctx: any }): void
  }
}
export default _default
