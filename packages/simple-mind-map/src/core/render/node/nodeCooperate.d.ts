import { G } from '@svgdotjs/svg.js'
declare function createUserListNode(): void
declare function createTextAvatar(item: any): G
declare function updateUserListNode(): void
declare function updateUserHighlights(): void
declare function addUser(userInfo: any): void
declare function removeUser(userInfo: any): void
declare function emptyUser(): void
declare const _default: {
  createUserListNode: typeof createUserListNode
  updateUserListNode: typeof updateUserListNode
  updateUserHighlights: typeof updateUserHighlights
  createTextAvatar: typeof createTextAvatar
  addUser: typeof addUser
  removeUser: typeof removeUser
  emptyUser: typeof emptyUser
}
export default _default
