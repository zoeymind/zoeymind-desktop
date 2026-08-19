/**
 * macOS 顶部原生菜单栏 —— File / Language / Help (等)
 *
 * 通过 `@tauri-apps/api/menu` 构建, `setAsAppMenu` 挂到系统层.
 * macOS 需要至少一个 submenu, 顶层 items 会被系统忽略.
 * 事件通过 `MenuItem` action 回调走前端 JS -> 直接操作 useTabs / i18n / saveFlow.
 *
 * 首次 install 后重建也是同一 API; 语言切换后重构 menu 让文案跟随 locale.
 */
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu"
import { i18next } from "@zoeymind/i18n"
import { logger } from "@zoeymind/logger"
import { open as openDialog, save as saveNativeDialog } from "@tauri-apps/plugin-dialog"
import * as pendingProjects from "./pending-projects"
import { defaultMindmapData } from "@zoeymind/shared"
import { useTabs } from "@/shared/tabs/store"
import { findByPath, registerProject, listProjects } from "./projects-repo"
import { bumpProjects } from "./projects-events"
import { createUUID } from "@/shared/app-shared"
import { projectSessionRegistry } from "@/products/mind/editor-session"

// 新建 draft tab
async function actionNew(): Promise<void> {
  const title = i18next.t("mindmap.editor.newProjectTitle", "未命名思维导图")
  const id = pendingProjects.stash({ title, tree: defaultMindmapData })
  useTabs.getState().openTab({ id, kind: "draft", title })
}

// 打开对话框 -> 找/建 project -> openTab
async function actionOpen(): Promise<void> {
  try {
    const picked = await openDialog({
      multiple: false,
      filters: [{ name: "ZoeyMind", extensions: ["zmind"] }],
    })
    if (!picked || typeof picked !== "string") return
    const existing = await findByPath(picked)
    let id = existing?.id
    // 名字权威源: 文件名 (foo.zmind -> foo).
    const name =
      picked
        .split(/[\\/]/)
        .pop()!
        .replace(/\.zmind$/i, "") || "Untitled"
    if (!id) {
      id = createUUID()
      await registerProject({ id, path: picked, name, nodeCount: 0 })
      bumpProjects()
    }
    useTabs.getState().openTab({ id, kind: "file", title: name, projectId: id })
  } catch (error) {
    logger.error("open failed", error)
  }
}

async function actionSave(): Promise<void> {
  try {
    await projectSessionRegistry.getActive()?.getState().commands.save?.()
  } catch (error) {
    logger.error("save failed", error)
  }
}

async function actionSaveAs(): Promise<void> {
  try {
    const picked = await saveNativeDialog({
      filters: [{ name: "ZoeyMind", extensions: ["zmind"] }],
    })
    if (!picked) return
    await projectSessionRegistry.getActive()?.getState().commands.saveAs?.(picked)
  } catch (error) {
    logger.error("save as failed", error)
  }
}

function actionCloseTab(): void {
  const s = useTabs.getState()
  if (s.activeId === "home" || !s.activeId) return
  s.closeTab(s.activeId as string)
}

function actionSetLocale(loc: "zh-CN" | "en-US"): void {
  void i18next.changeLanguage(loc)
  try {
    localStorage.setItem("i18nextLng", loc)
  } catch {
    /* ignore */
  }
}

/**
 * 把命令派给当前 active tab 的 mindmap 引擎实例.
 * 支持 BACK / FORWARD / SELECT_ALL 等 simple-mind-map 命令.
 */
function actionMindMapCommand(cmd: string): void {
  const instance = projectSessionRegistry.getActive()?.getState().mindMap
  instance?.execCommand?.(cmd)
}

async function buildRecentSubmenu(): Promise<Submenu> {
  const list = await listProjects().catch(() => [])
  const sorted = list
    .filter(p => p.exists)
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
    .slice(0, 10)

  const items = await Promise.all(
    sorted.map(async row =>
      MenuItem.new({
        id: `recent:${row.id}`,
        text: row.name || row.path.split(/[\\/]/).pop() || row.id,
        action: () => {
          useTabs.getState().openTab({
            id: row.id,
            kind: "file",
            title: row.name,
            projectId: row.id,
          })
        },
      })
    )
  )
  return await Submenu.new({
    text: i18next.t("menu.openRecent", "打开最近"),
    items: items.length
      ? items
      : [
          await MenuItem.new({
            id: "recent:empty",
            text: i18next.t("menu.noRecent", "(空)"),
            enabled: false,
          }),
        ],
  })
}

