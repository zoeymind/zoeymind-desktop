declare class BatchExecution {
  has: Record<string, boolean>
  queue: Array<{
    name: string
    fn: () => void
  }>
  nextTick: () => void
  constructor()
  push(name: string, fn: () => void): void
  replaceTask(name: string, fn: () => void): void
  flush(): void
}
export default BatchExecution
