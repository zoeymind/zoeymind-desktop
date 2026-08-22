import { invoke } from "@tauri-apps/api/core"

export interface ExternalAutomationConfig {
  enabled: boolean
  allowDestructiveEdits: boolean
}

export async function getExternalAutomationConfig(): Promise<ExternalAutomationConfig> {
  return await invoke<ExternalAutomationConfig>("get_external_automation_config")
}

export async function setExternalAutomationConfig(config: ExternalAutomationConfig): Promise<void> {
  await invoke("set_external_automation_config", { config })
}
