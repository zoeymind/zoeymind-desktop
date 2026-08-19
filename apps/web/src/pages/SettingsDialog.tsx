/**
 * 设置面板 —— Dialog 形式, 采用 @zoeymind/ui SettingsShell 布局.
 *
 * 拆分成三个 section:
 *  - providers: 服务商配置 (kind / baseURL / apiKey), 明确"保存"按钮 (staged state)
 *  - models:    从已配置服务商拉取到的模型, checkbox 打开/关闭 (自动保存, 小改动)
 *  - about:     版本信息
 *
 * 数据源 = <appData>/models.json (由 loadModelsConfig / saveModelsConfig 读写).
 * 拉取到的可用模型列表在内存缓存, providerCache Map<providerId, FetchedModel[]>.
 */
// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import { Bot, Boxes, Info, Languages, Loader2, Palette, Plus, RefreshCw, Save, Settings2, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsShell,
  cn
} from '@zoeymind/ui'
import { toast, createUUID } from '@/shared/app-shared'
import {
  loadModelsConfig,
  saveModelsConfig,
  fetchProviderModels,
  type FetchedModel,
  type ModelsConfig,
  type ModelProvider,
  type ModelEntry,
  type ProviderKind
} from '@/shared/native'
import {
  EditorSettingsSection,
  LanguageSettingsSection,
  ThemeSettingsSection
} from './settings-preference-sections'

const PROVIDER_KIND_OPTIONS: Array<{ value: ProviderKind; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai-compatible', label: 'OpenAI 兼容' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'gemini', label: 'Google Gemini' }
]

const kindLabel = (k: ProviderKind): string =>
  PROVIDER_KIND_OPTIONS.find(o => o.value === k)?.label ?? k

type SectionId = 'language' | 'theme' | 'editor' | 'providers' | 'models' | 'about'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 拉取结果 module-level 缓存, 切 tab 不丢. */
const providerFetchCache = new Map<string, FetchedModel[]>()

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useTranslation()
  const [cfg, setCfg] = useState<ModelsConfig | null>(null)
  const [active, setActive] = useState<SectionId>('language')
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
      title={t('settings.title')}
      items={[
        { id: 'language', label: t('settings.language'), icon: Languages },
        { id: 'theme', label: t('settings.theme'), icon: Palette },
        { id: 'editor', label: t('settings.editor'), icon: Settings2 },
        { id: 'providers', label: t('settings.providers'), icon: Boxes },
        { id: 'models', label: t('settings.models'), icon: Bot },
        { id: 'about', label: t('settings.about'), icon: Info }
      ]}
      activeId={active}
      onActiveChange={id => setActive(id as SectionId)}
    >
      {active === 'language' && <LanguageSettingsSection />}
      {active === 'theme' && <ThemeSettingsSection />}
      {active === 'editor' && <EditorSettingsSection />}
      {active === 'providers' && cfg && (
        <ProvidersSection cfg={cfg} persist={persist} onFetch={bumpCache} />
      )}
      {active === 'models' && cfg && (
        <ModelsSection cfg={cfg} persist={persist} cacheVersion={cacheVersion} />
      )}
      {active === 'about' && <AboutSection />}
    </SettingsShell>
  )
}

interface ProvidersSectionProps {
  cfg: ModelsConfig
  persist: (next: ModelsConfig) => Promise<void>
  onFetch: () => void
}

