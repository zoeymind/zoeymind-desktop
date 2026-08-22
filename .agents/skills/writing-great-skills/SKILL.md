---
name: writing-great-skills
description: 编写和编辑优秀 skills 的参考：让技能可预测的词汇和原则。
disable-model-invocation: true
---

Skill 的存在，是为了从随机系统中拧出 determinism。**Predictability** 是根本美德：agent 每次采取相同的 _process_，而不是产出相同的 output。下面所有杠杆都服务于它。

**粗体术语** 在 [`GLOSSARY.md`](GLOSSARY.md) 中定义；需要完整含义时查那里。

## Invocation

两种选择，成本不同：

- **Model-invoked** skill 保留 **description**，所以 agent 可以自主触发它，其他 skills 也能触达它（用户仍可手动输入名称）。它会带来 **context load**：description 每轮都在 context window 中。机制：省略 `disable-model-invocation`，并写 model-facing description，带丰富触发措辞（"Use when the user wants..."、"mentions..."）。
- **User-invoked** skill 把 description 从 agent 触达范围中拿掉：只有用户输入名称时才能调用，其他 skill 也不能调用它。零 context load，但会花 **cognitive load**：_用户_ 必须记得它存在。机制：设置 `disable-model-invocation: true`；`description` 变成人类看到的一行摘要，不放触发列表。

只有当 agent 必须自行找到该 skill，或另一个 skill 必须调用它时，才选择 model-invocation。如果它只会被手动触发，就做成 user-invoked，不付 context load。

当 user-invoked skills 多到用户记不住时，用一个 **router skill** 解决 cognitive load：一个 user-invoked skill，负责命名其他 user-invoked skills 以及何时使用它们。

## Writing the description

Model-invoked **description** 做两件事：说明 skill 是什么，并列出应触发它的 **branches**。每个词都会增加 **context load**，所以 description 比正文更需要修剪：

- **把 skill 的 leading word 放前面。**
- **每个 branch 一个 trigger。** 同义词如果只是重命名单一 branch，就是 **duplication**；合并它。
- **删掉正文已有的 identity。** Description 只保留 triggers，以及必要的 "when another skill needs..." reach clause。

## Information hierarchy

Skill 由两类内容构成：**steps** 与 **reference**。它可以全是 steps、全是 reference，或两者都有。核心决策是把内容放在 **information hierarchy** 的哪一层：

1. **In-skill step** - `SKILL.md` 中的有序动作，是 primary tier。每个 step 以 **completion criterion** 结束。Criterion 要可检查，必要时要 exhaustive。
2. **In-skill reference** - `SKILL.md` 中的定义、规则或事实，按需查阅。
3. **External reference** - 从 `SKILL.md` 推到独立文件中，经 **context pointer** 触达。

强 completion criterion 会驱动充分 **legwork**。把太少内容下放会让顶层膨胀；把太多内容下放会隐藏 agent 实际需要的材料。

**Progressive disclosure** 是把 reference 下移到链接文件中，让顶层保持清晰。Mechanics：skill folder 中的 linked `.md` 文件，用内容命名。多用途 skill 的每种用法都是一个 **branch**：所有 branches 都需要的内容内联，只有部分 branches 需要的内容放到 pointer 后面。**Context pointer** 的措辞，而不是目标文件，决定 agent 何时以及多可靠地触达材料。

**Co-location** 决定内容一旦下放后放在哪里：把一个概念的定义、规则和 caveats 放在同一 heading 下，而不是散落各处。

## When to split

**Granularity** 是 skill 切分粒度。每次切分都会花两种 load 之一，所以只有切分有收益时才切。

- **By invocation** - 当你有一个独立 **leading word** 应自主触发，或另一个 skill 必须触达它时，拆出 **model-invoked** skill。你要为新 description 支付 **context load**，所以独立触达必须值得。
- **By sequence** - 当后续 **steps** 会诱使 agent 急着结束前一步（**premature completion**）时，拆分 step sequence，把后面的内容隐藏起来。

## Pruning

让每个 meaning 都有 **single source of truth**：一个权威位置，行为变化时只改一处。

逐行检查 **relevance**：它是否仍支撑 skill 的工作？

然后逐句寻找 **no-ops**。把每个句子单独做 no-op test；失败时删除整句，而不是只修剪词。要激进；多数失败 prose 应删除，不应重写。

## Leading words

**Leading word** 是一个已经存在于模型预训练中的紧凑概念，agent 会在运行 skill 时用它思考（例如 _lesson_、_fog of war_、_tracer bullets_）。它在文本中反复出现，累积 distributed definition，并用最少 tokens 固定一片 behavior。

它从两方面服务 predictability。正文中它锚定 _execution_；description 中它锚定 _invocation_。当相同词出现在 prompts、docs 和 codebase 中，agent 更容易把 shared language 连到该 skill。

寻找机会把 skills 重构为使用 leading words。三处重复展开的 triad、花一句话绕一个概念的 description，都可能能 **collapse** 成一个 token。例如：

- "fast, deterministic, low-overhead" -> _tight_
- "a loop you believe in" -> _red_

你同时赢得更少 tokens 和更尖锐的 thinking hook。

## Failure modes

- **Premature completion** - 当前 step 尚未真正完成就结束。防御顺序：先 sharpen completion criterion；只有当 criterion 不可避免地模糊且你观察到 rush 时，才通过拆分隐藏 post-completion steps。
- **Duplication** - 同一 meaning 出现在多个地方。它提高维护成本、浪费 tokens，并夸大该 meaning 在 hierarchy 中的重要性。
- **Sediment** - 因为添加看似安全、删除看似有风险而沉积的 stale layers。
- **Sprawl** - skill 太长，即使每一行都 live 且 unique。用 hierarchy 治疗：把 reference 放到 pointers 后，按 branch 或 sequence 拆分。
- **No-op** - 模型默认就会做的 instruction。测试：它是否改变默认 behavior？弱 leading word（如 _be thorough_，当 agent 已经大致 thorough）就是 no-op；修法是换更强的词（如 _relentless_）。
- **Negation** - 用禁止来引导会适得其反：_don't think of an elephant_ 点名了 elephant，让它更容易浮现。应 prompt **positive**：直接说明目标 behavior，让被禁止的行为不进入表述；只有无法正向表达的 hard guardrail 才保留 prohibition，而且仍要配上应该怎么做。
