import { useCallback, useEffect, useState } from "react"
import { Check, ChevronDown, FolderCog, FolderOpen, Trash2 } from "lucide-react"
import { useTranslation, SUPPORTED_LOCALES, useChangeLocale, useLocale } from "@zoeymind/i18n"
import {
  Button,
  Collapsible,
  CollapsibleTrigger,
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
} from "@zoeymind/ui"
import { AnimatePresence, motion } from "motion/react"
import { ThemeModeToggle, ThemePresetGrid } from "@/shared/app-shared/ThemeMenu"
import { toast } from "@/shared/app-shared"
import {
  clearLogs,
  getLogConfig,
  openLogDir,
  setLogDir,
  setLogLevel,
  LOG_LEVEL_OPTIONS,
  type LogInfo,
  type LogLevel,
} from "@/shared/native"
import {
  CLOSE_BEHAVIOR_KEY,
  DEFAULT_CLOSE_BEHAVIOR,
  getCloseBehavior,
  type CloseBehavior,
} from "@/shared/native/close-behavior"
import { open as openDialog } from "@tauri-apps/plugin-dialog"

const PERFORMANCE_MODE_KEY = "mind-map-performance-mode"
const PERFORMANCE_CONFIG_KEY = "mind-map-performance-config"
export const ALIGN_SAME_LEVEL_WIDTH_KEY = "mind-map-align-same-level-width"

const DEFAULT_PERFORMANCE_CONFIG = {
  time: 250,
  padding: 100,
  removeNodeWhenOutCanvas: true,
}

export function PreferencesSettingsSection() {
  return (
    <div className="space-y-8">
      <LanguageSettingsSection />
      <Separator />
      <ThemeModeSettingsSection />
      <Separator />
      <ThemePresetSettingsSection />
      <Separator />
      <EditorSettingsSection />
      <Separator />
      <WindowSettingsSection />
      <LogSettingsSection />
    </div>
  )
}