function ProvidersSection({ cfg, persist, onFetch }: ProvidersSectionProps) {
  // Staged 副本 — 编辑不立即写盘, 点"保存"才 persist.
  const [staged, setStaged] = useState<ModelProvider[]>(cfg.providers)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStaged(cfg.providers)
    setDirty(false)
  }, [cfg.providers])

  const update = (id: string, patch: Partial<ModelProvider>) => {
    setStaged(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
    setDirty(true)
  }

  const add = () => {
    setStaged(prev => [
      ...prev,
      { id: createUUID(), kind: 'openai', baseURL: '', apiKey: '' }
    ])
    setDirty(true)
  }

  const remove = (id: string) => {
    setStaged(prev => prev.filter(p => p.id !== id))
    setDirty(true)
    providerFetchCache.delete(id)
  }

  const save = async () => {
    setSaving(true)
    try {
      // 同时清掉已删 provider 的关联 models.
      const stagedIds = new Set(staged.map(p => p.id))
      const models = cfg.models.filter(m => stagedIds.has(m.provider))
      await persist({ ...cfg, providers: staged, models })
      setDirty(false)
      toast.success('服务商配置已保存')
    } catch (err) {
      toast.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const revert = () => {
    setStaged(cfg.providers)
    setDirty(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>服务商</CardTitle>
              <CardDescription>
                配置 Base URL + API Key. 保存后在"模型" tab 里拉取可用列表.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={add}>
              <Plus className="mr-1 size-3.5" />
              新增
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {staged.length === 0 && (
              <p className="text-sm text-muted-foreground">
                还没有服务商, 点右上"新增"开始.
              </p>
            )}
            {staged.map(p => (
              <ProviderEditor
                key={p.id}
                provider={p}
                onUpdate={patch => update(p.id, patch)}
                onRemove={() => remove(p.id)}
                onFetched={onFetch}
                savedInCfg={cfg.providers.some(x => x.id === p.id)}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {dirty && (
        <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-6 py-3">
          <span className="mr-auto text-xs text-muted-foreground">
            有未保存改动
          </span>
          <Button variant="ghost" size="sm" onClick={revert} disabled={saving}>
            撤销
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 size-3.5" />
            )}
            保存
          </Button>
        </div>
      )}
    </div>
  )
}

interface ProviderEditorProps {
  provider: ModelProvider
  onUpdate: (patch: Partial<ModelProvider>) => void
  onRemove: () => void
  onFetched: () => void
  /** 该 provider 是否已在磁盘 cfg 里 (决定是否允许拉取). */
  savedInCfg: boolean
}

function ProviderEditor({
  provider,
  onUpdate,
  onRemove,
  onFetched,
  savedInCfg
}: ProviderEditorProps) {
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const cached = providerFetchCache.get(provider.id) ?? null

  const doFetch = async () => {
    setFetching(true)
    setFetchError(null)
    try {
      const list = await fetchProviderModels(provider)
      providerFetchCache.set(provider.id, list)
      onFetched()
      if (list.length === 0) {
        setFetchError('provider 返回空列表')
      } else {
        toast.success(`拉到 ${list.length} 个模型, 到 "模型" tab 勾选`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setFetchError(msg)
      toast.error(`拉取失败: ${msg}`)
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center gap-2">
        <Select
          value={provider.kind}
          onValueChange={(v: string) => onUpdate({ kind: v as ProviderKind })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_KIND_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="ghost" size="icon-sm" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Base URL</Label>
          <Input
            placeholder={
              provider.kind === 'ollama'
                ? 'http://localhost:11434'
                : '默认端点 (留空即用官方)'
            }
            value={provider.baseURL ?? ''}
            onChange={e => onUpdate({ baseURL: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">API Key</Label>
          <Input
            type="password"
            placeholder={provider.kind === 'ollama' ? '(不需要)' : 'sk-...'}
            value={provider.apiKey ?? ''}
            onChange={e => onUpdate({ apiKey: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={doFetch}
          disabled={fetching || !savedInCfg}
          title={savedInCfg ? undefined : '请先保存服务商配置'}
        >
          {fetching ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 size-3.5" />
          )}
          {cached ? '重新拉取' : '拉取模型列表'}
        </Button>
        {fetchError && (
          <span className="truncate text-xs text-destructive">{fetchError}</span>
        )}
        {cached && !fetchError && (
          <span className="text-xs text-muted-foreground">
            {cached.length} 个可用
          </span>
        )}
        {!savedInCfg && !cached && (
          <span className="text-xs text-muted-foreground">
            保存后才能拉取
          </span>
        )}
      </div>
    </div>
  )
}

interface ModelsSectionProps {
  cfg: ModelsConfig
  persist: (next: ModelsConfig) => Promise<void>
  cacheVersion: number
}

function ModelsSection({ cfg, persist, cacheVersion }: ModelsSectionProps) {
  // cacheVersion 只是让这个 section 在 fetch 后重渲染 (读 module-level Map)
  void cacheVersion

  const providersWithFetched = useMemo(
    () =>
      cfg.providers
        .map(p => ({
          provider: p,
          fetched: providerFetchCache.get(p.id) ?? null
        }))
        .filter(x => x.fetched !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg.providers, cacheVersion]
  )

  const enabledByProvider = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const model of cfg.models) {
      if (!m.has(model.provider)) m.set(model.provider, new Set())
      m.get(model.provider)!.add(model.name)
    }
    return m
  }, [cfg.models])

  const toggle = (providerId: string, modelId: string) => {
    const set = enabledByProvider.get(providerId)
    const already = set?.has(modelId) ?? false
    let models: ModelEntry[]
    if (already) {
      models = cfg.models.filter(
        m => !(m.provider === providerId && m.name === modelId)
      )
    } else {
      models = [
        ...cfg.models,
        {
          id: createUUID(),
          provider: providerId,
          name: modelId,
          capabilities: ['chat']
        }
      ]
    }
    void persist({ ...cfg, models })
  }

  return (
    <div className="space-y-6 overflow-y-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>启用的模型</CardTitle>
          <CardDescription>
            勾选希望在思维导图 AI 面板里出现的模型 (改动自动保存).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {providersWithFetched.length === 0 && (
            <p className="text-sm text-muted-foreground">
              还没有拉取任何服务商的模型. 到 "服务商" tab 添加并点 "拉取模型列表".
            </p>
          )}
          {providersWithFetched.map(({ provider, fetched }) => {
            const enabled = enabledByProvider.get(provider.id) ?? new Set()
            return (
              <div key={provider.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {kindLabel(provider.kind)}
                    {provider.baseURL && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {provider.baseURL}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {enabled.size} / {fetched!.length}
                  </span>
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-md border bg-muted/30 p-2">
                  {fetched!.map(m => {
                    const on = enabled.has(m.id)
                    return (
                      <label
                        key={m.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors',
                          on ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/60'
                        )}
                      >
                        <Checkbox
                          checked={on}
                          onCheckedChange={() => toggle(provider.id, m.id)}
                        />
                        <span className="flex-1 truncate font-mono">{m.id}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function AboutSection() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>ZoeyMind Desktop</CardTitle>
          <CardDescription>本地思维导图编辑器</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>版本 0.1.0</p>
          <p>数据保存在 <code className="text-xs">~/Documents/ZoeyMind</code></p>
          <p>
            配置文件:{' '}
            <code className="text-xs">&lt;appData&gt;/models.json</code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsDialog
