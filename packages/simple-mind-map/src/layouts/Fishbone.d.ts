import Base from './Base'
declare class Fishbone extends Base {
  layout: string
  indent: number
  childIndent: number
  fishTail: any
  maxx: number
  headRatio: number
  tailRatio: number
  paddingXRatio: number
  fishHeadPathStr: string
  fishTailPathStr: string
  constructor(opt: {}, layout: any)
  nodeIsRemoveAllLines(node: any): any
  isFishbone2(): boolean
  bindEvent(): void
  unBindEvent(): void
  extendShape(): void
  doLayout(callback: any): void
  addFishTail(): void
  onCheckUpdateFishTail(name: any, node: any, data: any): void
  styleFishTail(): void
  removeFishTail(): void
  updateFishTailPosition(): void
  computedBaseValue(): void
  computedLeftTopValue(): void
  adjustLeftTopValue(): void
  getNodeAreaHeight(node: any): number
  updateBrothersLeft(node: any): void
  updateBrothersTop(node: any, addHeight: any): void
  checkIsTop(node: any): boolean
  renderLine(node: any, lines: any, style: any): any[]
  renderExpandBtn(node: any, btn: any): void
  renderGeneralization(list: any): void
  renderExpandBtnRect(rect: any, expandBtnSize: any, width: any, height: any, node: any): void
  beforeChange(): void
}
export default Fishbone
