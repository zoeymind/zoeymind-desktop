// @ts-nocheck
/**
 * 设置面板 —— Dialog 形式, 采用 @zoeymind/ui SettingsShell 布局
 * (左侧 nav + 右侧 Card 内容), 对齐 AIChatSettingsDialog 视觉风格.
 *
 * 数据源 = <appData>/models.json (OMP 风格明文 JSON, 由 loadModelsConfig 读写).
 *
 * Sections:
 *   - Models (Providers + Models)
 *   - About  (版本 / 品牌)
 */
import { useCallback, useEffect, useState } from 'react'
import { Bot, Info, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  NativeSelect,
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

const PROVIDER_KINDS: ProviderKind[] = [
  'openai',
  'anthropic',
  'openai-compatible',
  'ollama',
  'gemini'
]

type SectionId = 'models' | 'about'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [cfg, setCfg] = useState<ModelsConfig | null>(null)
  const [active, setActive] = useState<SectionId>('models')

  useEffect(() => {
    if (open) void loadModelsConfig().then(setCfg)
  }, [open])

  const persist = useCallback(async (next: ModelsConfig) => {
    setCfg(next)
    await saveModelsConfig(next)
    toast.success('已保存')
  }, [])

  return (
    <SettingsShell
      open={open}
      onOpenChange={onOpenChange}
      title="设置"
      items={[
        { id: 'models', label: '模型', icon: Bot },
        { id: 'about', label: '关于', icon: Info }
      ]}
      activeId={active}
      onActiveChange={id => setActive(id as SectionId)}
    >
      {active === 'models' && cfg && <ModelsSection cfg={cfg} persist={persist} />}
      {active === 'about' && <AboutSection />}
    </SettingsShell>
  )
}

interface ModelsSectionProps {
  cfg: ModelsConfig
  persist: (next: ModelsConfig) => Promise<void>
}

function ProviderCard({
  provider,
  cfg,
  persist,
  onRemove
}: {
  provider: ModelProvider
  cfg: ModelsConfig
  persist: (next: ModelsConfig) => Promise<void>
  onRemove: () => void
}) {
  const [fetching, setFetching] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[] | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const update = (patch: Partial<ModelProvider>) => {
    const providers = cfg.providers.map(p => (p.id === provider.id ? { ...p, ...patch } : p))
    void persist({ ...cfg, providers })
  }

  const doFetch = async () => {
    setFetching(true)
    setFetchError(null)
    try {
      const list = await fetchProviderModels(provider)
      setFetchedModels(list)
      if (list.length === 0) {
        setFetchError('provider 返回空模型列表')
      } else {
        toast.success(`拉到 ${list.length} 个模型`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setFetchError(msg)
      setFetchedModels(null)
      toast.error(`拉取失败: ${msg}`)
    } finally {
      setFetching(false)
    }
  }

  const enabledIds = new Set(
    cfg.models.filter(m => m.provider === provider.id).map(m => m.name)
  )

  const toggleModel = (modelId: string) => {
    const already = enabledIds.has(modelId)
    let models: ModelEntry[]
    if (already) {
      models = cfg.models.filter(m => !(m.provider === provider.id && m.name === modelId))
    } else {
      models = [
        ...cfg.models,
        {
          id: createUUID(),
          provider: provider.id,
          name: modelId,
          capabilities: ['chat']
        }
      ]
    }
    void persist({ ...cfg, models })
  }

  const kindLabel: Record<ProviderKind, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    'openai-compatible': 'OpenAI 兼容',
    ollama: 'Ollama',
    gemini: 'Google Gemini'
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center gap-2">
        <NativeSelect
          value={provider.kind}
          onChange={e => update({ kind: e.target.value as ProviderKind })}
          className="w-40"
        >
          {PROVIDER_KINDS.map(k => (
            <option key={k} value={k}>
              {kindLabel[k]}
            </option>
          ))}
        </NativeSelect>
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
            onChange={e => update({ baseURL: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">API Key</Label>
          <Input
            type="password"
            placeholder={provider.kind === 'ollama' ? '(不需要)' : 'sk-...'}
            value={provider.apiKey ?? ''}
            onChange={e => update({ apiKey: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={doFetch} disabled={fetching}>
          {fetching ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 size-3.5" />
          )}
          {fetchedModels ? '重新拉取' : '拉取模型列表'}
        </Button>
        {fetchError && (
          <span className="text-xs text-destructive truncate">{fetchError}</span>
        )}
        {fetchedModels && (
          <span className="text-xs text-muted-foreground">
            {fetchedModels.length} 个模型 · 已选 {enabledIds.size}
          </span>
        )}
      </div>

      {fetchedModels && fetchedModels.length > 0 && (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded border bg-muted/30 p-2">
          {fetchedModels.map(m => {
            const on = enabledIds.has(m.id)
            return (
              <label
                key={m.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs transition-colors',
                  on ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/60'
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleModel(m.id)}
                  className="size-3.5"
                />
                <span className="flex-1 truncate font-mono">{m.id}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ModelsSection({ cfg, persist }: ModelsSectionProps) {
  const addProvider = () => {
    void persist({
      ...cfg,
      providers: [
        ...cfg.providers,
        { id: createUUID(), kind: 'openai', baseURL: '', apiKey: '' }
      ]
    })
  }

  const removeProvider = (id: string) => {
    void persist({
      ...cfg,
      providers: cfg.providers.filter(p => p.id !== id),
      models: cfg.models.filter(m => m.provider !== id)
    })
  }

  return (
    <div className="space-y-6 p-6 overflow-y-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>模型服务商</CardTitle>
            <CardDescription>
              配置 provider (Base URL + API Key), 然后"拉取模型列表"选择要用哪些
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addProvider}>
            <Plus className="mr-1 size-3.5" />
            新增
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {cfg.providers.length === 0 && (
            <p className="text-sm text-muted-foreground">还没有 provider, 点右上"新增"开始.</p>
          )}
          {cfg.providers.map(p => (
            <ProviderCard
              key={p.id}
              provider={p}
              cfg={cfg}
              persist={persist}
              onRemove={() => removeProvider(p.id)}
            />
          ))}
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
          <div className="flex items-center gap-3">
            <img
              src="/brand/logo-color-light.svg"
              alt="ZoeyMind"
              className="size-10"
              onError={e => {
                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
            <div>
              <CardTitle>ZoeyMind Desktop</CardTitle>
              <CardDescription>本地思维导图, 完全离线可用</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          文件即真相: `.zmind` 是标准 zip 包 (tree.json + view.json + meta.json + preview.png).
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsDialog
