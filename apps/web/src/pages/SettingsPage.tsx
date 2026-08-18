// @ts-nocheck
/**
 * 设置页 —— 只保留模型配置。
 * 数据源 = <appData>/models.json（参考 OMP models config 明文 JSON）。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Plus } from 'lucide-react'
import { Button } from '@zoeymind/ui'
import { toast, createUUID } from '@/shared/app-shared'
import {
  loadModelsConfig,
  saveModelsConfig,
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

export function SettingsPage() {
  const navigate = useNavigate()
  const [cfg, setCfg] = useState<ModelsConfig | null>(null)

  useEffect(() => {
    void loadModelsConfig().then(setCfg)
  }, [])

  const persist = useCallback(async (next: ModelsConfig) => {
    setCfg(next)
    await saveModelsConfig(next)
    toast.success('已保存')
  }, [])

  if (!cfg) return null

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="back">
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-semibold">设置 · 模型</h1>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Providers</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              persist({
                ...cfg,
                providers: [
                  ...cfg.providers,
                  { id: createUUID(), kind: 'openai', baseURL: '', apiKey: '' }
                ]
              })
            }
          >
            <Plus className="size-3.5" /> 新增
          </Button>
        </div>
        <div className="space-y-3">
          {cfg.providers.map((p: ModelProvider, idx: number) => (
            <div key={p.id} className="space-y-2 rounded border p-3">
              <div className="flex items-center gap-2">
                <select
                  value={p.kind}
                  onChange={e => {
                    const providers = cfg.providers.slice()
                    providers[idx] = { ...p, kind: e.target.value as ProviderKind }
                    void persist({ ...cfg, providers })
                  }}
                  className="rounded border bg-background px-2 py-1 text-sm"
                >
                  {PROVIDER_KINDS.map(k => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Provider id"
                  value={p.id}
                  onChange={e => {
                    const providers = cfg.providers.slice()
                    providers[idx] = { ...p, id: e.target.value }
                    void persist({ ...cfg, providers })
                  }}
                  className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    persist({
                      ...cfg,
                      providers: cfg.providers.filter((x: ModelProvider) => x.id !== p.id),
                      models: cfg.models.filter((m: ModelEntry) => m.provider !== p.id)
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <input
                placeholder="Base URL"
                value={p.baseURL ?? ''}
                onChange={e => {
                  const providers = cfg.providers.slice()
                  providers[idx] = { ...p, baseURL: e.target.value }
                  void persist({ ...cfg, providers })
                }}
                className="w-full rounded border bg-background px-2 py-1 text-sm"
              />
              <input
                type="password"
                placeholder="API Key"
                value={p.apiKey ?? ''}
                onChange={e => {
                  const providers = cfg.providers.slice()
                  providers[idx] = { ...p, apiKey: e.target.value }
                  void persist({ ...cfg, providers })
                }}
                className="w-full rounded border bg-background px-2 py-1 text-sm"
              />
            </div>
          ))}
          {cfg.providers.length === 0 && (
            <div className="py-3 text-sm text-muted-foreground">还没有 provider。</div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Models</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              persist({
                ...cfg,
                models: [
                  ...cfg.models,
                  {
                    id: createUUID(),
                    provider: cfg.providers[0]?.id ?? '',
                    name: '',
                    capabilities: ['chat']
                  }
                ]
              })
            }
          >
            <Plus className="size-3.5" /> 新增
          </Button>
        </div>
        <div className="space-y-3">
          {cfg.models.map((m: ModelEntry, idx: number) => (
            <div key={m.id} className="flex items-center gap-2 rounded border p-3">
              <select
                value={m.provider}
                onChange={e => {
                  const models = cfg.models.slice()
                  models[idx] = { ...m, provider: e.target.value }
                  void persist({ ...cfg, models })
                }}
                className="rounded border bg-background px-2 py-1 text-sm"
              >
                <option value="">(选 provider)</option>
                {cfg.providers.map((p: ModelProvider) => (
                  <option key={p.id} value={p.id}>
                    {p.id}
                  </option>
                ))}
              </select>
              <input
                placeholder="Model id (gpt-4o / claude-sonnet-4)"
                value={m.name}
                onChange={e => {
                  const models = cfg.models.slice()
                  models[idx] = { ...m, name: e.target.value }
                  void persist({ ...cfg, models })
                }}
                className="flex-1 rounded border bg-background px-2 py-1 text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  persist({
                    ...cfg,
                    models: cfg.models.filter((x: ModelEntry) => x.id !== m.id)
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {cfg.models.length === 0 && (
            <div className="py-3 text-sm text-muted-foreground">还没有模型。</div>
          )}
        </div>
      </section>
    </div>
  )
}

export default SettingsPage
