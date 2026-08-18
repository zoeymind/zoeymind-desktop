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
import { Bot, Info, Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  NativeSelect,
  SettingsShell
} from '@zoeymind/ui'
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

function ModelsSection({ cfg, persist }: ModelsSectionProps) {
  return (
    <div className="space-y-6 p-6 overflow-y-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Providers</CardTitle>
            <CardDescription>模型服务商 / API 端点</CardDescription>
          </div>
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
            <Plus className="mr-1 size-3.5" />
            新增
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {cfg.providers.length === 0 && (
            <p className="text-sm text-muted-foreground">还没有 provider。</p>
          )}
          {cfg.providers.map((p, idx) => (
            <div key={p.id} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <NativeSelect
                  value={p.kind}
                  onChange={e => {
                    const providers = cfg.providers.slice()
                    providers[idx] = { ...p, kind: e.target.value as ProviderKind }
                    void persist({ ...cfg, providers })
                  }}
                >
                  {PROVIDER_KINDS.map(k => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </NativeSelect>
                <Input
                  placeholder="Provider id"
                  value={p.id}
                  onChange={e => {
                    const providers = cfg.providers.slice()
                    providers[idx] = { ...p, id: e.target.value }
                    void persist({ ...cfg, providers })
                  }}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    persist({
                      ...cfg,
                      providers: cfg.providers.filter(x => x.id !== p.id),
                      models: cfg.models.filter(m => m.provider !== p.id)
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Input
                placeholder="Base URL (可选)"
                value={p.baseURL ?? ''}
                onChange={e => {
                  const providers = cfg.providers.slice()
                  providers[idx] = { ...p, baseURL: e.target.value }
                  void persist({ ...cfg, providers })
                }}
              />
              <Input
                type="password"
                placeholder="API Key"
                value={p.apiKey ?? ''}
                onChange={e => {
                  const providers = cfg.providers.slice()
                  providers[idx] = { ...p, apiKey: e.target.value }
                  void persist({ ...cfg, providers })
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Models</CardTitle>
            <CardDescription>可用的模型 (关联到某个 provider)</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={cfg.providers.length === 0}
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
            <Plus className="mr-1 size-3.5" />
            新增
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {cfg.models.length === 0 && (
            <p className="text-sm text-muted-foreground">还没有模型。</p>
          )}
          {cfg.models.map((m, idx) => (
            <div key={m.id} className="flex items-center gap-2 rounded-md border p-3">
              <NativeSelect
                value={m.provider}
                onChange={e => {
                  const models = cfg.models.slice()
                  models[idx] = { ...m, provider: e.target.value }
                  void persist({ ...cfg, models })
                }}
              >
                <option value="">(选 provider)</option>
                {cfg.providers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.id}
                  </option>
                ))}
              </NativeSelect>
              <Input
                placeholder="Model id (e.g. gpt-4o, claude-sonnet-4)"
                value={m.name}
                onChange={e => {
                  const models = cfg.models.slice()
                  models[idx] = { ...m, name: e.target.value }
                  void persist({ ...cfg, models })
                }}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  persist({
                    ...cfg,
                    models: cfg.models.filter(x => x.id !== m.id)
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
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