function WindowSettingsSection() {
  const { t } = useTranslation()
  const [behavior, setBehaviorState] = useState<CloseBehavior>(() => getCloseBehavior())

  const updateBehavior = (value: CloseBehavior) => {
    setBehaviorState(value)
    if (value === DEFAULT_CLOSE_BEHAVIOR) {
      window.localStorage.removeItem(CLOSE_BEHAVIOR_KEY)
    } else {
      window.localStorage.setItem(CLOSE_BEHAVIOR_KEY, value)
    }
  }

  return (
    <SettingsSection
      title={t("settings.window.title")}
      description={t("settings.window.description")}
    >
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="window-close-behavior">
            {t("settings.window.closeBehavior")}
          </FieldLabel>
          <FieldDescription>{t("settings.window.closeBehaviorDesc")}</FieldDescription>
        </FieldContent>
        <Select
          value={behavior}
          onValueChange={value => value && updateBehavior(value as CloseBehavior)}
        >
          <SelectTrigger id="window-close-behavior" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ask">{t("settings.window.closeAsk")}</SelectItem>
            <SelectItem value="tray">{t("settings.window.closeTray")}</SelectItem>
            <SelectItem value="quit">{t("settings.window.closeQuit")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </SettingsSection>
  )
}

function LanguageSettingsSection() {
  const { t } = useTranslation()
  const current = useLocale()
  const changeLocale = useChangeLocale()

  return (
    <SettingsSection title={t("settings.language")} description={t("settings.languageDescription")}>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="application-language">{t("language.switch")}</FieldLabel>
        </FieldContent>
        <Select value={current} onValueChange={locale => locale && void changeLocale(locale)}>
          <SelectTrigger id="application-language" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LOCALES.map(locale => (
              <SelectItem key={locale} value={locale}>
                {t(`language.${locale}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </SettingsSection>
  )
}

function ThemeModeSettingsSection() {
  const { t } = useTranslation()

  return (
    <SettingsSection title={t("settings.theme")} description={t("settings.themeDescription")}>
      <ThemeModeToggle />
    </SettingsSection>
  )
}

function ThemePresetSettingsSection() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="t-acc space-y-3"
      data-open={String(open)}
    >
      <CollapsibleTrigger className="t-acc-head flex w-full items-center justify-between gap-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-balance">{t("common.themePreset")}</h2>
          <p className="text-sm text-muted-foreground text-pretty">
            {t("settings.presetDescription")}
          </p>
        </div>
        <span className="t-acc-chevron text-muted-foreground">
          <ChevronDown className="size-4" />
        </span>
      </CollapsibleTrigger>
      <div className="t-acc-panel">
        <div className="t-acc-panel-inner">
          <div className="h-64 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ThemePresetGrid />
          </div>
        </div>
      </div>
    </Collapsible>
  )
}

export function EditorSettingsSection() {
  const { t } = useTranslation()
  const [performanceMode, setPerformanceMode] = useState(
    () => localStorage.getItem(PERFORMANCE_MODE_KEY) === "true"
  )
  const [alignSameLevelWidth, setAlignSameLevelWidth] = useState(
    () => localStorage.getItem(ALIGN_SAME_LEVEL_WIDTH_KEY) === "true"
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

  const updateConfig = (field: keyof typeof config, value: string | number | boolean) => {
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
                    onCheckedChange={checked => updateConfig("removeNodeWhenOutCanvas", checked)}
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
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-balance">{title}</h2>
        <p className="text-sm text-muted-foreground text-pretty">{description}</p>
      </div>
      {children}
    </section>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function LogSettingsSection() {
  const { t } = useTranslation()
  const [info, setInfo] = useState<LogInfo | null>(null)
  const [busy, setBusy] = useState(false)
  // 清空成功后短暂把 Trash2 换成 Check, 给到明确反馈; 1.2s 自动复位.
  const [cleared, setCleared] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const cfg = await getLogConfig()
      setInfo(cfg)
    } catch (error) {
      console.error("failed to load log config", error)
    }
  }, [])

  useEffect(() => {
    void getLogConfig()
      .then(setInfo)
      .catch(error => console.error("failed to load log config", error))
  }, [])

  useEffect(() => {
    if (!cleared) return
    const timer = window.setTimeout(() => setCleared(false), 1200)
    return () => window.clearTimeout(timer)
  }, [cleared])

  const handleLevelChange = async (level: LogLevel) => {
    if (!info) return
    const prev = info
    setInfo({ ...prev, level })
    try {
      await setLogLevel(level)
    } catch (error) {
      setInfo(prev)
      const detail = error instanceof Error ? error.message : String(error)
      toast.error(`${t("settings.log.updateFailed")}: ${detail}`)
    }
  }

  const handleOpenDir = async () => {
    if (!info) return
    try {
      await openLogDir()
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      toast.error(`${t("settings.log.openFailed")}: ${detail}`)
    }
  }

  const handleChangeDir = async () => {
    if (!info) return
    const picked = await openDialog({
      directory: true,
      multiple: false,
      defaultPath: info.configuredDir ?? info.activeDir,
      title: t("settings.log.pickerTitle"),
    })
    if (!picked || typeof picked !== "string") return
    // 选到默认目录 = 视为重置; 空串传给 Rust 会走"reset to default"分支.
    const nextConfigured = picked === info.defaultDir ? "" : picked
    try {
      await setLogDir(nextConfigured)
      setInfo({ ...info, configuredDir: nextConfigured || null })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      toast.error(`${t("settings.log.dirSaveFailed")}: ${detail}`)
    }
  }

  const handleClear = async () => {
    if (!info) return
    setBusy(true)
    try {
      const removed = await clearLogs()
      setCleared(true)
      toast.success(t("settings.log.cleared", { count: removed }))
      // 清完立即刷新 sizeBytes; 活跃文件的 FD 还开着但内容清零, 显示应回到 0 附近.
      await refresh()
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      toast.error(`${t("settings.log.clearFailed")}: ${detail}`)
    } finally {
      setBusy(false)
    }
  }

  const configured = info?.configuredDir ?? null
  const effectiveNextDir = configured || info?.defaultDir || ""
  const needsRestart = Boolean(info && effectiveNextDir && effectiveNextDir !== info.activeDir)

  return (
    <SettingsSection title={t("settings.log.title")} description={t("settings.log.description")}>
      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="log-level">{t("settings.log.level")}</FieldLabel>
            <FieldDescription>{t("settings.log.levelDescription")}</FieldDescription>
          </FieldContent>
          <Select
            value={info?.level ?? "info"}
            onValueChange={value => void handleLevelChange(value as LogLevel)}
            disabled={!info}
          >
            <SelectTrigger id="log-level" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOG_LEVEL_OPTIONS.map(level => (
                <SelectItem key={level} value={level}>
                  {t(`settings.log.levels.${level}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>{t("settings.log.location")}</FieldLabel>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleChangeDir()}
              disabled={!info}
              className="transition-transform active:scale-[0.96]"
            >
              <FolderCog />
              {t("settings.log.change")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleOpenDir()}
              disabled={!info}
              className="transition-transform active:scale-[0.96]"
            >
              <FolderOpen />
              {t("settings.log.open")}
            </Button>
          </div>
          <FieldDescription className="font-mono text-xs break-all">
            {info?.activeDir ?? "…"}
          </FieldDescription>
          {needsRestart && (
            <FieldDescription className="text-amber-500">
              {t("settings.log.restartHint")}
            </FieldDescription>
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("settings.log.sizeUsed", { size: info ? formatBytes(info.sizeBytes) : "…" })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleClear()}
              disabled={!info || busy}
              className="relative transition-transform active:scale-[0.96]"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {cleared ? (
                  <motion.span
                    key="check"
                    initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                    transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                    className="inline-flex text-emerald-500"
                  >
                    <Check />
                  </motion.span>
                ) : (
                  <motion.span
                    key="trash"
                    initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                    transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                    className="inline-flex"
                  >
                    <Trash2 />
                  </motion.span>
                )}
              </AnimatePresence>
              {t("settings.log.clear")}
            </Button>
          </div>
        </Field>
      </FieldGroup>
    </SettingsSection>
  )
}
