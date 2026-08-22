---
name: prototype
description: 在承诺方案前构建交互式原型来细化设计。根据问题在两个分支之间选择：用于状态或业务逻辑问题的可运行终端应用，或在项目路由内基于 mock hook 的多个显著不同 UI 变体（视图作为长期特性，非 throwaway）。适用于用户想做原型、检查数据模型或状态机、模拟 UI、探索设计选项，或说 "prototype this"、"let me play with it"、"try a few designs" 时。
---

# Prototype

Prototype 是**用来回答一个问题的探索性 code**。**不是** throwaway —— 它挂在真实项目的路由 / task runner 上，用 mock 数据（封装成 hook）+ 项目现有组件构建。命名、路径、组件结构从第一天就是终态。问题回答后，**清理动作 = 0 到极小** —— 换 hook 内部实现即完成落地。

## Pick a branch

先识别正在回答哪个问题：

- **"Does this logic / state model feel right?"** → [LOGIC.md](LOGIC.md)。构建一个很小的交互式 terminal app，推动 state machine 跑过纸面上难以推理的 cases。
- **"What should this look like?"** → [UI.md](UI.md)。在项目内的**真实路由**上，用 mock hook + 项目现有组件生成几种差异很大的 UI variations，通过页面内 filter/toggle 切换（不走 URL），视图作为长期产品特性存在。

这两个分支会产出非常不同的 artifacts；选错会浪费整个 prototype。如果问题确实模糊且用户不可达，默认选择更匹配周围代码的分支（backend module → logic；page 或 component → UI），并在 prototype 顶部说明假设。

## Rules that apply to both

1. **命名从第一天就是终态。** 主容器、视图组件、mock 模块，**都用产品终态的名字**（`ProjectNotificationsSection`、`NotificationBindingCards`），不出现 "prototype" / "variant" / "sandbox" 字眼。路径也是终态（挂在真实路由上）。
2. **一个命令即可运行。** 使用项目现有 task runner —— 通常就是项目本身的启动命令（`pnpm dev` / `bun dev` 等）。
3. **Mock 通过 hook 抽象，落地只换 hook 内部实现。** 数据源封装成一个 hook（`useProjectNotificationConfig` 之类），返回 `{ 数据, isLoading, isSaving, actions... }`。目前内部用 `useState` 承载 mock；落地时把内部实现从 `useState` 换成对应的 tRPC hooks，**return shape 保持一致 → 视图组件零改动**。
4. **UI 复用项目组件库。** 视图复用项目已有组件（`@zoeymind/ui`、shadcn 等），不引入新 UI 依赖、不重造。
5. **跳过 polish。** 不写 tests，不做超过"能跑起来"所需的 error handling，不做 abstractions。重点是快速学到东西。
6. **暴露 state。** 每次 action（logic）或每次 variant switch（UI）后，打印或渲染完整相关 state，让用户看到发生了什么变化。
7. **完成后过渡：清理动作 = 0 到极小。**
   - **UI**：换 hook 内部实现（mock → tRPC），return shape 不变。视图组件本身不动。Winner 决策可以是"保留全部视图作为用户偏好"，此时**清理动作 = 0**；也可以是"删 1-2 个视图 + Toggle 减项"，改动 <20 行。
   - **Logic**：验证过的 reducer / machine / function set 已经在 portable module 里，接入真实业务代码即可；TUI shell 归档到 throwaway branch（TUI 不是产品，logic 才是）。
   - 在 issue / commit 中 capture verdict（哪个视图/决策胜出、为什么），作为决策痕迹。
