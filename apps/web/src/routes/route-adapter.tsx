import { useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { WorkspaceShell } from "@/components/workspace-shell"
import { useTabs } from "@/shared/tabs/store"
import { getProject, pendingProjects } from "@/shared/native"
import { defaultMindmapData } from "@zoeymind/shared"
import { i18next } from "@zoeymind/i18n"

export function RouteAdapter() {
  const location = useLocation()
  const navigate = useNavigate()
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    void (async () => {
      const path = location.pathname
      const tabs = useTabs.getState()

      if (path === "/editor/new") {
        const title = i18next.t("mindmap.editor.newProjectTitle", "未命名思维导图")
        const draftId = pendingProjects.stash({ title, tree: defaultMindmapData })
        tabs.openTab({ id: draftId, kind: "draft", title })
      } else if (path.startsWith("/editor/")) {
        const id = path.slice("/editor/".length)
        if (id) {
          const row = await getProject(id)
          const name = row?.path
            ? (row.path.split(/[\\/]/).pop() ?? id).replace(/\.zmind$/i, "")
            : id
          tabs.openTab({ id, kind: "file", title: name })
        }
      } else {
        tabs.setActive("home")
      }

      navigate("/", { replace: true })
    })()
    // URL 只在首次挂载时解释为 tab，之后由 tabs store 主导。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <WorkspaceShell />
}
