/**
 * saveWithToast —— 用户可见 save 动作的统一反馈包装.
 *
 * 三个 save 入口 (Ctrl+S 快捷键 / HeaderSaveButton / TopMore 菜单) 走这里,
 * 统一:
 *   成功 → toast.success("保存成功")
 *   失败 → logger 记录详细堆栈 + toast.error("保存失败") (面向用户的短提示)
 *   用户在 saveDialog 点 Cancel (throw "保存已取消") → 静默, 不算失败
 *
 * 组件自己的 loading state (spinner) 仍由组件管理, 这里只处理 toast 反馈.
 */
import { logger } from "@zoeymind/logger"
import { dismissToast, toast } from "@/shared/app-shared"

const CANCEL_MESSAGE = "保存已取消"
const SAVE_TOAST_ID_PREFIX = "document-save"

export async function saveWithToast(
  save: () => Promise<void>,
  projectId?: string | null
): Promise<void> {
  const toastId = projectId ? `${SAVE_TOAST_ID_PREFIX}:${projectId}` : undefined
  try {
    await save()
    if (toastId) dismissToast(toastId)
    toast.success("保存成功")
  } catch (error) {
    if (toastId) dismissToast(toastId)
    if (error instanceof Error && error.message === CANCEL_MESSAGE) return
    logger.error("保存失败", error)
    toast.error("保存失败")
  }
}
