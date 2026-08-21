// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
import { logger } from "@zoeymind/logger"
import { AddModuleSchema } from "@zoeymind/shared"
import type { Tool } from "../../../ai-chat/tools/types"
import type { MindMapNode } from "simple-mind-map"
import { findNodeByUid } from "./mindmap-node-tree"
import { createUUID } from "@/shared/app-shared"

const normalizeArgs = (rawArgs: unknown) => {
  if (!rawArgs || typeof rawArgs !== "object") {
    return rawArgs
  }

  const args = rawArgs as Record<string, unknown>
  const normalized = { ...args }

  if (normalized.parentModuleId === null || normalized.parentModuleId === "") {
    delete normalized.parentModuleId
  }

  return normalized
}

export const addModuleTool: Tool = {
  name: "add_module",
  label: "添加模块",
  description:
    "批量添加一个或多个新的测试模块。模块是用例的容器，可以嵌套。**建议一次性添加所有模块**，而不是逐个添加，可以提高效率。",
  parameters: {
    parentModuleId: {
      type: "string",
      description: "父模块ID。如果不指定，则添加到根节点下",
      required: false,
    },
    modules: {
      type: "array",
      description: "要添加的模块列表，每个模块只包含 name（模块名称）字段。模块名称应该简约清晰",
      required: true,
    },
  },
  handler: async (args, context) => {
    const normalizedArgs = normalizeArgs(args)
    const parseResult = AddModuleSchema.safeParse(normalizedArgs)
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]
      return {
        success: false,
        error:
          firstError.message +
          (firstError.path.length > 0 ? ` (路径: ${firstError.path.join(".")})` : ""),
      }
    }

    const { parentModuleId, modules } = parseResult.data
    const { mindMap } = context

    if (!mindMap) {
      return {
        success: false,
        error: "思维导图未初始化",
      }
    }

    try {
      let parentNode: MindMapNode | undefined
      if (parentModuleId) {
        // 先在数据层校验模块是否存在及其子节点结构（包括折叠节点）
        const parentNodeData = findNodeByUid(mindMap, parentModuleId)
        if (!parentNodeData) {
          return {
            success: false,
            error: `未找到父模块：${parentModuleId}`,
          }
        }

        // 校验：有用例的模块下不能再建子模块
        if (parentNodeData.children && parentNodeData.children.length > 0) {
          const caseCount = parentNodeData.children.filter(
            (child: { data?: { icon?: string[] } }) =>
              child.data?.icon?.some((i: string) => i.startsWith("priority_"))
          ).length
          if (caseCount > 0) {
            const shortParent = context.idMapper.shorten(parentModuleId)
            return {
              success: false,
              error: `该模块(M:${shortParent})下已有${caseCount}个用例，不能再添加子模块。请选择其他模块，或先将现有用例移到子模块中。`,
            }
          }
        }

        // GO_TARGET_NODE 内部已处理：展开折叠路径 → 渲染 → 定位 → 激活 → 回调
        // 回调参数即为渲染层节点实例，无需再次 findNodeByUid
        parentNode = await new Promise<MindMapNode>((resolve, reject) => {
          mindMap.execCommand("GO_TARGET_NODE", parentModuleId, (node: MindMapNode | null) => {
            if (node) {
              resolve(node)
            } else {
              reject(new Error(`无法定位到父模块：${parentModuleId}`))
            }
          })
        })

        if (!parentNode) {
          return {
            success: false,
            error: `无法获取父模块实例：${parentModuleId}`,
          }
        }
      } else {
        parentNode = mindMap.renderer.root as MindMapNode | undefined
      }

      // 在插入前生成稳定 UID；结果绑定只依赖本次输入，不读取全局 active selection。
      const results = modules.map((module, index) => ({
        moduleId: createUUID(),
        moduleName: module.name || `模块${index + 1}`,
      }))
      const childrenData = results.map(result => ({
        data: {
          text: result.moduleName,
          icon: ["sign_2"],
          uid: result.moduleId,
        },
        children: [],
      }))

      try {
        // 使用 INSERT_MULTI_CHILD_NODE 批量添加模块（与 add-cases 一致）
        mindMap.execCommand("INSERT_MULTI_CHILD_NODE", [parentNode], childrenData)

        const { idMapper } = context
        const ztdlLines = results.map(
          result => `M:${idMapper.shorten(result.moduleId)} ${result.moduleName}`
        )
        return {
          success: true,
          data: results,
          ztdl: `+${results.length}模块:\n${ztdlLines.join("\n")}`,
        }
      } catch (error) {
        logger.error("添加模块失败", { error })
        return {
          success: false,
          error: error instanceof Error ? error.message : "添加模块失败",
        }
      }
    } catch (error) {
      logger.error("添加模块时发生错误", { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : "添加模块失败",
      }
    }
  },
}
