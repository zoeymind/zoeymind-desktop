/**
 * 设置页 —— 只保留模型配置。
 *
 * 数据源 = `<appData>/models.json`（参考 OMP models config 明文 JSON）。
 * 编辑后 `saveModelsConfig` 覆写文件，AI Chat 消费方下次读取即生效。
 *
 * 页面结构：
 *   - Providers 列表：kind (openai / anthropic / openai-compatible / ollama / gemini) + baseURL + apiKey
 *   - Models 列表：provider 外键 + display name + capabilities
 *   - Defaults：chat model / embeddings model
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/shared/app-shared'
import {
  loadModelsConfig,
  saveModelsConfig,
  type ModelsConfig,
  type ModelProvider,
  type ModelEntry,
  type ProviderKind
} from '@/shared/native'
import { Trash2, Plus, ArrowLeft } from 'lucide-react'
import { createUUID } from '@/shared/app-shared'

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
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 rounded hover:bg-muted"
          aria-label="back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-2xl font-semibold">设置 · 模型</h1>
      </div>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Providers</h2>
          <button
            onClick={() =>
              persist({
                ...cfg,
                providers: [
                  ...cfg.providers,
                  { id: createUUID(), kind: 'openai', baseURL: '', apiKey: '' }
                ]
              })
            }
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-sm hover:bg-muted"
          >
            <Plus className="size-3.5" /> 新增
          </button>
        </div>
        <div className="space-y-3">
          {cfg.providers.map((p, idx) => (
            <ProviderRow
              key={p.id}
              value={p}
              onChange={next => {
                const providers = cfg.providers.slice()
                providers[idx] = next
                void persist({ ...cfg, providers })
              }}
              onRemove={() =>
                persist({
                  ...cfg,
                  providers: cfg.providers.filter(x => x.id !== p.id),
                  models: cfg.models.filter(m => m.provider !== p.id)
                })
              }
            />
          ))}
          {cfg.providers.length === 0 && (
            <div className="text-sm text-muted-foreground py-3">
              还没有 provider。点击右上角新增。
            </div>
          )}
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Models</h2>
          <button
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
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-sm hover:bg-muted"
          >
            <Plus className="size-3.5" /> 新增
          </button>
        </div>
        <div className="space-y-3">
          {cfg.models.map((m, idx) => (
            <ModelRow
              key={m.id}
              value={m}
              providers={cfg.providers}
              onChange={next => {
                const models = cfg.models.slice()
                models[idx] = next
                void persist({ ...cfg, models })
              }}
              onRemove={() =>
                persist({
                  ...cfg,
                  models: cfg.models.filter(x => x.id !== m.id),
                  defaults: {
                    chat: cfg.defaults.chat === m.id ? undefined : cfg.defaults.chat,
                    embeddings:
                      cfg.defaults.embeddings === m.id ? undefined : cfg.defaults.embeddings
                  }
                })
              }
            />
          ))}
          {cfg.models.length === 0 && (
            <div className="text-sm text-muted-foreground py-3">
              还没有模型。先添加 provider，再挂模型。
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Defaults</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Chat 默认模型</span>
            <select
              value={cfg.defaults.chat ?? ''}
              onChange={e =>
                persist({
                  ...cfg,
                  defaults: { ...cfg.defaults, chat: e.target.value || undefined }
                })
              }
              className="w-full rounded border bg-background px-2 py-1"
            >
              <option value="">(未选择)</option>
              {cfg.models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Embeddings 默认模型</span>
            <select
              value={cfg.defaults.embeddings ?? ''}
              onChange={e =>
                persist({
                  ...cfg,
                  defaults: { ...cfg.defaults, embeddings: e.target.value || undefined }
                })
              }
              className="w-full rounded border bg-background px-2 py-1"
            >
              <option value="">(未选择)</option>
              {cfg.models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </div>
  )
}

function ProviderRow({
  value,
  onChange,
  onRemove
}: {
  value: ModelProvider
  onChange: (next: ModelProvider) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={value.kind}
          onChange={e => onChange({ ...value, kind: e.target.value as ProviderKind })}
          className="rounded border bg-background px-2 py-1 text-sm"
        >
          {PROVIDER_KINDS.map(k => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          placeholder="Provider id (你自己命名)"
          value={value.id}
          onChange={e => onChange({ ...value, id: e.target.value })}
          className="flex-1 rounded border bg-background px-2 py-1 text-sm"
        />
        <button onClick={onRemove} className="p-1 hover:text-destructive" aria-label="remove">
          <Trash2 className="size-4" />
        </button>
      </div>
      <input
        placeholder="Base URL（openai-compatible / ollama 必填）"
        value={value.baseURL ?? ''}
        onChange={e => onChange({ ...value, baseURL: e.target.value })}
        className="w-full rounded border bg-background px-2 py-1 text-sm"
      />
      <input
        type="password"
        placeholder="API Key"
        value={value.apiKey ?? ''}
        onChange={e => onChange({ ...value, apiKey: e.target.value })}
        className="w-full rounded border bg-background px-2 py-1 text-sm"
      />
    </div>
  )
}

function ModelRow({
  value,
  providers,
  onChange,
  onRemove
}: {
  value: ModelEntry
  providers: ModelProvider[]
  onChange: (next: ModelEntry) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={value.provider}
          onChange={e => onChange({ ...value, provider: e.target.value })}
          className="rounded border bg-background px-2 py-1 text-sm"
        >
          <option value="">(选 provider)</option>
          {providers.map(p => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
        </select>
        <input
          placeholder="Model id (如 gpt-4o / claude-sonnet-4)"
          value={value.name}
          onChange={e => onChange({ ...value, name: e.target.value })}
          className="flex-1 rounded border bg-background px-2 py-1 text-sm"
        />
        <button onClick={onRemove} className="p-1 hover:text-destructive" aria-label="remove">
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}
