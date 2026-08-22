import { useEffect, useMemo, useRef } from "react"
import MindMap, { type MindMapNodeTree } from "simple-mind-map"
import { useTranslation } from "@zoeymind/i18n"
import { createAppPresetMindmapStyles } from "./hooks/useCanvasManager"

export function TestCaseRulesMindMap() {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const data = useMemo<MindMapNodeTree>(
    () => ({
      data: { text: t("projects.rules.rootExample"), uid: "rules-root" },
      children: [
        {
          data: {
            text: t("projects.rules.moduleExample"),
            icon: ["sign_2"],
            uid: "rules-module",
          },
          children: [
            {
              data: {
                text: t("projects.rules.caseExample"),
                icon: ["priority_1"],
                uid: "rules-case",
              },
              children: [
                {
                  data: { text: t("projects.rules.stepExample"), uid: "rules-step" },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    }),
    [t]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const appStyles = createAppPresetMindmapStyles()
    const mindMap = new MindMap({
      el: container,
      data,
      width: rect.width,
      height: rect.height,
      layout: "logicalStructure",
      layoutDirection: 2,
      readonly: true,
      theme: "default",
      themeConfig: appStyles.themeConfig,
      hoverRectColor: appStyles.hoverRectColor,
      hoverRectBackdropColor: appStyles.hoverRectBackdropColor,
      expandBtnStyle: appStyles.expandBtnStyle,
      dragPlaceholderLineConfig: appStyles.dragPlaceholderLineConfig,
      quickCreateChildBtnIcon: appStyles.quickCreateChildBtnIcon,
      alwaysShowExpandBtn: false,
      allowReadonlyContextMenu: false,
      isLimitMindMapInCanvasWhenHasScrollbar: true,
      keyboardNavigationMoveToCenter: false,
    })
    const fit = () => {
      mindMap.resize()
      mindMap.view.fit()
    }
    const handleRenderEnd = () => requestAnimationFrame(fit)
    mindMap.on("node_tree_render_end", handleRenderEnd)
    mindMap.render()
    const resizeObserver = new ResizeObserver(fit)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      mindMap.off("node_tree_render_end", handleRenderEnd)
      mindMap.destroy()
    }
  }, [data])

  return (
    <div className="relative overflow-hidden rounded-xl bg-background ring-1 ring-border/70">
      <div ref={containerRef} className="h-72 w-full pointer-events-none" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-background/90 to-transparent px-4 pb-3 pt-8 text-center text-xs text-muted-foreground">
        {t("projects.rules.canvasCaption")}
      </div>
    </div>
  )
}
