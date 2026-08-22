# UI Prototype

在项目内的**真实路由**上，用 mock hook + 项目现有组件构建**几种差异很大的 UI variations**，通过页面内嵌 filter/toggle 切换（**不走 URL**）。命名、路径、组件结构从第一天就是终态。Winner review 后可能作为长期产品特性并存（多视图偏好），也可以精简；落地只需换 mock hook 内部实现。**清理动作 = 0 到极小**。

如果问题是 logic/state，而不是东西应该长什么样，这是错误分支。使用 [LOGIC.md](LOGIC.md)。

## 核心原则

**视图是永久性的组件，不是探索工具的产物。**

传统 prototype 用 URL param 切换 + winner 定后清理，问题是：
- 命名嵌 "prototype" / "variant" 字眼 —— 让代码看起来是临时的
- 清理是一次显式动作 —— 容易忘、容易腐
- 落地时需要搬迁代码 —— 增加 friction

新做法：
- 视图组件用**产品级命名**（`NotificationBindingCards`、`NotificationEventMatrix`），落地后是它们的最终名字
- 切换器是页面内**产品级的 filter/toggle**（`ToggleGroup` / `Tabs`），不是 URL debug 参数
- 数据源用 **hook 抽象** —— 落地时把 hook 内部实现从 `useState` 换成 tRPC，视图代码零改动
- Winner 决策三种收敛路径，任何一种都轻：

| 选择 | 清理动作 |
|---|---|
| 保留全部视图（作为用户视图偏好特性） | 0 —— 换 hook 内部实现即完成 |
| 保留 2 视图 | 删 1 文件 + Toggle 减 1 项，<5 行 |
| 只保留 1 视图 | 删 N-1 文件 + 拿掉 Toggle，<20 行 |

## When this is the right shape

- "What should this page look like?"
- "I want to see a few options for this dashboard before committing."
- "Try a different layout for the settings screen."
- 任何用户原本要花一天在脑子里比较三个模糊 mockups 的情况。

## Process

### 1. State the question and pick N

默认做 **3 variants**。超过 5 就不再是 radically different，最多 5。在主容器文件顶部 comment 说明每个视图的定位。

### 2. Pick real names, not "Variant A/B/C"

每个视图组件按**结构性质**命名 —— 落地后依然清晰：
- ❌ `VariantA.tsx` / `VariantB.tsx` / `VariantC.tsx`
- ✅ `NotificationBindingCards.tsx` / `NotificationEventMatrix.tsx` / `NotificationEventFirst.tsx`

主容器组件用**最终产品的名字**（覆盖老实现，如果有）：
- ✅ `ProjectNotificationsSection.tsx`

mock 数据模块用 `<domain>.mock.ts` 或 `use<Domain>.mock.ts` 命名 —— 显式挂 `.mock.` 后缀，落地时改一处，全项目 grep 得到，不会漏。

### 3. Mock as a hook

数据源封装成一个 hook，返回稳定 shape：

```ts
// notification-config.mock.ts
export interface UseProjectNotificationConfigResult {
  bindings: Binding[]
  isLoading: boolean
  isSaving: boolean
  add: (input: Omit<Binding, 'id'>) => void
  update: (id: string, patch: Partial<Omit<Binding, 'id'>>) => void
  remove: (id: string) => void
  toggleEvent: (bindingId: string, ev: ProjectNotificationEvent) => void
}

export function useProjectNotificationConfig(workspaceId: string): UseProjectNotificationConfigResult {
  const [bindings, setBindings] = useState(MOCK_INITIAL)
  // ...useState + memoized actions
  return { bindings, isLoading: false, isSaving: false, add, update, remove, toggleEvent }
}
```

落地时改 hook 内部实现为 tRPC，**return shape 保持一致**：

```ts
export function useProjectNotificationConfig(workspaceId: string): UseProjectNotificationConfigResult {
  const q = trpc.project.getNotificationConfig.useQuery({ workspaceId })
  const upsert = trpc.project.upsertNotificationConfig.useMutation()
  return {
    bindings: q.data?.bindings ?? [],
    isLoading: q.isLoading,
    isSaving: upsert.isPending,
    add: (input) => upsert.mutate({ workspaceId, add: input }),
    // ...
  }
}
```

**视图组件不动。**

### 4. Generate radically different variants

起草每个 variant，满足：

- 符合页面目的和 hook data shape。
- **复用项目组件库**（`Card`, `Sheet`, `DataTable`, `Tabs`, `Popover`, `ToggleGroup` 等）。
- 结构不同（layout、information hierarchy、primary affordance）—— 不是颜色/文案微调。

各视图组件 props = hook return type 的子集（`Pick<UseProjectNotificationConfigResult, ...>`）。主容器 `useHook` 一次，spread 给当前视图。

### 5. Wire them in a formally-named container

主容器 import 视图 + hook + ToggleGroup（或 Tabs / SegmentedControl 等产品级切换控件）：

```tsx
export function ProjectNotificationsSection({ workspaceId, ... }) {
  const state = useProjectNotificationConfig(workspaceId)
  const [view, setView] = useState<'cards' | 'matrix' | 'events'>('cards')

  return (
    <div>
      <Header>
        <h2>项目通知</h2>
        <ToggleGroup type="single" value={view} onValueChange={setView}>
          <ToggleGroupItem value="cards">卡片</ToggleGroupItem>
          <ToggleGroupItem value="matrix">矩阵</ToggleGroupItem>
          <ToggleGroupItem value="events">按事件</ToggleGroupItem>
        </ToggleGroup>
      </Header>
      {view === 'cards' && <NotificationBindingCards {...state} />}
      {view === 'matrix' && <NotificationEventMatrix {...state} />}
      {view === 'events' && <NotificationEventFirst {...state} />}
    </div>
  )
}
```

切换器状态**用组件内 state**，不进 URL —— 视图切换是用户偏好、不需要分享；进 URL 反而暴露"这是原型"的味道。

### 6. Hand it over

给用户 URL（**不带任何 variant 参数**）。用户切换视图 review，产出三种决策之一：

- **保留全部** → 现在就是最终形态，落地只换 hook 内部实现
- **保留 1-2** → 删未选文件 + Toggle 减项，落地只换 hook
- **主容器只用一个** → 直接 return 那个视图，删其他文件和 Toggle

### 7. Land it

按决策做 1-3 步：

1. **换 hook 内部实现**（mock → tRPC），return shape 一致
2. **（可选）删未选中的视图组件文件**
3. **（可选）主容器移除 Toggle，直接渲染选中视图**

## Anti-patterns

- **URL 参数 `?variant=`**：把探索性数据暴露到 URL，让代码看起来是临时的、增加落地清理动作。用组件内 state 就够了。
- **命名带 "prototype" / "variant"**：主容器、视图组件、mock 都用**产品终态名字**。
- **视图之间共享 Layout**：共享 `<Header>` 可以；共享 layout 破坏视图差异化。
- **接真后端 mutation**：Read + write 都走 mock hook 的 stub。落地时改 hook 一处。
- **Variants 只在颜色或文案不同**：不是 prototype，是 tweak。3 个视图必须**结构不同**。
- **视图组件里嵌 mock 数据**：mock 只应住在 hook 里；视图组件通过 props 拿到 hook return，**不感知**数据来自哪里。
- **落地时忘换 hook 实现**：mock hook 会一直用 useState 存内存数据 —— 每次刷新页面重置。落地必须替换。**mock 模块用 `.mock.` 文件名后缀** —— 全项目 grep `\.mock\.` 就能找齐。
