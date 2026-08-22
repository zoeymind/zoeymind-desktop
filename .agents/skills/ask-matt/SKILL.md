---
name: ask-matt
description: 询问当前情境适合哪个技能或流程；它是本仓库所有 skills 的路由器。
disable-model-invocation: true
---

# Ask Matt

你不需要记住每个 skill，所以直接问。

**Flow** 是穿过 skills 的一条路径。大多数路径沿着一条 **main flow** 前进，两个 **on-ramps** 会并入它。其他内容要么是 standalone，要么是在下层运行的 vocabulary layer。

## The main flow: idea -> ship

这是大多数工作的路线：你有一个想法，并希望把它构建出来。

1. **`/grill-with-docs`** - 通过访谈打磨想法。有 codebase 时从这里开始：它是 stateful 的，会把学到的内容保存在 `CONTEXT.md` 和 ADRs 中。（没有 codebase？用 `/grill-me`，见 Standalone。两者都运行同一个 `/grilling` primitive；`grill-with-docs` 是会留下文档痕迹的版本。）
2. **分支 - 能否在对话中解决所有问题？** 如果某个问题需要可运行的答案（state、business logic，或必须亲眼看到的 UI），就通过 prototype 绕行，并用 **`/handoff`** 在两个方向桥接（见 Crossing sessions）：
   - **`/handoff`** 导出，然后基于该文件打开 fresh session；
   - **`/prototype`** 用 throwaway code 回答问题；
   - **`/handoff`** 把学到的内容带回来，并在原始 idea thread 中引用它。
3. **分支 - 这是 multi-session build 吗？**
   - **是** -> **`/to-spec`**（把 thread 变成 spec），再用 **`/to-tickets`** 拆成 tracer-bullet tickets，每个 ticket 声明 **blocking edges**。Local tracker 在 `.scratch/<feature>/issues/` 下每 ticket 一个文件，手动按 blockers-first 处理；真实 tracker 用 native blocking links，因此 blockers 已完成的 ticket 都可领取。每 ticket 启动一次 **`/implement`**，并在 tickets 之间**清空 context**。
   - **否** -> 在当前 context window 里直接运行 **`/implement`**。

   无论哪种方式，**`/implement`** 都会在内部驱动 **`/tdd`** 构建每个 issue：一次一个 red-green slice；然后用 **`/code-review`** 收尾，对 diff 做 Standards + Spec 双轴 review，再提交。只想 test-first 构建一个具体 behavior 时，单独用 **`/tdd`**；想按固定点 review branch 或 PR 时，单独用 **`/code-review`**。

### Context hygiene

步骤 1 到 `/to-tickets` 要留在 **同一个未中断的 context window** 中；不要 compact 或 clear，这样 grilling、spec 和 tickets 才能建立在同一组思考之上。之后每个 `/implement` 都从 fresh session 开始，只基于对应 ticket 工作。

限制来自 **[smart zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)**：在该窗口（最新模型大约 120k tokens）内，模型还能保持敏锐推理。如果 session 在 `/to-tickets` 前接近这个区间，不要硬撑降级状态；用 `/handoff`，然后在 fresh thread 中继续。

## On-ramps

起点会生成工作，然后并入 main flow。

- **Bugs 和 requests 堆积** -> **`/triage`**。它通过 triage roles 推进 issues，并产出 agent-ready issues，之后由 **`/implement`** 领取。

  Triage 只用于 **不是你创建的** issues：bug reports、incoming feature requests，以及任何原始进入的内容。`/to-tickets` 产出的 tickets 已经是 agent-ready，不要再 triage。

- **巨大而模糊的 effort——greenfield project 或巨大 feature build，一个 session 装不下** -> **`/wayfinder`**。当从当前位置到 destination 的路还看不见时，它在 issue tracker 上绘制调查 tickets 的 **shared map**，逐个解决，产出 **decisions, not deliverables**，直到 fog 被推开、路径清晰。然后在 **`/to-spec`** 汇入 main flow（如果 effort 后来发现足够小，也可直接进入 **`/implement`**）。`/grill-with-docs` 用于一个 session 能装下的想法，wayfinder 用于装不下的想法。

