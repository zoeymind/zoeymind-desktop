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
import { useMindMapStore } from "@/products/mind/features/mindmap/stores/mindmap-store"

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
    if (!mindMap) return
    mindMap.view.setScale(percent / 100, mindMap.width / 2, mindMap.height / 2)
  }

  const zoomPercent = Math.round(scale * 100)

  return (
    <ButtonGroup aria-label={`${zoomPercent}%`}>
      <Button
        variant="outline"
        size="icon-xs"
        onClick={() => mindMap?.view.enlarge()}
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
            <Button variant="outline" size="xs" className="min-w-16 tabular-nums">
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
        variant="outline"
        size="icon-xs"
        onClick={() => mindMap?.view.narrow()}
        disabled={!mindMap}
        aria-label={t("mindmap.canvasTool.zoomOut")}
        title={t("mindmap.canvasTool.zoomOut")}
      >
        <Minus />
      </Button>
    </ButtonGroup>
  )
}
