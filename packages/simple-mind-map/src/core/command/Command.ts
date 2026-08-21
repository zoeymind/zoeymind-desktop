// @ts-nocheck — vendored engine source
import {
  copyRenderTree,
  simpleDeepClone,
  throttle,
  isSameObject,
  transformTreeDataToObject,
  countNodeTree
} from '../../utils'
import { ERROR_TYPES } from '../../constants/constant'
import pkg from '../../../package.json'
import type MindMap from '../../index'

//  命令类
class Command {
  declare opt: { mindMap: import('../..').default; [key: string]: unknown }
  declare mindMap: import('../..').default
  declare commands: Record<string, Array<(...args: unknown[]) => void>>
  declare history: string[]
  declare activeHistoryIndex: number
  declare originAddHistory: (...args: unknown[]) => void
  declare isPause: boolean

  //  构造函数
  constructor(opt = {} as { mindMap: MindMap; [key: string]: unknown }) {
    this.opt = opt
    this.mindMap = opt.mindMap
    this.commands = {}
    this.history = [] // 字符串形式存储
    this.activeHistoryIndex = 0
    // 注册快捷键
    this.registerShortcutKeys()
    this.originAddHistory = this.addHistory.bind(this)
    this.addHistory = throttle(this.addHistory, this.mindMap.opt.addHistoryTime as number, this)
    // 是否暂停收集历史数据
    this.isPause = false
  }

  // 暂停收集历史数据
  pause() {
    this.isPause = true
  }

  // 恢复收集历史数据
  recovery() {
    this.isPause = false
  }

  // 立即提交当前渲染树，供已自行管理批处理边界的调用方使用。
  // 不经过节流包装，避免与相邻用户命令共用或丢失撤销点。
  commitHistoryNow() {
    this.originAddHistory()
  }

  // 恢复当前历史检查点，不改变撤销栈。
  // 仅用于事务逆操作无法完成时，保证实时文档回到批处理前状态。
  restoreCurrentHistory() {
    const dataStr = this.history[this.activeHistoryIndex]
    if (!dataStr) throw new Error('No history checkpoint is available for restoration')
    const data = JSON.parse(dataStr)
    this.mindMap.renderer.setData(data)
    this.mindMap.render()
    this.mindMap.emit('data_change', data)
  }

  //  清空历史数据
  clearHistory() {
    this.history = []
    this.activeHistoryIndex = 0
    this.mindMap.emit('back_forward', 0, 0)
  }

  //  注册快捷键
  registerShortcutKeys() {
    this.mindMap.keyCommand.addShortcut('Control+z', () => {
      this.mindMap.execCommand('BACK')
    })
    this.mindMap.keyCommand.addShortcut('Control+y', () => {
      this.mindMap.execCommand('FORWARD')
    })
  }

  // 会增加节点数量的命令列表
  static NODE_ADD_COMMANDS = [
    'INSERT_NODE',
    'INSERT_MULTI_NODE',
    'INSERT_CHILD_NODE',
    'INSERT_MULTI_CHILD_NODE',
    'INSERT_PARENT_NODE',
    'PASTE_NODE'
  ]

  // 获取当前节点总数
  getNodeCount() {
    const renderTree = this.mindMap.renderer.renderTree
    return countNodeTree(renderTree)
  }

  //  执行命令
  exec(name, ...args) {
    if (this.commands[name]) {
      // 节点数量限制检查
      const maxCount = this.mindMap.opt.maxNodeCount as number
      if (maxCount > 0 && Command.NODE_ADD_COMMANDS.includes(name)) {
        const currentCount = this.getNodeCount()
        if (currentCount >= maxCount) {
          this.mindMap.emit('node_limit_exceeded', {
            maxCount,
            currentCount
          })
          return
        }
      }
      this.commands[name].forEach(fn => {
        fn(...args)
      })
      this.mindMap.emit('afterExecCommand', name, ...args)
      if (['BACK', 'FORWARD', 'SET_NODE_ACTIVE', 'CLEAR_ACTIVE_NODE'].includes(name)) {
        return
      }
      this.addHistory()
    }
  }

  //  添加命令
  add(name, fn) {
    if (this.commands[name]) {
      this.commands[name].push(fn)
    } else {
      this.commands[name] = [fn]
    }
  }

  //  移除命令
  remove(name, fn) {
    if (!this.commands[name]) {
      return
    }
    if (!fn) {
      this.commands[name] = []
      delete this.commands[name]
    } else {
      let index = this.commands[name].findIndex(item => {
        return item === fn
      })
      if (index !== -1) {
        this.commands[name].splice(index, 1)
      }
    }
  }

