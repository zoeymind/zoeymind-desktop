import { useCallback, useSyncExternalStore } from "react"
import { ChevronDown, LocateFixed, Minus, Plus } from "lucide-react"
import { useTranslation } from "@zoeymind/i18n"
import {
  Button,
  ButtonGroup,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoeymind/ui"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200] as const

export function ZoomControls() {
  const { t } = useTranslation()
  const mindMap = useMindMapStore(state => state.mindMap)
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!mindMap) return () => undefined

      mindMap.on("scale", onStoreChange)
      return () => mindMap.off("scale", onStoreChange)
    },
    [mindMap]
  )
  const getScale = useCallback(() => mindMap?.view.scale ?? 1, [mindMap])
  const scale = useSyncExternalStore(subscribe, getScale, () => 1)

  const setZoom = (percent: number) => {
    mindMap?.emit("smooth_zoom_to", percent / 100)
  }

  const zoomPercent = Math.round(scale * 100)

  return (
    <ButtonGroup aria-label={`${zoomPercent}%`}>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => mindMap?.emit("smooth_zoom_in")}
        disabled={!mindMap}
        aria-label={t("mindmap.canvasTool.zoomIn")}
        title={t("mindmap.canvasTool.zoomIn")}
      >
        <Plus />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          nativeButton
          disabled={!mindMap}
          render={
            <Button variant="ghost" size="xs" className="min-w-14 tabular-nums">
              {zoomPercent}%
              <ChevronDown data-icon="inline-end" />
            </Button>
          }
        />
        <DropdownMenuContent side="top" align="center" className="min-w-32">
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              value={String(zoomPercent)}
              onValueChange={value => setZoom(Number(value))}
            >
              {ZOOM_PRESETS.map(percent => (
                <DropdownMenuRadioItem key={percent} value={String(percent)} closeOnClick>
                  {percent}%
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => mindMap?.view.reset()}>
              <LocateFixed />
              {t("mindmap.canvasTool.centerCanvas")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => mindMap?.emit("smooth_zoom_out")}
        disabled={!mindMap}
        aria-label={t("mindmap.canvasTool.zoomOut")}
        title={t("mindmap.canvasTool.zoomOut")}
      >
        <Minus />
      </Button>
    </ButtonGroup>
  )
}
