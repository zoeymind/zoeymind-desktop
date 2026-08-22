# Glossary - Building Great Skills

这是关于如何写好 skills 的 domain model。Skill 的存在，是为了从随机系统中拧出 determinism；根本美德是 **Predictability**，下面每个 term 都是作用于它的杠杆。它是 [`writing-great-skills`](SKILL.md) 的 disclosed reference。

Terms 按轴分组：**Invocation**（skill 如何被触达）、**Information Hierarchy**（内容如何安排）、**Steering**（如何塑造 agent 运行时行为）、**Pruning**（如何保持精瘦）。每个 **failure mode** 都放在治疗它的杠杆旁，并标记为 _failure mode_。

**粗体术语** 在定义中互相引用；按 heading 查找。

## Predictability

Skill 让 agent 每次以同样 _方式_ 行动的程度：同样的 process，不是同样的 output（brainstorming skill 应 _predictably_ diverge；tokens 会变，behavior 不变）。这是其他术语服务的根本美德；cost 和 maintainability 是它的症状，不是 rival。

_Avoid_: consistency, reliability, robustness, output-determinism

## Invocation

Skill 如何被触达，以及你为选择支付的两种 load。

### Model-Invoked

保留 **description** field 的 skill，所以 agent 能看到并自主触发它；用户也仍能输入名称调用它。Model-invocation 总是 _包含_ user reach。它为 discoverability 支付永久 **context load**。其他 skills 也能触达它，因为 description 让它能被 agent 发现。只有当 agent 必须自行触达时才选择它；如果永远只手动触发，就去掉 description，不付 context load。

_Avoid_: ability, tool, capability

### User-Invoked

去掉 agent 可见 **description** 的 skill，只能由人输入名称调用。它用零 **context load** 换取人工记忆成本。因为没有 description，除了人类以外没有任何东西能触达它；其他 skill 也不能触发它。

_Avoid_: procedure, workflow, command

### Description

Skill 的 machine-readable trigger，也是 model-invoked skill 被迫始终加载的 **context pointer**。它的存在本身就是 invocation axis：保留它就是 model-invoked；删除它就是 **user-invoked**。它是 model-invoked skill 的 **context load** 来源。

_Avoid_: frontmatter, summary

### Context Pointer

保存在 agent context 中的一段 reference，命名某个 out-of-context material，并编码何时触达它。**Description** 是顶层 context pointer；指向 disclosed files 的 pointers 是下一层。它的措辞，而不是目标，决定 agent 何时以及多可靠地触达材料。

_Avoid_: link, reference, import

### Context Load

**Model-invoked** skill 对 context window 施加的成本：它的 **description** 始终加载，消耗 tokens 和 attention。**User-invoked** skills 通过没有 description 避开它。

_Avoid_: token cost, context bloat

### Cognitive Load

**User-invoked** skill 对人施加的成本：人必须记住哪些 skills 存在以及何时使用它们。**Model-invocation** 通过 agent discoverability 消除这部分成本。它不是纯粹要最小化的成本；这是 human agency 的价格。

_Avoid_: human index, burden, overhead

### Router Skill

一个 **user-invoked** skill，职责是指出其他 user-invoked skills 以及何时使用它们。它只能提示，不能触发它们。它治疗 user-invoked skills 增多后的 **cognitive load**。

_Avoid_: dispatcher, menu, registry, index, router procedure

### Granularity

Skills 的切分细度。更细的切分会花两种 load 之一：更多 **model-invoked** skills 花 **context load**；更多 **user-invoked** skills 花 **cognitive load**。按 **invocation** 切时，需要一个独立 **leading word**；按 **sequence** 切时，是为了隐藏 **post-completion steps**，避免 premature completion。

_Avoid_: chunking, modularity

## Information Hierarchy

Skill 内容如何安排，以及每块内容在 ladder 上的位置。

### Information Hierarchy

按 agent 需要材料的即时程度对内容排序。Rungs：

- **Steps** - in-file, primary
- **Reference** - in-file, secondary
- **Reference**, disclosed - behind a **context pointer**

没有 **steps** 的 skill 只使用后两层，通常是 flat peer-set，这不是坏味道。Hierarchy 独立于 invocation：skill 可以 model- 或 user-invoked，也可以全 steps、全 reference 或两者都有。

_Avoid_: structure, organization, layout

### Steps

Agent 执行的有序动作。每个 step 都以 **completion criterion** 结束。不是所有 skill 都有 steps；skill 可以全是 steps、全是 **reference**，或两者都有。

_Avoid_: workflow, instructions, choreography

### Reference

Agent 按需查阅的材料：definitions、facts、parameters、examples、conditional instructions。它通过 **context pointers** 触达，是 **progressive disclosure** 的主要候选。

_Avoid_: supporting material, docs, background

### External Reference

位于 skill system 之外的 **Reference**：普通文件，没有 **description**，没有 **steps**，不可调用。它是多个 skills 都能指向的共享 reference home。

