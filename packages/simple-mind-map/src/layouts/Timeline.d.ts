import Base from './Base'
declare class Timeline extends Base {
  layout: string
  constructor(opt: {}, layout: any)
  doLayout(callback: any): void
  computedBaseValue(): void
  computedLeftTopValue(): void
  adjustLeftTopValue(): void
  getNodeAreaHeight(node: any): number
  updateBrothersLeft(node: any): void
  updateBrothersTop(node: any, addHeight: any): void
  renderLine(node: any, lines: any, style: any): any[]
  renderExpandBtn(node: any, btn: any): void
  renderGeneralization(list: any): void
  renderExpandBtnRect(rect: any, expandBtnSize: any, width: any, height: any, node: any): void
}
export default Timeline