  //  添加回退数据
  addHistory() {
    if ((this.mindMap.opt.readonly as boolean) || this.isPause) {
      return
    }
    this.mindMap.emit('beforeAddHistory')
    const lastDataStr = this.history.length > 0 ? this.history[this.activeHistoryIndex] : null
    const data = this.getCopyData()
    const dataStr = JSON.stringify(data)
    // 此次数据和上次一样则不重复添加
    if (lastDataStr && lastDataStr === dataStr) {
      return
    }
    this.emitDataUpdatesEvent(lastDataStr, dataStr)
    // 删除当前历史指针后面的数据
    this.history = this.history.slice(0, this.activeHistoryIndex + 1)
    this.history.push(dataStr)
    // 历史记录数超过最大数量
    if (this.history.length > (this.mindMap.opt.maxHistoryCount as number)) {
      this.history.shift()
    }
    this.activeHistoryIndex = this.history.length - 1
    this.mindMap.emit('data_change', data)
    this.mindMap.emit('back_forward', this.activeHistoryIndex, this.history.length)
  }

  //  回退
  back(step = 1) {
    if (this.mindMap.opt.readonly as boolean) {
      return
    }
    if (this.activeHistoryIndex - step >= 0) {
      const lastDataStr = this.history[this.activeHistoryIndex]
      this.activeHistoryIndex -= step
      this.mindMap.emit('back_forward', this.activeHistoryIndex, this.history.length)
      const dataStr = this.history[this.activeHistoryIndex]
      const data = JSON.parse(dataStr)
      this.emitDataUpdatesEvent(lastDataStr, dataStr)
      return data
    }
  }

  //  前进
  forward(step = 1) {
    if (this.mindMap.opt.readonly as boolean) {
      return
    }
    let len = this.history.length
    if (this.activeHistoryIndex + step <= len - 1) {
      const lastDataStr = this.history[this.activeHistoryIndex]
      this.activeHistoryIndex += step
      this.mindMap.emit('back_forward', this.activeHistoryIndex, this.history.length)
      const dataStr = this.history[this.activeHistoryIndex]
      const data = JSON.parse(dataStr)
      this.emitDataUpdatesEvent(lastDataStr, dataStr)
      return data
    }
  }

  //  获取渲染树数据副本
  getCopyData() {
    if (!this.mindMap.renderer.renderTree) return null
    const res = copyRenderTree({}, this.mindMap.renderer.renderTree, true)
    res.smmVersion = pkg.version
    return res
  }

  // 移除节点数据中的uid
  removeDataUid(data) {
    data = simpleDeepClone(data)
    let walk = root => {
      delete root.data.uid
      if (root.children && root.children.length > 0) {
        root.children.forEach(item => {
          walk(item)
        })
      }
    }
    walk(data)
    return data
  }

  // 派发思维导图更新明细事件
  emitDataUpdatesEvent(lastDataStr, dataStr) {
    try {
      // 如果data_change_detail没有监听者，那么不进行计算，节省性能
      const eventName = 'data_change_detail'
      const count = this.mindMap.event.listenerCount(eventName)
      if (count <= 0 || !lastDataStr || !dataStr) {
        return
      }

      const lastData = JSON.parse(lastDataStr)
      const data = JSON.parse(dataStr)
      const lastDataObj = simpleDeepClone(transformTreeDataToObject(lastData))
      const dataObj = simpleDeepClone(transformTreeDataToObject(data))
      const res = []
      const walkReplace = (root, obj) => {
        if (root.children && root.children.length > 0) {
          root.children.forEach((childUid, index) => {
            root.children[index] =
              typeof childUid === 'string' ? obj[childUid] : obj[childUid.data.uid]
            walkReplace(root.children[index], obj)
          })
        }
        return root
      }
      // 找出新增的或修改的
      Object.keys(dataObj).forEach(uid => {
        // 新增的或已经存在的，如果数据发生了改变
        if (!lastDataObj[uid]) {
          res.push({
            action: 'create',
            data: walkReplace(dataObj[uid], dataObj)
          })
        } else if (!isSameObject(lastDataObj[uid], dataObj[uid])) {
          res.push({
            action: 'update',
            oldData: walkReplace(lastDataObj[uid], lastDataObj),
            data: walkReplace(dataObj[uid], dataObj)
          })
        }
      })
      // 找出删除的
      Object.keys(lastDataObj).forEach(uid => {
        if (!dataObj[uid]) {
          res.push({
            action: 'delete',
            data: walkReplace(lastDataObj[uid], lastDataObj)
          })
        }
      })
      this.mindMap.emit(eventName, res)
    } catch (error) {
      this.mindMap.opt.errorHandler(ERROR_TYPES.DATA_CHANGE_DETAIL_EVENT_ERROR, error)
    }
  }
}

export default Command