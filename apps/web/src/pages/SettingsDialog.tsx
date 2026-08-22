/**
 * 设置面板 —— Dialog 形式, 采用 @zoeymind/ui SettingsShell 布局.
 *
 * 三个一级分类:
 *  - preferences: 语言、主题与编辑器行为
 *  - ai:          服务商配置与模型启用
 *  - about:       版本与本地数据位置
 *
 * 数据源 = <appData>/models.json (由 loadModelsConfig / saveModelsConfig 读写).
 * 拉取到的可用模型列表在内存缓存, providerCache Map<providerId, FetchedModel[]>.
 */
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "@zoeymind/i18n"
import {
  Bot,
  Check,
  ChevronsUpDown,
  ChevronDown,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Star,
  Trash2,
} from "lucide-react"
import {
  Button,
  ConfirmDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SettingsShell,
  cn,
} from "@zoeymind/ui"
import { AppVersionStatus, toast, createUUID } from "@/shared/app-shared"
import {
  loadModelsConfig,
  saveModelsConfig,
  fetchProviderModels,
  openGitHubSupport,
  type FetchedModel,
  type ModelsConfig,
  type ModelProvider,
  type ModelEntry,
  type ProviderKind,
} from "@/shared/native"
import { PreferencesSettingsSection } from "./settings-preference-sections"

const PROVIDER_KIND_OPTIONS: Array<{ value: ProviderKind; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai-compatible", label: "OpenAI 兼容" },
  { value: "ollama", label: "Ollama" },
  { value: "gemini", label: "Google Gemini" },
]

const kindLabel = (k: ProviderKind): string =>
  PROVIDER_KIND_OPTIONS.find(o => o.value === k)?.label ?? k

type SectionId = "preferences" | "ai" | "about"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 拉取结果 module-level 缓存, 切 tab 不丢. */
const providerFetchCache = new Map<string, FetchedModel[]>()

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useTranslation()
  const [cfg, setCfg] = useState<ModelsConfig | null>(null)
  const [active, setActive] = useState<SectionId>("preferences")
  // 触发 models section 刷新用 (fetch cache 更新后)
  const [cacheVersion, setCacheVersion] = useState(0)
  const bumpCache = useCallback(() => setCacheVersion(v => v + 1), [])

  useEffect(() => {
    if (open) void loadModelsConfig().then(setCfg)
  }, [open])

  const persist = useCallback(async (next: ModelsConfig) => {
    setCfg(next)
    await saveModelsConfig(next)
  }, [])

  return (
    <SettingsShell
      open={open}
      onOpenChange={onOpenChange}
      title={t("settings.title")}
      items={[
        { id: "preferences", label: t("settings.preferences"), icon: Settings2 },
        { id: "ai", label: t("settings.aiModels"), icon: Bot },
        { id: "about", label: t("settings.about"), icon: Info },
      ]}
      activeId={active}
      onActiveChange={id => setActive(id as SectionId)}
      contentClassName={active === "ai" ? "overflow-hidden p-0" : undefined}
    >
      {active === "preferences" && <PreferencesSettingsSection />}
      {active === "ai" && cfg && (
        <AIModelsSection
          cfg={cfg}
          persist={persist}
          cacheVersion={cacheVersion}
          onFetch={bumpCache}
        />
      )}
      {active === "about" && <AboutSection />}
    </SettingsShell>
  )
}

interface AIModelsSectionProps {
  cfg: ModelsConfig
  persist: (next: ModelsConfig) => Promise<void>
  cacheVersion: number
  onFetch: () => void
}

