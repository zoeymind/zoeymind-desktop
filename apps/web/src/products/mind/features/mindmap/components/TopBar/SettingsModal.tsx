import { type FC, useState } from "react"
import { useTranslation } from "@zoeymind/i18n"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@zoeymind/ui"
import { Button } from "@zoeymind/ui"
import { Switch } from "@zoeymind/ui"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@zoeymind/ui"
import { Input } from "@zoeymind/ui"

const PERFORMANCE_MODE_KEY = "mind-map-performance-mode"
const PERFORMANCE_CONFIG_KEY = "mind-map-performance-config"
const ALIGN_SAME_LEVEL_WIDTH_KEY = "mind-map-align-same-level-width"

const defaultPerformanceConfig = {
  time: 250,
  padding: 100,
  removeNodeWhenOutCanvas: true,
}

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export { ALIGN_SAME_LEVEL_WIDTH_KEY }

export const SettingsModal: FC<SettingsModalProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation()
  const [performanceMode, setPerformanceMode] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(PERFORMANCE_MODE_KEY) === "true"
  })

  const [alignSameLevelWidth, setAlignSameLevelWidth] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(ALIGN_SAME_LEVEL_WIDTH_KEY) === "true"
  })

  const [config, setConfig] = useState(() => {
    if (typeof window === "undefined") return defaultPerformanceConfig
    const savedConfig = localStorage.getItem(PERFORMANCE_CONFIG_KEY)
    try {
      return savedConfig ? JSON.parse(savedConfig) : defaultPerformanceConfig
    } catch {
      return defaultPerformanceConfig
    }
  })

  const handlePerformanceChange = (enabled: boolean) => {
    setPerformanceMode(enabled)
    localStorage.setItem(PERFORMANCE_MODE_KEY, String(enabled))
  }

  const handleAlignSameLevelWidthChange = (enabled: boolean) => {
    setAlignSameLevelWidth(enabled)
    localStorage.setItem(ALIGN_SAME_LEVEL_WIDTH_KEY, String(enabled))
  }

  const handleConfigChange = (field: keyof typeof config, value: string | number | boolean) => {
    const newConfig = { ...config, [field]: value }
    if (field === "time" || field === "padding") {
      newConfig[field] = Number(value)
    }
    setConfig(newConfig)
    localStorage.setItem(PERFORMANCE_CONFIG_KEY, JSON.stringify(newConfig))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("common.settings")}</DialogTitle>
          <DialogDescription>{t("mindmap.topbar.settings.description")}</DialogDescription>
        </DialogHeader>
        <FieldGroup className="py-4">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="align-same-level-width">
                {t("mindmap.topbar.settings.alignSameLevelWidth")}
              </FieldLabel>
              <FieldDescription>
                {t("mindmap.topbar.settings.alignSameLevelWidthDesc")}
              </FieldDescription>
            </FieldContent>
            <Switch
              id="align-same-level-width"
              checked={alignSameLevelWidth}
              onCheckedChange={handleAlignSameLevelWidthChange}
            />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="performance-mode">
              {t("mindmap.topbar.settings.performanceMode")}
            </FieldLabel>
            <Switch
              id="performance-mode"
              checked={performanceMode}
              onCheckedChange={handlePerformanceChange}
            />
          </Field>

          {performanceMode && (
            <>
              <FieldSet>
                <FieldLegend variant="label">
                  {t("mindmap.topbar.settings.performanceConfig")}
                </FieldLegend>
                <FieldGroup>
                  <Field orientation="horizontal">
                    <FieldLabel htmlFor="perf-time">
                      {t("mindmap.topbar.settings.refreshDelay")}
                    </FieldLabel>
                    <Input
                      id="perf-time"
                      type="number"
                      value={config.time}
                      onChange={e => handleConfigChange("time", e.target.value)}
                    />
                  </Field>

                  <Field orientation="horizontal">
                    <FieldLabel htmlFor="perf-padding">
                      {t("mindmap.topbar.settings.preloadRange")}
                    </FieldLabel>
                    <Input
                      id="perf-padding"
                      type="number"
                      value={config.padding}
                      onChange={e => handleConfigChange("padding", e.target.value)}
                    />
                  </Field>

                  <Field orientation="horizontal">
                    <FieldLabel htmlFor="perf-remove-node">
                      {t("mindmap.topbar.settings.removeOutOfCanvas")}
                    </FieldLabel>
                    <Switch
                      id="perf-remove-node"
                      checked={config.removeNodeWhenOutCanvas}
                      onCheckedChange={checked =>
                        handleConfigChange("removeNodeWhenOutCanvas", checked)
                      }
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>
            </>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