_Avoid_: doc, resource, knowledge base

### Progressive Disclosure

把 **reference** 从 `SKILL.md` 移到 **context pointer** 后面，让顶层保持清晰。这主要不是 token 优化，而是保护 **information hierarchy**。通过 **branching** 授权：所有路径都需要的内容内联，只有部分路径需要的内容 disclosed。

_Avoid_: lazy loading, chunking

### Co-location

把 agent 同时需要的材料放在一起：一个概念的 definition、rules 和 caveats 放在同一 heading，而不是散落各处。它是 **Information Hierarchy** 的文件内 companion。

_Avoid_: grouping, clustering, cohesion

### Sprawl

_Failure mode._ Skill 过长，即使每行都 live 且 unique。它伤害 readability、maintainability 和 tokens。治疗方式是 **information hierarchy**：把 **reference** 推到 **context pointers** 后，并按 **branch** 或 sequence 拆分。

_Avoid_: bloat, length, size, verbosity

## Steering

塑造 agent runtime behavior、提升 **Predictability** 的杠杆。

### Branch

Skill 可以被调用的一种不同方式；不同 runs 会沿着不同路径。线性 skill 没有 branch。

_Avoid_: path, case, fork

### Leading Word

一个紧凑概念，也叫 _Leitwort_，已经存在于模型预训练中，agent 会在运行 skill 时用它思考。它用最少 tokens 编码 behavioral principle，例如 _lesson_、_proximal zone of development_、_fog of war_、_tracer bullets_。

Leading word 同时服务 execution 与 invocation：正文中它让 agent 每次遇到该概念都触发同类行为；description 中它让 prompt、docs、codebase 中的 shared language 更容易触发 skill。

_Avoid_: keyword, term, motif

### Completion Criterion

告诉 agent 一段工作完成的条件。它的 **clarity** 抵抗 **premature completion**；它的 **demand** 决定 **legwork**。最强的 criteria 既可检查又 exhaustive。

_Avoid_: done condition, exit condition, stopping rule

### Legwork

Agent 在单个 step 内幕后做的工作：读文件、探索 codebase、修改、挖出所需材料，而不是把问题丢给用户。它受强 **leading word** 和 demanding **completion criterion** 驱动。

_Avoid_: scope, effort, diligence, coverage

### Post-Completion Steps

当前 step 之后的 **steps**。可见时，它们会把 agent 拉向 **premature completion**；防御方式是通过拆分 sequence 把它们隐藏。

_Avoid_: horizon, fog of war, lookahead

### Premature Completion

_Failure mode._ 当前 step 尚未真正完成就结束，因为 agent 注意力滑向 "being done"。它发生在 steps 之间；由 visible **post-completion steps** 与模糊 **completion criterion** 的拉扯产生。先 sharpen criterion；只有当 criterion 不可避免地模糊且确实观察到 rush 时，才隐藏后续 steps。

_Avoid_: premature closure, the rush, rushing, shortcutting

### Negation

_Failure mode._ 用 prohibition 引导：告诉 agent _不要_ 做什么，会把被禁止的 behavior 带进 context，反而让它更容易出现。_Don't think of an elephant_，于是满脑子都是 elephant；_never write verbose comments_，模型刚读到的 pattern 恰恰是 verbosity。Negation 是弱 modifier，会被强烈激活的 concept 压过，因此禁令读起来有一半像是在指示它去做那件事。它的 **leading word** 是 _elephant_：prohibition 带入 frame 的任何东西。修复方法：prompt **positive**，描述目标 behavior（“write one-line comments”），让被禁止的行为根本不被说出。只有某种行为无法用正面措辞表达、必须作为 hard guardrail 时，prohibition 才有存在价值；即使如此，也要配上 positive target，让注意力落到应该怎么做。

_Avoid_: ironic rebound, don't-prompting, the pink elephant

## Pruning

保持 skill 精瘦；每个 remedy 对应一个 failure。

### Single Source of Truth

每个 meaning 只存在于一个权威位置。**Duplication** 是它的违反。

_Avoid_: home, canonical location

### Duplication

_Failure mode._ 同一个 meaning 出现在多个位置。它增加维护成本、消耗 tokens，并把 meaning 在 ladder 上的 prominence 夸大。

_Avoid_: repetition, redundancy

### Relevance

一行是否仍然支撑 skill 的工作。Relevance 问的是它是否与任务相关，不是它是否改变 behavior。

_Avoid_: load-bearing, staleness, freshness

### Sediment

_Failure mode._ stale layers 因为添加看似安全、删除看似有风险而沉积下来。它是缺少 pruning discipline 时的默认命运。

_Avoid_: accretion, bloat, cruft, rot

### No-Op

_Failure mode._ 一条 instruction 没有改变任何行为，因为模型默认就会这么做。测试：它是否改变默认 behavior？Leading word 也可能是 no-op；修法是换一个更强的词，而不是换技术。

_Avoid_: redundant instruction, restating the obvious, belaboring