function AIModelsSection({ cfg, persist, cacheVersion, onFetch }: AIModelsSectionProps) {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    () => cfg.providers[0]?.id ?? null
  )
  const [providerPendingDelete, setProviderPendingDelete] = useState<ModelProvider | null>(null)
  const selectedProvider =
    cfg.providers.find(provider => provider.id === selectedProviderId) ?? cfg.providers[0] ?? null

  const addProvider = async () => {
    const id = createUUID()
    const provider: ModelProvider = {
      id,
      name: `OpenAI ${cfg.providers.length + 1}`,
      kind: "openai",
      baseURL: "",
      apiKey: "",
    }
    await persist({ ...cfg, providers: [...cfg.providers, provider] })
    setSelectedProviderId(id)
  }

  const removeProvider = async (providerId: string) => {
    providerFetchCache.delete(providerId)
    const providers = cfg.providers.filter(provider => provider.id !== providerId)
    await persist({
      ...cfg,
      providers,
      models: cfg.models.filter(model => model.providerId !== providerId),
    })
    setSelectedProviderId(providers[0]?.id ?? null)
  }

  return (
    <>
      <div className="grid h-full min-h-0 grid-cols-[12rem_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col border-r px-4 py-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">服务商</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void addProvider()}
              aria-label="新增服务商"
            >
              <Plus />
            </Button>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cfg.providers.map(provider => {
              const active = provider.id === selectedProvider?.id
              const modelCount = cfg.models.filter(model => model.providerId === provider.id).length
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedProviderId(provider.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                    active ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{provider.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {kindLabel(provider.kind)} · {modelCount} 个模型
                    </span>
                  </span>
                </button>
              )
            })}
            {cfg.providers.length === 0 && (
              <p className="py-3 text-xs text-muted-foreground">还没有服务商。</p>
            )}
          </div>
        </section>

        <section className="min-h-0 min-w-0 overflow-y-auto px-6 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {selectedProvider ? (
            <ProviderDetail
              key={selectedProvider.id}
              provider={selectedProvider}
              cfg={cfg}
              persist={persist}
              cacheVersion={cacheVersion}
              onFetch={onFetch}
              onRemove={() => setProviderPendingDelete(selectedProvider)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">新增服务商后即可配置模型。</p>
              <Button variant="outline" size="sm" onClick={() => void addProvider()}>
                <Plus />
                新增服务商
              </Button>
            </div>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={providerPendingDelete !== null}
        onOpenChange={open => !open && setProviderPendingDelete(null)}
        title={`删除“${providerPendingDelete?.name ?? ""}”？`}
        description={`该服务商及其绑定的 ${cfg.models.filter(model => model.providerId === providerPendingDelete?.id).length} 个模型将被删除。此操作无法撤销。`}
        confirmText="删除服务商"
        variant="destructive"
        onConfirm={async () => {
          if (providerPendingDelete) await removeProvider(providerPendingDelete.id)
          setProviderPendingDelete(null)
        }}
      />
    </>
  )
}

interface ProviderDetailProps {
  provider: ModelProvider
  cfg: ModelsConfig
  persist: (next: ModelsConfig) => Promise<void>
  cacheVersion: number
  onFetch: () => void
  onRemove: () => void
}

