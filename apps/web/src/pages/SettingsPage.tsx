/**
 * 桌面端设置页 —— 只留 AI 模型配置（models.json）。
 *
 * TODO: 用 tauri-plugin-fs 读写 <appData>/models.json；
 * schema 参考 OMP models config：providers[] { id, kind (openai/anthropic/…), baseURL, apiKey } + defaultModel。
 */
export function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="mb-2 text-2xl font-semibold">设置</h1>
      <p className="text-muted-foreground">模型配置面板待接入。</p>
    </div>
  )
}
