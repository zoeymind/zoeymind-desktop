import { logger } from "@zoeymind/logger"
import { useEffect } from "react"
import { NodeManager } from "@/products/mind/features/mindmap/components/managers/NodeManager"
import { useUIStore } from "@/products/mind/stores"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"

export function useShortcutManager() {
  const { mindMap } = useMindMapStore()
  const { setSearchInitialText } = useUIStore()
  useEffect(() => {
    if (!mindMap) return
    const nodeManager = new NodeManager(mindMap)

    // 检查是否在输入元素中
    const isInInputElement = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Element)) return false

      const tagName = target.tagName.toLowerCase()
      const isInput = tagName === "input" || tagName === "textarea"
      const isContentEditable = target.getAttribute("contenteditable") === "true"

      return isInput || isContentEditable
    }

    // 统一处理所有快捷键
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果在输入元素中，不处理快捷键（除了Ctrl+F搜索）
      if (isInInputElement(e.target)) {
        // 只允许 Ctrl+F 在输入框中工作
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
          e.preventDefault()
          logger.info("触发 Ctrl + F 搜索功能")
          const selectedText = window.getSelection()?.toString().trim() || ""
          logger.info("当前选中文本:", selectedText)
          setSearchInitialText(selectedText || "")
        }
        return
      }

      // Ctrl + F - 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault()
        logger.info("触发 Ctrl + F 搜索功能")

        // 获取当前选中的文本
        const selectedText = window.getSelection()?.toString().trim() || ""
        logger.info("当前选中文本:", selectedText)

        setSearchInitialText(selectedText || "")
        return
      }

      // ~ - 设置模块图标 (sign_2)
      if (e.key === "·" || e.key === "`") {
        e.preventDefault()
        logger.info("触发 ~ 设置模块图标")
        const activeNodes = mindMap.renderer.activeNodeList || []
        if (activeNodes.length > 0) {
          activeNodes.forEach(node => {
            mindMap.execCommand("SET_NODE_ICON", node, ["sign_2"])
          })
        }
        return
      }

      // 1 - 设置优先级1测试用例图标
      if (e.key === "1") {
        e.preventDefault()
        logger.info("触发 1 设置优先级1测试用例图标")
        const activeNodes = mindMap.renderer.activeNodeList || []
        if (activeNodes.length > 0) {
          activeNodes.forEach(node => {
            mindMap.execCommand("SET_NODE_ICON", node, ["priority_1"])
          })
        }
        return
      }

      // 2 - 设置优先级2测试用例图标
      if (e.key === "2") {
        e.preventDefault()
        logger.info("触发 2 设置优先级2测试用例图标")
        const activeNodes = mindMap.renderer.activeNodeList || []
        if (activeNodes.length > 0) {
          activeNodes.forEach(node => {
            mindMap.execCommand("SET_NODE_ICON", node, ["priority_2"])
          })
        }
        return
      }

      // 3 - 设置优先级3测试用例图标
      if (e.key === "3") {
        e.preventDefault()
        logger.info("触发 3 设置优先级3测试用例图标")
        const activeNodes = mindMap.renderer.activeNodeList || []
        if (activeNodes.length > 0) {
          activeNodes.forEach(node => {
            mindMap.execCommand("SET_NODE_ICON", node, ["priority_3"])
          })
        }
        return
      }

      // Ctrl + D (68) - 复制节点
      if (e.ctrlKey && e.keyCode === 68) {
        logger.info("阻止默认 Ctrl + D 行为")
        e.preventDefault()
        logger.info("手动触发 Ctrl + D 复制功能")
        nodeManager.duplicateNode()
        return
      }

      // Alt + / - 展开/收起节点
      if (e.altKey && e.keyCode === 191) {
        // 191 是 / 的键码
        logger.info("触发 Alt + / 展开/收起功能")
        const activeNode = nodeManager.getActiveNode()
        if (activeNode) {
          nodeManager.toggleFold(activeNode)
        }
        return
      }
    }

    // 添加事件监听
    try {
      window.addEventListener("keydown", handleKeyDown)
      logger.info("成功添加快捷键事件监听")
    } catch (error) {
      logger.error("添加事件监听失败:", error)
    }

    return () => {
      // 移除事件监听器
      try {
        window.removeEventListener("keydown", handleKeyDown)
        logger.info("成功移除快捷键事件监听")
      } catch (error) {
        logger.warn("移除事件监听器失败:", error)
      }
    }
  }, [mindMap, setSearchInitialText])
}