function ProviderDetail({
  provider,
  cfg,
  persist,
  cacheVersion,
  onFetch,
  onRemove,
}: ProviderDetailProps) {
  const [draft, setDraft] = useState(provider)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [newModel, setNewModel] = useState<ModelEntry | null>(null)
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null)
  void cacheVersion

  const dirty = JSON.stringify(draft) !== JSON.stringify(provider)
  const models = cfg.models.filter(model => model.providerId === provider.id)
  const fetched = providerFetchCache.get(provider.id) ?? []

  const saveProvider = async () => {
    const name = draft.name.trim()
    if (!name) {
      toast.error("请输入服务商名称")
      return
    }
    setSaving(true)
    try {
      await persist({
        ...cfg,
        providers: cfg.providers.map(item => (item.id === provider.id ? { ...draft, name } : item)),
      })
      setDraft(current => ({ ...current, name }))
      toast.success("服务商已保存")
    } finally {
      setSaving(false)
    }
  }

  const fetchModels = async () => {
    setFetching(true)
    setFetchError(null)
    try {
      const models = await fetchProviderModels(draft)
      providerFetchCache.set(provider.id, models)
      onFetch()
      if (models.length === 0) setFetchError("服务商未返回可用模型")
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : String(error))
    } finally {
      setFetching(false)
    }
  }

  const beginAddModel = () => {
    if (newModel) return
    setExpandedModelId(null)
    setNewModel({
      id: createUUID(),
      providerId: provider.id,
      name: "",
      alias: "",
      capabilities: ["chat"],
    })
  }

  const validateModel = (model: ModelEntry): ModelEntry | null => {
    const name = model.name.trim()
    const alias = model.alias.trim()
    if (!alias) {
      toast.error("请输入模型别名")
      return null
    }
    if (!name) {
      toast.error("请选择或输入模型 ID")
      return null
    }
    if (
      cfg.models.some(
        item => item.id !== model.id && item.providerId === provider.id && item.name === name
      )
    ) {
      toast.error("该服务商下已存在相同模型 ID")
      return null
    }
    return { ...model, name, alias }
  }

  const confirmNewModel = async (draftModel: ModelEntry) => {
    const model = validateModel(draftModel)
    if (!model) return false
    await persist({ ...cfg, models: [...cfg.models, model] })
    setNewModel(null)
    return true
  }

  const confirmModelEdit = async (draftModel: ModelEntry) => {
    const model = validateModel(draftModel)
    if (!model) return false
    await persist({
      ...cfg,
      models: cfg.models.map(item => (item.id === model.id ? model : item)),
    })
    setExpandedModelId(null)
    return true
  }

  const removeModel = async (modelId: string) => {
    await persist({ ...cfg, models: cfg.models.filter(model => model.id !== modelId) })
    setExpandedModelId(null)
  }

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-balance">{provider.name}</h2>
          <p className="text-sm text-muted-foreground">配置连接信息并管理绑定到此服务商的模型。</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="删除服务商"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`provider-name-${provider.id}`}>名称</Label>
          <Input
            id={`provider-name-${provider.id}`}
            value={draft.name}
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
            placeholder="例如：公司 OpenAI"
          />
        </div>
        <div className="space-y-1.5">
          <Label>类型</Label>
          <Select
            value={draft.kind}
            onValueChange={kind =>
              kind && setDraft(current => ({ ...current, kind: kind as ProviderKind }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_KIND_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`provider-url-${provider.id}`}>Base URL</Label>
          <Input
            id={`provider-url-${provider.id}`}
            value={draft.baseURL ?? ""}
            onChange={event => setDraft(current => ({ ...current, baseURL: event.target.value }))}
            placeholder={draft.kind === "ollama" ? "http://localhost:11434" : "留空使用官方地址"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`provider-key-${provider.id}`}>API Key</Label>
          <Input
            id={`provider-key-${provider.id}`}
            type="password"
            value={draft.apiKey ?? ""}
            onChange={event => setDraft(current => ({ ...current, apiKey: event.target.value }))}
            placeholder={draft.kind === "ollama" ? "不需要" : "sk-..."}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => void saveProvider()} disabled={!dirty || saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          保存服务商
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchModels()}
          disabled={fetching || dirty}
          title={dirty ? "请先保存服务商" : undefined}
        >
          {fetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {fetched ? "重新拉取模型" : "拉取模型"}
        </Button>
        {fetchError && <span className="truncate text-xs text-destructive">{fetchError}</span>}
      </div>

      <section className="space-y-3 border-t pt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">模型</h3>
            <p className="text-xs text-muted-foreground">每个模型都绑定到 {provider.name}。</p>
          </div>
          <Button variant="outline" size="sm" onClick={beginAddModel} disabled={newModel !== null}>
            <Plus />
            添加模型
          </Button>
        </div>
        {models.length === 0 && !newModel ? (
          <p className="py-3 text-sm text-muted-foreground">
            添加模型后可配置别名、模型 ID 和 Token 限制。
          </p>
        ) : (
          <div className="space-y-2">
            {newModel && (
              <ModelEditor
                key={newModel.id}
                model={newModel}
                suggestions={fetched.map(item => item.id)}
                expanded
                isNew
                onExpandedChange={() => undefined}
                onConfirm={confirmNewModel}
                onCancel={() => setNewModel(null)}
                onRemove={() => undefined}
              />
            )}
            {models.map(model => (
              <ModelEditor
                key={model.id}
                model={model}
                suggestions={fetched.map(item => item.id)}
                expanded={expandedModelId === model.id}
                onExpandedChange={expanded => setExpandedModelId(expanded ? model.id : null)}
                onConfirm={confirmModelEdit}
                onCancel={() => setExpandedModelId(null)}
                onRemove={() => void removeModel(model.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

interface ModelEditorProps {
  model: ModelEntry
  suggestions: string[]
  expanded: boolean
  isNew?: boolean
  onExpandedChange: (expanded: boolean) => void
  onConfirm: (model: ModelEntry) => Promise<boolean>
  onCancel: () => void
  onRemove: () => void
}

function ModelEditor({
  model,
  suggestions,
  expanded,
  isNew = false,
  onExpandedChange,
  onConfirm,
  onCancel,
  onRemove,
}: ModelEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [draft, setDraft] = useState(model)
  const [query, setQuery] = useState(model.name)
  const [saving, setSaving] = useState(false)
  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.toLowerCase().includes(query.toLowerCase())
  )

  const toggleExpanded = () => {
    if (!expanded) {
      setDraft(model)
      setQuery(model.name)
    }
    onExpandedChange(!expanded)
  }

  const chooseModel = (name: string) => {
    const normalized = name.trim()
    setQuery(normalized)
    setDraft(current => ({ ...current, name: normalized }))
    setPickerOpen(false)
  }

  const parseOptionalTokenLimit = (value: string): number | undefined => {
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined
  }

  const confirm = async () => {
    setSaving(true)
    try {
      await onConfirm(draft)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="t-acc border-b" data-open={expanded ? "true" : "false"}>
      {!isNew && (
        <button
          type="button"
          className="t-acc-head flex w-full cursor-pointer items-center gap-3 py-3 text-left"
          onClick={toggleExpanded}
          aria-expanded={expanded}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{model.alias}</span>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {model.name}
              {(model.maxContextTokens || model.maxOutputTokens) &&
                ` · ${model.maxContextTokens ? `上下文 ${model.maxContextTokens}` : ""}${model.maxContextTokens && model.maxOutputTokens ? " / " : ""}${model.maxOutputTokens ? `输出 ${model.maxOutputTokens}` : ""}`}
            </span>
          </span>
          <ChevronDown className="t-acc-chevron size-4 shrink-0 text-muted-foreground" />
        </button>
      )}
      <div className="t-acc-panel grid" aria-hidden={!expanded}>
        <div className="t-acc-panel-inner min-h-0 overflow-hidden">
          <div className={cn("space-y-4 bg-muted/30 p-3", !isNew && "mb-3")}>
            {isNew && <p className="text-sm font-medium">添加模型</p>}
            <div className="space-y-1.5">
              <Label htmlFor={`model-alias-${model.id}`}>别名</Label>
              <Input
                id={`model-alias-${model.id}`}
                value={draft.alias}
                placeholder="例如：日常对话"
                onChange={event => setDraft(current => ({ ...current, alias: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>模型 ID</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger
                  nativeButton
                  render={
                    <Button
                      variant="outline"
                      className="w-full justify-between font-mono font-normal"
                    >
                      <span className={cn("truncate", !draft.name && "text-muted-foreground")}>
                        {draft.name || "选择或输入模型 ID"}
                      </span>
                      <ChevronsUpDown className="text-muted-foreground" />
                    </Button>
                  }
                />
                <PopoverContent align="start" className="w-(--anchor-width) p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="搜索或输入模型 ID"
                      value={query}
                      onValueChange={setQuery}
                    />
                    <CommandList>
                      {query.trim() && query.trim() !== draft.name && (
                        <CommandGroup heading="自定义">
                          <CommandItem
                            value={`custom:${query}`}
                            onSelect={() => chooseModel(query)}
                          >
                            使用“{query.trim()}”
                          </CommandItem>
                        </CommandGroup>
                      )}
                      <CommandEmpty>输入模型 ID 后使用上方选项。</CommandEmpty>
                      {filteredSuggestions.length > 0 && (
                        <CommandGroup heading="可用模型">
                          {filteredSuggestions.map(suggestion => (
                            <CommandItem
                              key={suggestion}
                              value={suggestion}
                              onSelect={() => chooseModel(suggestion)}
                            >
                              <span className="truncate font-mono">{suggestion}</span>
                              {suggestion === draft.name && <Check className="ml-auto" />}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`model-context-${model.id}`}>最大上下文 Token</Label>
                <Input
                  id={`model-context-${model.id}`}
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={draft.maxContextTokens ?? ""}
                  placeholder="例如 128000"
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      maxContextTokens: parseOptionalTokenLimit(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`model-output-${model.id}`}>最大输出 Token</Label>
                <Input
                  id={`model-output-${model.id}`}
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={draft.maxOutputTokens ?? ""}
                  placeholder="例如 8192"
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      maxOutputTokens: parseOptionalTokenLimit(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              {!isNew ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                  删除
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
                  取消
                </Button>
                <Button size="sm" onClick={() => void confirm()} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Check />}
                  确认
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AboutSection() {
  const { t } = useTranslation()
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-balance">ZoeyMind Desktop</h2>
        <p className="text-sm text-muted-foreground">本地思维导图编辑器</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("settings.githubSupport")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings.githubSupportDescription")}
            </p>
          </div>
          <Button variant="outline" onClick={() => void openGitHubSupport()}>
            <Star fill="currentColor" />
            {t("settings.githubSupportAction")}
          </Button>
        </div>
      </div>
      <dl className="divide-y text-sm">
        <div className="flex justify-between gap-6 py-3">
          <dt className="text-muted-foreground">{t("appVersion.version")}</dt>
          <dd>
            <AppVersionStatus variant="detail" />
          </dd>
        </div>
        <div className="flex justify-between gap-6 py-3">
          <dt className="text-muted-foreground">数据目录</dt>
          <dd>
            <code className="text-xs">~/Documents/ZoeyMind</code>
          </dd>
        </div>
        <div className="flex justify-between gap-6 py-3">
          <dt className="text-muted-foreground">配置文件</dt>
          <dd>
            <code className="text-xs">&lt;appData&gt;/models.json</code>
          </dd>
        </div>
      </dl>
    </section>
  )
}

export default SettingsDialog
