declare function createText(el: any, cur: any, range: any): any
declare function showEditTextBox(g: any): void
declare function setIsShowTextEdit(val: any): void
declare function removeTextEditEl(): void
declare function onScale(): void
declare function updateTextEditBoxPos(g: any): void
declare function hideEditTextBox(): void
declare function renderText(str: any, rect: any, textNode: any, node: any, range: any): void
declare function styleTextShape(shape: any, style: any): void
declare function styleText(textNode: any, style: any): void
declare function getText(node: any): any
declare const _default: {
  getText: typeof getText
  createText: typeof createText
  styleTextShape: typeof styleTextShape
  styleText: typeof styleText
  onScale: typeof onScale
  showEditTextBox: typeof showEditTextBox
  setIsShowTextEdit: typeof setIsShowTextEdit
  removeTextEditEl: typeof removeTextEditEl
  hideEditTextBox: typeof hideEditTextBox
  updateTextEditBoxPos: typeof updateTextEditBoxPos
  renderText: typeof renderText
}
export default _default
