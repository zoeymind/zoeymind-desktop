// @ts-nocheck — vendored engine source
import { Rect, G, Text } from '@svgdotjs/svg.js'
import { generateColorByContent } from '../../../utils/index'

// 协同相关功能

// 创建容器
function createUserListNode() {
  // 如果没有注册协作插件，那么需要创建
  if (!this.mindMap.cooperate) return
  this._userHighlightGroup = new G()
  this.group.add(this._userHighlightGroup)
  this._userListGroup = new G()
  this.group.add(this._userListGroup)
}

const truncateLabel = (label, maxLength = 3) => {
  if (!label) return '访客'
  return label.length > maxLength ? label.slice(0, maxLength) + '\u2026' : label
}

// 创建协作名称标签
function createTextAvatar(item) {
  const { avatarSize, fontSize, chipWidth = 56 } = this.mindMap.opt.cooperateStyle
  const g = new G()
  const baseName = item.isMore ? item.name : item.name || item.id
  const label = item.isMore ? '...' : truncateLabel(baseName)
  const rect = new Rect().size(chipWidth, avatarSize)
  rect.fill({ color: item.color || generateColorByContent(label) })
  rect.stroke({ color: 'none' })

  const textLabel = label
  const text = new Text().text(textLabel).fill({ color: '#fff' })
  ;(text as unknown as { css(style: Record<string, unknown>): unknown }).css({
    'font-size': fontSize + 'px',
    'font-weight': 500
  })
  g.add(rect)
  g.add(text)
  ;(text as unknown as { attr(attrs: Record<string, unknown>): void }).attr({
    'text-anchor': 'middle',
    'dominant-baseline': 'middle'
  })
  ;(text as unknown as { center(x: number, y: number): void }).center(chipWidth / 2, avatarSize / 2)
  return g
}

// 更新渲染
function updateUserListNode() {
  if (!this._userListGroup) return
  const { avatarSize, chipWidth = 48, chipGap = 4 } = this.mindMap.opt.cooperateStyle
  this._userListGroup.clear()
  const length = this.userList.length
  const MAX_CHIPS = 4
  const list =
    length > MAX_CHIPS
      ? [
          ...this.userList.slice(0, MAX_CHIPS - 1),
          { isMore: true, name: '...', color: 'rgba(0,0,0,0.35)' }
        ]
      : [...this.userList]
  const stepWidth = chipWidth + chipGap
  const totalWidth = stepWidth * (list.length - 1)
  this.updateUserHighlights()
  list.forEach((item, index) => {
    const node = this.createTextAvatar(item)
    node.on('click', e => {
      this.mindMap.emit('node_cooperate_avatar_click', item, this, node, e)
    })
    node.on('mouseenter', e => {
      this.mindMap.emit('node_cooperate_avatar_mouseenter', item, this, node, e)
    })
    node.on('mouseleave', e => {
      this.mindMap.emit('node_cooperate_avatar_mouseleave', item, this, node, e)
    })
    node.x(index * stepWidth - totalWidth / 2).cy(-avatarSize / 2)
    this._userListGroup.add(node)
  })
}

function updateUserHighlights() {
  if (!this._userHighlightGroup || !this.shapeNode) return
  this._userHighlightGroup.clear()
  if (this.userList.length === 0) return
  const limit = Math.min(this.userList.length, 4)
  for (let i = 0; i < limit; i++) {
    const user = this.userList[i]
    const highlight = this.shapeNode.clone()
    highlight.fill({ opacity: 0 })
    highlight.stroke({
      color: user.color || generateColorByContent(user.name || user.id),
      width: 2,
      opacity: 1
    })
    // 允许点击事件穿透，不阻止下层元素（如评论标签）的点击
    highlight.css('pointer-events', 'none')
    this._userHighlightGroup.add(highlight)
    highlight.front()
  }
  // 高亮组设置 pointer-events: none，让点击事件穿透
  this._userHighlightGroup.css('pointer-events', 'none')
  this._userHighlightGroup.front()
  if (this._userListGroup) {
    this._userListGroup.front()
  }
}

// 添加用户
function addUser(userInfo) {
  if (
    this.userList.find(item => {
      return item.id == userInfo.id
    })
  )
    return
  this.userList.push(userInfo)
  this.updateUserListNode()
}

// 移除用户
function removeUser(userInfo) {
  const index = this.userList.findIndex(item => {
    return item.id == userInfo.id
  })
  if (index === -1) return
  this.userList.splice(index, 1)
  this.updateUserListNode()
}

// 清空用户
function emptyUser() {
  this.userList = []
  if (this._userHighlightGroup) {
    this._userHighlightGroup.clear()
  }
  this.updateUserListNode()
}

export default {
  createUserListNode,
  updateUserListNode,
  updateUserHighlights,
  createTextAvatar,
  addUser,
  removeUser,
  emptyUser
}