/**
 * 构建整个菜单. 每次 locale / recent 变化时重建 (成本低, 系统 API 快).
 */
export async function installAppMenu(): Promise<void> {
  const t = (k: string, fb: string) => i18next.t(k, fb)

  // 首个 submenu 会成为 macOS App 菜单 (About / Quit 等)
  const appSubmenu = await Submenu.new({
    text: "ZoeyMind",
    items: [
      await PredefinedMenuItem.new({
        item: { About: { name: "ZoeyMind", copyright: "MIT", version: "0.1.0" } },
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Services" }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Hide" }),
      await PredefinedMenuItem.new({ item: "HideOthers" }),
      await PredefinedMenuItem.new({ item: "ShowAll" }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Quit" }),
    ],
  })

  const fileSubmenu = await Submenu.new({
    text: t("menu.file", "文件"),
    items: [
      await MenuItem.new({
        id: "file:new",
        text: t("menu.new", "新建"),
        accelerator: "CmdOrCtrl+N",
        action: () => void actionNew(),
      }),
      await MenuItem.new({
        id: "file:open",
        text: t("menu.open", "打开..."),
        accelerator: "CmdOrCtrl+O",
        action: () => void actionOpen(),
      }),
      await buildRecentSubmenu(),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await MenuItem.new({
        id: "file:save",
        text: t("menu.save", "保存"),
        accelerator: "CmdOrCtrl+S",
        action: () => void actionSave(),
      }),
      await MenuItem.new({
        id: "file:saveas",
        text: t("menu.saveAs", "另存为..."),
        accelerator: "CmdOrCtrl+Shift+S",
        action: () => void actionSaveAs(),
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await MenuItem.new({
        id: "file:closetab",
        text: t("menu.closeTab", "关闭标签"),
        accelerator: "CmdOrCtrl+W",
        action: () => actionCloseTab(),
      }),
      await PredefinedMenuItem.new({ item: "CloseWindow" }),
    ],
  })

  // 走 active tab 的 mindMap 命令; 无 canvas 时 fallback 到 OS 层 Undo/Redo (预设项)
  const editSubmenu = await Submenu.new({
    text: t("menu.edit", "编辑"),
    items: [
      await MenuItem.new({
        id: "edit:undo",
        text: t("menu.undo", "撤销"),
        accelerator: "CmdOrCtrl+Z",
        action: () => actionMindMapCommand("BACK"),
      }),
      await MenuItem.new({
        id: "edit:redo",
        text: t("menu.redo", "重做"),
        accelerator: "CmdOrCtrl+Shift+Z",
        action: () => actionMindMapCommand("FORWARD"),
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Cut" }),
      await PredefinedMenuItem.new({ item: "Copy" }),
      await PredefinedMenuItem.new({ item: "Paste" }),
      await MenuItem.new({
        id: "edit:selectall",
        text: t("menu.selectAll", "全选"),
        accelerator: "CmdOrCtrl+A",
        action: () => actionMindMapCommand("SELECT_ALL"),
      }),
    ],
  })

  const langSubmenu = await Submenu.new({
    text: t("menu.language", "语言"),
    items: [
      await MenuItem.new({
        id: "lang:zh",
        text: "简体中文",
        action: () => actionSetLocale("zh-CN"),
      }),
      await MenuItem.new({
        id: "lang:en",
        text: "English",
        action: () => actionSetLocale("en-US"),
      }),
    ],
  })

  const windowSubmenu = await Submenu.new({
    text: t("menu.window", "窗口"),
    items: [
      await PredefinedMenuItem.new({ item: "Minimize" }),
      await PredefinedMenuItem.new({ item: "Maximize" }),
      await PredefinedMenuItem.new({ item: "Fullscreen" }),
    ],
  })

  const menu = await Menu.new({
    items: [appSubmenu, fileSubmenu, editSubmenu, langSubmenu, windowSubmenu],
  })

  await menu.setAsAppMenu()
}

/**
 * i18n 变化后重建菜单文案.
 */
export function setupAppMenu(): () => void {
  void installAppMenu().catch(err => logger.error("installAppMenu failed", err))
  const onLangChange = () => {
    void installAppMenu().catch(err => logger.error("reinstallAppMenu failed", err))
  }
  i18next.on("languageChanged", onLangChange)
  return () => {
    i18next.off("languageChanged", onLangChange)
  }
}
