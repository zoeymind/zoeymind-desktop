/** Mutable identity used to reject completions from superseded chat generations. */
export interface ChatRuntime {
  generation: number
  workspaceId: string | undefined
}
