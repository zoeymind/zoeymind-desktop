declare function createText(data: any): any
declare function showEditTextBox(g: any): void
declare function setIsShowTextEdit(val: any): void
declare function removeTextEditEl(): void
declare function onScale(): void
declare function updateTextEditBoxPos(g: any): void
declare function hideEditTextBox(): void
declare function getText(node: any, toNode: any): any
declare function renderText(str: any, path: any, text: any, node: any, toNode: any): void
declare function styleText(textNode: any, node: any, toNode: any): void
declare function updateTextPos(path: any, text: any): void
declare const _default: {
  getText: typeof getText
  createText: typeof createText
  styleText: typeof styleText
  onScale: typeof onScale
  showEditTextBox: typeof showEditTextBox
  setIsShowTextEdit: typeof setIsShowTextEdit
  removeTextEditEl: typeof removeTextEditEl
  hideEditTextBox: typeof hideEditTextBox
  updateTextEditBoxPos: typeof updateTextEditBoxPos
  renderText: typeof renderText
  updateTextPos: typeof updateTextPos
}
export default _default
