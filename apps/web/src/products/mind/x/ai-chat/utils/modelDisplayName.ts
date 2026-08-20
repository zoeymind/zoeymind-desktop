import type { AIModel } from "../hooks/useModelSelector"

export function resolveModelDisplayName(
  modelId: string | undefined,
  models: AIModel[]
): string | undefined {
  if (!modelId) return undefined

  return models.find(
    model => model.configId === modelId || model.id === modelId || model.description === modelId
  )?.name
}