- **Something's broken** -> **`/diagnosing-bugs`**。用于难处理的问题：第一眼看不出的 bug、间歇性 flake、夹在两个 known-good states 之间的 regression。它在拥有 **tight feedback loop** 前拒绝空想，也就是一个已经能在 _这个_ bug 上变红的命令；然后用 regression test 修复。如果复盘发现真正问题是没有好 seam 能锁住 bug，它会把后续交给 **`/improve-codebase-architecture`**。

## Codebase health

这不是 feature work，而是维护。

- **`/improve-codebase-architecture`** - 有空时运行，保持 codebase 适合 agents 操作。它会暴露 **deepening opportunities**；选择其中一个会生成一个 idea，可以带入 main flow 的 `/grill-with-docs`。它负责找候选项；**`/codebase-design`**（见下文）是你设计已选候选项时使用的工作台。

## Vocabulary underneath

两个 model-invoked references 在其他 skills 下层运行，分别是自己词汇的 single source of truth。问题在于**词语**而不是流程时直接用它们；也可以让上面的 skills 自动拉起它们。

- **`/domain-modeling`** - 打磨项目的 _domain_ language：挑战模糊术语、解决 overloaded word（例如一个 "account" 承担三件事）、把难以逆转的决策记录为 ADR。它是 `/grill-with-docs` 用来保持 `CONTEXT.md` glossary 干净的主动纪律。
- **`/codebase-design`** - deep-module vocabulary（module、interface、depth、seam、adapter、leverage、locality），用于设计 module 的 _shape_：把大量 behavior 放在 clean seam 上的小 interface 后面。`/tdd` 和 `/improve-codebase-architecture` 都使用这套语言。

## Crossing sessions

- **`/handoff`** - 当 thread 快满，或需要分支到另一个 session（例如 `/prototype` session）时，把对话压缩成 markdown 文件。你不会在原地继续，而是 **打开新 session 并引用该文件** 来带过 context。它是 context windows 之间的桥，两个方向都能用。想要 **fresh session** 但又要 **保留当前对话** 时使用。
- **`/compact`**（内置）- 留在 **同一个对话** 中，让早先 turns 被总结。只在阶段之间的明确断点使用；不要在阶段中途 compact，否则 agent 可能迷路。`/handoff` 是分叉；`/compact` 是继续。

## Standalone

完全在 main flow 之外。

- **`/grill-me`** - 与 `/grill-with-docs` 一样的持续访谈，但用于 **没有 codebase** 的情境。它是 stateless 的：不在本地保存内容，也不构建 `CONTEXT.md`。用它来打磨任何不属于 repo 的计划或设计。
- **`/prototype`** - 一个小型 throwaway program，用来回答一个设计问题：这个 state model 感觉对吗，或者这个 UI 应该是什么样。它从第一天起就是 throwaway：保留答案，删除代码。它是 main flow 第 2 步的绕行，但任何难以纸面解决的 design question 都可以直接用它。
- **`/research`** - 把阅读工作委托给 **background agent**：它对照 **primary sources** 调研问题，然后在 repo 中留下带引用的 Markdown 文件。你可以在它阅读时继续工作。产物应带入 `/grill-with-docs` 的 main flow；research 提供思考材料，但不取代思考。
- **`/teach`** - 使用当前目录作为 stateful workspace，跨多个 sessions 学习一个概念。
- **`/writing-great-skills`** - 编写和编辑 skills 的 reference。

## Precondition

**`/setup-matt-pocock-skills`** - 第一次运行 engineering flow 前先执行，用来配置其他 skills 所依赖的 issue tracker、triage labels 和 docs layout。自定义 issue trackers 也可以。
