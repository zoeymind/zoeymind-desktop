import { useState } from "react"
import { useTranslation, SUPPORTED_LOCALES, useChangeLocale, useLocale } from "@zoeymind/i18n"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  Input,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from "@zoeymind/ui"
import { ThemeMenu } from "@/shared/app-shared"

const PERFORMANCE_MODE_KEY = "mind-map-performance-mode"
const PERFORMANCE_CONFIG_KEY = "mind-map-performance-config"
export const ALIGN_SAME_LEVEL_WIDTH_KEY = "mind-map-align-same-level-width"

const DEFAULT_PERFORMANCE_CONFIG = {
  time: 250,
  padding: 100,
  removeNodeWhenOutCanvas: true,
}

export function LanguageSettingsSection() {
  const { t } = useTranslation()
  const current = useLocale()
  const changeLocale = useChangeLocale()

  return (
    <SettingsSection
      title={t("language.switch")}
      description={t("settings.languageDescription")}
    >
      <ToggleGroup
        type="single"
        value={current}
        onValueChange={value => {
          if (value) changeLocale(value)
        }}
        variant="outline"
        spacing={1}
        className="w-full"
        aria-label={t("language.switch")}
      >
        {SUPPORTED_LOCALES.map(locale => (
          <ToggleGroupItem key={locale} value={locale} className="flex-1">
            {t(`language.${locale}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </SettingsSection>
  )
}

export function ThemeSettingsSection() {
  const { t } = useTranslation()

  return (
    <SettingsSection
      title={t("common.themePreset")}
      description={t("settings.themeDescription")}
      contentClassName="p-0"
    >
      <ThemeMenu variant="inline" />
    </SettingsSection>
  )
}

export function EditorSettingsSection() {
  const { t } = useTranslation()
  const [performanceMode, setPerformanceMode] = useState(
    () => localStorage.getItem(PERFORMANCE_MODE_KEY) === "true",
  )
  const [alignSameLevelWidth, setAlignSameLevelWidth] = useState(
    () => localStorage.getItem(ALIGN_SAME_LEVEL_WIDTH_KEY) === "true",
  )
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem(PERFORMANCE_CONFIG_KEY)
    if (!saved) return DEFAULT_PERFORMANCE_CONFIG
    try {
      return { ...DEFAULT_PERFORMANCE_CONFIG, ...JSON.parse(saved) }
    } catch {
      return DEFAULT_PERFORMANCE_CONFIG
    }
  })

  const updatePerformanceMode = (enabled: boolean) => {
    setPerformanceMode(enabled)
    localStorage.setItem(PERFORMANCE_MODE_KEY, String(enabled))
  }

  const updateAlignSameLevelWidth = (enabled: boolean) => {
    setAlignSameLevelWidth(enabled)
    localStorage.setItem(ALIGN_SAME_LEVEL_WIDTH_KEY, String(enabled))
  }

  const updateConfig = (
    field: keyof typeof config,
    value: string | number | boolean,
  ) => {
    const next = {
      ...config,
      [field]: field === "time" || field === "padding" ? Number(value) : value,
    }
    setConfig(next)
    localStorage.setItem(PERFORMANCE_CONFIG_KEY, JSON.stringify(next))
  }

  return (
    <SettingsSection
      title={t("settings.editor")}
      description={t("mindmap.topbar.settings.description")}
    >
      <FieldGroup>
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
            onCheckedChange={updateAlignSameLevelWidth}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="performance-mode">
              {t("mindmap.topbar.settings.performanceMode")}
            </FieldLabel>
          </FieldContent>
          <Switch
            id="performance-mode"
            checked={performanceMode}
            onCheckedChange={updatePerformanceMode}
          />
        </Field>

        {performanceMode ? (
          <>
            <FieldSeparator />
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
                    onChange={event => updateConfig("time", event.target.value)}
                    className="w-28"
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
                    onChange={event => updateConfig("padding", event.target.value)}
                    className="w-28"
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
                      updateConfig("removeNodeWhenOutCanvas", checked)
                    }
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          </>
        ) : null}
      </FieldGroup>
    </SettingsSection>
  )
}

function SettingsSection({
  title,
  description,
  children,
  contentClassName,
}: {
  title: string
  description: string
  children: React.ReactNode
  contentClassName?: string
}) {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className={contentClassName}>{children}</CardContent>
      </Card>
    </div>
  )
}
