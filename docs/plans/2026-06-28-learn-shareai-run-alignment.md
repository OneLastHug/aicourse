# AICourse × learn-claude-code 内容对标改造 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 让 `aicourse` 生成出来的课程，不只是“有页面、有卡片、有代码片段”，而是像 `learn-claude-code` 一样，真正做到 **课程拆解准确、章节递进清晰、排版结构稳定、讲解有深度、且能在有限联网下补充高质量资料**。

**Architecture:** 这次改造的主战场不是 UI，而是 **课程内容生产链路**：从 `analyze → curriculum → spine → lesson → validate → translate` 全流程重新校准。核心思路是：先把课程的**单课模板**与**全课递进逻辑**学成 `learn-claude-code` 那种“每课只讲一个机制、每课都有固定叙事骨架、每课都能落到真实源码与教学版对照”的范式；然后再把这种范式写进 `curriculum` / `lessonWrite` / `validate` / `render`。UI 只做承载，不再当这轮改造的中心。

**Tech Stack:** TypeScript pipeline under `src/`, codex CLI driver under `src/codex`, generated course contract in `src/types.ts`, web renderer under `site/`, existing validation stages `validate1/validate2`.

---

## 0. 这次计划基于什么事实

这份计划不是凭印象写的，而是基于我已经实际读过的两边源码：

### 参考仓库 `learn-claude-code` 已核实的关键事实

仓库结构（已读）：
- 根目录直接按章节分目录：`s01_agent_loop` … `s20_comprehensive`
- 每章都有：
  - `code.py`
  - `README.md`
  - `README.en.md`
  - `README.ja.md`
  - `images/`
- 根 README 明确给出：
  - 课程主线
  - 每章 motto
  - 20 节递进关系
  - current track / legacy track 的映射关系

我实际阅读后确认，`learn-claude-code` 最值得学的不是样式，而是 **内容范式**：

1. **每课只讲一个机制**
   - `s01` 讲 agent loop
   - `s05` 讲 todo_write
   - `s20` 再把前面机制重新装回一个完整系统

2. **每课都有固定叙事骨架**
   - `The Problem`
   - `The Solution`
   - `How It Works`
   - `Try It`
   - `What's Next`
   - `Dive into CC Source Code`（通常在 `<details>` 里）

3. **每课都有一句可记忆的金句 / motto**
   - 不是装饰，而是帮助读者把“这一课真正想讲的机制”记住

4. **教学代码与真实源码明确分层**
   - 教学正文先讲简化版 `code.py`
   - 再在 "Dive into CC Source Code" 里说明真实源码多出来的工程细节
   - 不是把真实源码直接糊给读者

5. **章节之间有非常强的“递进承诺”**
   - 本课结尾明确说“现在还缺什么，下一课补什么”
   - 所以读者会形成一条很稳定的阅读路径，而不是一堆独立知识卡片

6. **深入部分不是泛泛而谈，而是结构化对照**
   - 会明确说 teaching version 省略了什么
   - production version 多了什么
   - 为什么教学时要先简化

### 当前 `aicourse` 已核实的事实

`aicourse` 现在已经有这些基础：
- `curriculumPrompt()` 已经要求分层、单机制 lesson、section 结构
- `lessonWritePrompt()` 已经要求：
  - principle / problem / solution
  - diagram
  - howItWorks
  - deepDive
  - deepSource
  - tryIt
  - compare
- `src/types.ts` 已经有：
  - `spine`
  - `deepSource`
  - `compare`
  - `references`
  - `sections`
- `validate1` 已经检查：
  - factual errors
  - poisoning / contamination
  - depth
- `validate2` 已经做：
  - against real repo 的对齐验证
- `CliCodexDriver` 已支持：
  - `extraArgs`
  - `cwd`
  - 大 prompt 走 stdin

也就是说：

> **`aicourse` 不是没有能力，而是“内容生产范式还没有真正学到 learn-claude-code 那种课程感”。**

现在的问题不是“页面还不够花”，而是：
- lesson 之间的递进关系不够强
- 单课排版虽然字段很多，但主次感还不够清楚
- 深入讲解虽然有 `deepDive/deepSource`，但还没有稳定产出“教学版 vs 真实版”的强对照
- references 虽然存在，但没有形成严格的“有限联网、只取高质量资料、以本地代码为主”的使用准则

---

## 1. 本轮改造的第一目标

### 不是 UI 对标，而是“课程质量对标”

本轮优先级明确改成：

1. **课程拆解（怎么分节）**
2. **课程递进（为什么这一节在这一节前面）**
3. **单课排版（每课内部结构固定且有主次）**
4. **讲解深度（讲机制、讲权衡、讲源码、讲教学化简）**
5. **有限联网补充（提高深度，但不能污染内容、不能伤机器）**
6. UI 只是承载这些内容，不是这轮主要矛盾

---

## 2. 对标 learn-claude-code 后，`aicourse` 应该学什么

### 2.1 全课层面：从“知识点集合”升级为“有主线的课程”

目标不是生成 10 篇彼此相关的文章，而是生成一门课。

一门课至少要满足这几点：

1. **有核心 thesis**
   - 例如 `learn-claude-code` 的主线是：
     - agency 来自模型
     - harness 是工程师该构建的载具
     - 每一课只加一个 harness 机制

2. **有累计式 spine**
   - 每一课不是换一个 demo，而是在前一课基础上长出一个机制

3. **有稳定的 lesson ordering rule**
   - 新机制必须只依赖更早课程
   - 先讲“最小闭环”，再讲“复杂性从哪里长出来”

4. **每课结束要为下一课制造动机**
   - 读者必须知道：
     - 当前方法哪里不够
     - 下一课为什么出现

### 2.2 单课层面：从“字段齐全”升级为“叙事强”

`learn-claude-code` 的单课不是字段堆砌，而是非常稳定的教学节奏：

1. **一句金句（motto / principle）**
2. **先用 Problem 建立痛感**
3. **再用 Solution 给最低限度的核心答案**
4. **How It Works 分步拆开，不一下子灌完整代码**
5. **Try It 让读者动手验证**
6. **What's Next 明确下一课的必要性**
7. **Dive into Source Code 讲真实工程差异**

这意味着 `aicourse` 需要从“已有字段”提升到“字段之间的顺序、篇幅、职责被严格定义”。

### 2.3 深入层面：从“多写一点”升级为“真正深入”

真正的深入，不是段落更长，而是能回答：

- 为什么先这样教，而不一开始就讲真实实现？
- 教学 spine 省略了哪些复杂性？
- 真实源码为什么需要这些复杂性？
- 这些复杂性里哪些是本质，哪些是工程性噪声？
- 如果换一种实现，会牺牲什么？

`learn-claude-code` 在这点上很强，因为它反复在做：

> **teaching version ≠ fake version**
>
> teaching version = 把真实系统里最关键的机制抽出来，先讲通，再回头对照真实实现。

这正是 `aicourse` 目前最该补强的地方。

---

## 3. 有限联网查资料：允许，但要收紧边界

你允许 codex 在生成时做有限度联网，我同意，而且这是必要的；但必须把边界写进实现里，而不是只写在口头上。

### 原则

1. **本地代码是第一事实来源**
   - 所有关于 repo 行为、函数、文件、控制流的结论，必须以本地代码为准
   - 外网资料不能覆盖本地代码事实

2. **联网只补三类东西**
   - 官方文档 / 官方博客 / RFC / 论文 / 权威技术说明
   - 行业共识性质的背景知识
   - 历史背景 / 术语定义 / 设计动机

3. **联网不能用来“编造 repo 里没有的实现”**
   - 禁止把网上示例 API 当成本项目真实 API
   - 禁止把别的仓库实现移植成当前仓库的解释

4. **联网要默认低权限、低风险**
   - 只允许 GET/只读检索类动作
   - 不允许登录、执行脚本、下载不明可执行文件、修改系统配置
   - 不允许把外网内容写回本机非工作目录

5. **联网内容要被 validate1 特别审查“污染感”**
   - SEO 文、AI 农场文、营销稿、论坛二手转述要降权或禁用

### 实现方向

这轮计划里，有限联网不做成“完全开放”，而做成：

- prompt 里明确：
  - 可查资料
  - 但只允许高质量只读来源
  - 以官方源优先
- driver / config 里明确：
  - 加一个专门的开关，而不是默认放开所有 `extraArgs`
- validate1 里明确：
  - 对 poisoning / contamination 更严格
  - 对 reference 来源质量做课程级审视

---

## 4. 这轮改造要落到哪些文件

核心文件已经很明确：

### 课程拆解与 lesson 结构
- `src/prompts/curriculum.ts`
- `src/prompts/lessonWrite.ts`
- `src/types.ts`

### 有限联网与 codex 调用边界
- `src/types.ts`
- `src/config.ts`
- `src/index.ts`
- `src/codex/cli-driver.ts`

### 质量兜底
- `src/prompts/validateCorrectness.ts`
- `src/prompts/validateAlignment.ts`
- `src/pipeline/validate.ts`

### 渲染承载
- `site/lib/types.ts`
- `site/app/[locale]/c/[repoId]/page.tsx`
- `site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx`
- 必要时新增少量承载组件

注意：这轮不是“不改站点”，而是 **站点只做承载课程结构，不再把注意力放在花哨交互上**。

---

## 5. 实施任务

### Task 1: 重写课程拆解规则，让 `curriculum` 真正生成“课程主线”

**Objective:** 让 `curriculumPrompt()` 生成的不是一串 topic，而是一门有 thesis、有 spine、有 lesson ordering reason 的课程。

**Files:**
- Modify: `src/prompts/curriculum.ts`
- Modify: `src/types.ts`
- Test: `src/sample/fixtures.ts` 或小仓库实跑验证

**Step 1: 给课程级 contract 增加更强的教学元数据**

在 `src/types.ts` 的 `ZhOutline` / `Outline` 中新增或补强这些字段：

```ts
course: {
  title: ...
  tagline: ...
  thesis: ...
  spine: ...
  audience?: ...
  whyThisOrder?: ...
}
```

其中：
- `thesis` = 这门课真正想让读者带走的核心观点
- `spine` = 这门课一路增长的教学主线
- `whyThisOrder` = 为什么按这个顺序讲

**Step 2: 给 section 增加“层的职责”**

在 section 级增加：

```ts
summary
spine
role
transitionIn
transitionOut
```

含义：
- `role`: 这一层在整门课中的作用
- `transitionIn`: 为什么从上一层进入这一层
- `transitionOut`: 为什么下一层会自然出现

**Step 3: 给 lesson 级拆解增加“递进关系说明”**

在 `ZhOutlineLesson` 增加：

```ts
mechanism
whyNow
missingBefore
nextPressure
```

含义：
- `whyNow`: 为什么这节课现在讲
- `missingBefore`: 上一节还缺了什么
- `nextPressure`: 这一节解决后，又暴露出什么下一节才会解决的问题

**Step 4: 改 `curriculumPrompt()`，显式模仿 learn-claude-code 的递进逻辑**

要求 curriculum agent：
- 每课只讲一个机制
- lesson title 必须是机制名，不是长句
- 先最小闭环，再逐步加复杂性
- 每课都要说明“上一课还缺什么、下一课会补什么”
- section 不是视觉分组，而是认知分层

**Step 5: 验证**

Run: 用一个小 repo 跑到 `curriculum` 阶段
Expected:
- lesson 之间有强顺序理由
- section 不再只是“基础/进阶”空标题
- 每课的 `whyNow/missingBefore/nextPressure` 可读

**Step 6: Commit**

```bash
git add src/prompts/curriculum.ts src/types.ts
git commit -m "feat: strengthen curriculum contract for course-level progression"
```

---

### Task 2: 重写单课模板，让 lesson 真正接近 learn-claude-code 的教学节奏

**Objective:** 让每一课都稳定产出“金句 → 问题 → 解决方案 → 分步机制 → 试一下 → 下一课动机 → 深入源码”的节奏，而不是字段齐全但重心不稳。

**Files:**
- Modify: `src/prompts/lessonWrite.ts`
- Modify: `src/types.ts`
- Test: 重新生成 1~2 节示例课

**Step 1: 给 lesson contract 增加 `whatsNext` 字段**

在 `ZhLesson` / `Lesson` 中新增：

```ts
whatsNext?: string | Bi
```

用于显式承接下一课，而不是把“下一课动机”隐含在正文里。

**Step 2: 给 lesson contract 增加 `teachingNotes` 或 `teachingScope` 字段**

建议增加：

```ts
teachingScope?: string | Bi
```

用于一句话说清：
- 这课刻意只讲什么
- 这课刻意不讲什么

这是 `learn-claude-code` 很强的一点：每章边界清楚。

**Step 3: 重写 `lessonWritePrompt()` 的结构约束**

把当前 prompt 从“字段很多”升级成“职责分工明确”：

- `principle`: 一句能记住的机制金句
- `problem`: 必须制造真实痛感，不许复述标题
- `solution`: 必须短、必须能一眼看懂核心动作
- `howItWorks`: 必须是递进式分步，不允许并列堆步骤
- `tryIt`: 必须是能验证本课机制的最小动作
- `whatsNext`: 必须明确指出下一课为什么存在
- `deepSource`: 必须把“教学简化版 vs 真实实现”讲清楚

**Step 4: 强化 `howItWorks` 的约束**

要求每个 step 回答：
- 这一步做了什么
- 为什么必须先做这一步
- 如果拿掉会怎样

如果有 `spine`：
- 主讲 spine
- 最后再进真实源码

如果没有 `spine`：
- 先讲真实实现里的最小关键路径
- 再讲工程细节

**Step 5: 验证**

Run: 生成 1 节 beginner + 1 节 advanced lesson
Expected:
- 能明显看出 lesson 节奏
- `whatsNext` 能自然引出下一课
- deepSource 不再只是“再解释一遍代码”

**Step 6: Commit**

```bash
git add src/prompts/lessonWrite.ts src/types.ts
git commit -m "feat: reshape lesson template around teaching rhythm and depth"
```

---

### Task 3: 强化“教学版 vs 真实源码”对照，不再只靠一段 deepSource 自由发挥

**Objective:** 把 `learn-claude-code` 最值钱的部分——教学简化与生产实现的对照——做成稳定产物。

**Files:**
- Modify: `src/types.ts`
- Modify: `src/prompts/lessonWrite.ts`
- Modify: `site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx`

**Step 1: 给 lesson 增加结构化 source-diff 字段**

在 `Lesson` / `ZhLesson` 增加：

```ts
sourceCompare?: {
  simplified: string
  real: string
  gaps: Array<{
    dimension: string
    simplified: string
    real: string
    whySimplified: string
  }>
}
```

当前 `deepSource` 依然保留，用于自然语言展开；但 `sourceCompare` 负责稳定结构。

**Step 2: 修改 prompt，要求显式产出 3~5 条 gap**

gap 典型维度：
- error handling
- concurrency
- permissions
- configuration
- lifecycle
- observability
- caching

**Step 3: lesson 页面把这部分单独承载**

不是为了花哨，而是为了让读者一眼看到：
- 教学版讲的是骨架
- 真实版多的是工程层复杂性

**Step 4: 验证**

Run: `npm -w site run build`
Expected: 即使没有新字段，也能 fallback 到旧 `deepSource`；有新字段时渲染更稳定。

**Step 5: Commit**

```bash
git add src/types.ts src/prompts/lessonWrite.ts site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx
git commit -m "feat: structure teaching-vs-real-source comparisons"
```

---

### Task 4: 把 `Try It` 从“顺手给几条命令”升级为“验证本课机制的实验”

**Objective:** 让 `tryIt` 真正承担教学验证职责。

**Files:**
- Modify: `src/prompts/lessonWrite.ts`
- Modify: `src/types.ts`
- Optional Modify: lesson renderer

**Step 1: 给 `tryIt` 增加类型结构**

建议从纯字符串升级为：

```ts
tryIt?: {
  setup?: string[]
  commands: string[]
  observe: string[]
}
```

含义：
- `setup`: 先准备什么
- `commands`: 跑什么
- `observe`: 应该观察到什么

**Step 2: prompt 里要求“每条实验必须对应该课核心机制”**

例如：
- 不允许给与本课主题无关的泛命令
- 必须让用户观察某个现象，而不只是“跑通了”

这点是 `learn-claude-code` 很强的：Try It 是验证机制，不是凑活的 demo。

**Step 3: 验证**

生成一节课，看 `tryIt.observe` 是否具体。

**Step 4: Commit**

```bash
git add src/prompts/lessonWrite.ts src/types.ts
git commit -m "feat: turn try-it into mechanism-focused experiments"
```

---

### Task 5: 强化 lesson 排版主次，让页面承载“教学顺序”而不是仅按字段顺排

**Objective:** 不大改 UI，但要让 lesson 阅读顺序更像教材，而不是 JSON 字段展开器。

**Files:**
- Modify: `site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx`
- Optional Create: `site/components/LessonSection*.tsx`
- Modify: `site/lib/types.ts`

**Step 1: 固定 lesson 页面章节顺序**

推荐顺序：
1. principle
2. teachingScope
3. problem
4. solution
5. howItWorks
6. tryIt
7. deepDive
8. sourceCompare / deepSource
9. whatsNext

**Step 2: 强化 `whatsNext` 的承载**

现在页面底部已有 next link，但缺少“为什么下一课存在”的过渡说明。

要把 `whatsNext` 独立成一段课程承接说明。

**Step 3: 把 `deepSource` 放到更靠后的位置**

先让读者学会机制，再回到真实系统对照。
这就是 `learn-claude-code` 的节奏。

**Step 4: 验证**

Run: `npm -w site run build`
Expected: 阅读顺序更像教材；即便不改美术风格，也能明显感觉内容更稳。

**Step 5: Commit**

```bash
git add site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx site/lib/types.ts
git commit -m "refactor: reorder lesson rendering around teaching flow"
```

---

### Task 6: 把 references 从“可选点缀”升级为“高质量有限联网补充”

**Objective:** 允许 codex 联网，但把来源质量、用途和风险边界写进系统。

**Files:**
- Modify: `src/types.ts`
- Modify: `src/prompts/lessonWrite.ts`
- Modify: `src/prompts/validateCorrectness.ts`
- Modify: `src/prompts/validateAlignment.ts`

**Step 1: 扩展 Reference 类型**

建议改成：

```ts
export interface Reference {
  title: string;
  url: string;
  kind?: "official" | "spec" | "paper" | "blog" | "other";
  whyUsed?: string;
}
```

**Step 2: 在 `lessonWritePrompt()` 写清联网准则**

明确规定：
- 可联网，但只补背景知识 / 官方说明 / 术语 / 设计动机
- 真实代码事实必须来自本地 repo
- 优先级：official docs > RFC/spec > paper > reputable engineering blog
- 禁止低质量 SEO / 聚合站 / AI 农场文风内容

**Step 3: validate1 加强 reference 质量审查**

让 reviewer 明确审：
- 引用是否像权威来源
- 文字是否受低质量网页污染
- 是否把外网概念误投射到本地 repo

**Step 4: validate2 保持“本地代码优先”**

强调：
- 引用了外部资料也不能与 repo 真相冲突

**Step 5: Commit**

```bash
git add src/types.ts src/prompts/lessonWrite.ts src/prompts/validateCorrectness.ts src/prompts/validateAlignment.ts
git commit -m "feat: add source-quality rules for limited web research"
```

---

### Task 7: 给 codex 联网能力加显式配置与安全边界

**Objective:** 让“允许有限联网”成为显式、可控、默认保守的配置，而不是靠 `extraArgs` 暗箱传参。

**Files:**
- Modify: `src/types.ts`
- Modify: `src/config.ts`
- Modify: `src/index.ts`
- Modify: `src/codex/cli-driver.ts`
- Optional Create: `config/repo2learn.config.json`

**Step 1: 在 config 中新增 research 配置**

建议在 `Repo2LearnConfig` 增加：

```ts
research: {
  enabled: boolean;
  mode: "off" | "limited";
  allowedSources?: string[];
  maxReferencesPerLesson?: number;
}
```

默认：

```ts
enabled: false
mode: "off"
```

**Step 2: CLI 暴露显式开关**

在 `src/index.ts` 增加：

```bash
--research limited
```

不要用模糊 flag。

**Step 3: driver 只在 `research.enabled` 时注入相关 `extraArgs`**

具体传什么取决于本机 codex 版本支持什么；计划书里不假定固定参数名，但要求实现时：
- 只允许只读联网检索能力
- 不自动放开危险权限
- 不改变 repo 外目录

**Step 4: 把安全边界写进 prompt**

不仅靠 driver，也靠 prompt 明确：
- 禁止执行外部下载脚本
- 禁止登录/提交/修改系统配置
- 禁止使用非只读网络动作

**Step 5: 验证**

Run:
- `repo2learn <repo> --research limited`
- `repo2learn <repo>`

Expected:
- 前者允许高质量资料补充
- 后者完全本地生成

**Step 6: Commit**

```bash
git add src/types.ts src/config.ts src/index.ts src/codex/cli-driver.ts
git commit -m "feat: add explicit limited-research mode for codex runs"
```

---

### Task 8: 强化 validation，让“深度不足”和“污染式讲解”更难混过去

**Objective:** 既然要允许有限联网，就必须同步提高质量门槛。

**Files:**
- Modify: `src/prompts/validateCorrectness.ts`
- Modify: `src/pipeline/validate.ts`

**Step 1: 把 depth 检查具体化**

不是只问“浅不浅”，而是要 reviewer 看：
- 是否只复述代码
- 是否解释了设计动机
- 是否解释了边界条件
- 是否解释了教学版与真实版的关系
- 是否真正回应了 problem

**Step 2: 增加“课程节奏”检查**

reviewer 要审：
- lesson 是否真的只讲一个机制
- `whatsNext` 是否合理
- `tryIt` 是否真能验证机制

**Step 3: 必要时把 validate2 扩展成 lesson 级 symbol grounding**

如果实现成本可控，让 validate2 不只核对路径/片段，还核对：
- symbol 是否真实存在
- 控制流解释是否对得上

**Step 4: Commit**

```bash
git add src/prompts/validateCorrectness.ts src/pipeline/validate.ts
git commit -m "feat: tighten validation for depth and source contamination"
```

---

### Task 9: render 阶段补课程导航文案，但只服务内容结构

**Objective:** 不搞大 UI 改造，只让课程页更像“教材目录”和“章节阅读器”。

**Files:**
- Modify: `src/pipeline/render.ts`
- Modify: `site/lib/types.ts`
- Modify: `site/app/[locale]/c/[repoId]/page.tsx`
- Modify: `site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx`

**Step 1: 让首页更强调整门课主线**

要显式展示：
- thesis
- spine
- whyThisOrder

**Step 2: 让课程页目录更强调“lesson 是怎么串起来的”**

每节除了标题，再显示：
- mechanism
- whyNow（短版）

**Step 3: lesson 页承载 `whatsNext` 与 `teachingScope`**

这样页面虽然没大改视觉，但教材味会明显增强。

**Step 4: Commit**

```bash
git add src/pipeline/render.ts site/lib/types.ts site/app/[locale]/c/[repoId]/page.tsx site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx
git commit -m "feat: surface course thesis and lesson progression in render output"
```

---

### Task 10: 用参考仓库做定向验收，不再只看 build 成不成功

**Objective:** 用 `learn-claude-code` 的课程范式反过来验 `aicourse` 输出是否真的升级了。

**Files:**
- No fixed file; this is a verification workflow

**Step 1: 选 1 个小型 repo 真实生成课程**

要求：
- lesson 数 8~12
- 有明确架构主线
- 有真实源码可读

**Step 2: 逐项验收课程质量**

检查：
- 每课是否只讲一个机制
- 是否有 `principle`
- `problem` 是否制造痛感
- `solution` 是否足够短且明确
- `howItWorks` 是否递进
- `tryIt` 是否能验证本课机制
- `deepSource/sourceCompare` 是否真正有 teaching vs real 的对照
- `whatsNext` 是否自然引出下一课
- `references` 是否高质量且没污染文风

**Step 3: 对照 `learn-claude-code` 的几节代表课**

建议对照：
- `s01_agent_loop`
- `s05_todo_write`
- `s20_comprehensive`

看的是：
- 课程结构感
- 递进感
- 深度感

不是 UI 相似度。

**Step 4: 回归命令**

Run:

```bash
npm run typecheck
npm run test
npm -w site run build
```

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document content-focused course generation principles"
```

---

## 6. 推荐实施顺序

这次的推荐顺序不是先前那套“导航/页面先行”，而是：

1. Task 1 `curriculum` 主线重构
2. Task 2 `lessonWrite` 节奏重构
3. Task 3 `sourceCompare` 结构化
4. Task 4 `tryIt` 实验化
5. Task 6 `references / limited web rules`
6. Task 7 `research limited` 配置化
7. Task 8 `validation` 收紧
8. Task 9 `render` 承载课程主线
9. Task 10 真实课程验收

原因很简单：

> 这轮的主要矛盾在内容生产，不在页面壳子。

如果内容没变，UI 再调也只是把一般课程包装得更好看；
如果内容变了，即使 UI 只做小调整，课程质量也会明显上来。

---

## 7. 本轮明确不做的事

- 不把主要精力放在像素级对标参考站 UI
- 不优先做 timeline / compare / architecture 独立大页面
- 不允许联网能力默认全开
- 不允许外网资料凌驾于本地源码之上
- 不允许把 `deepSource` 继续当自由散文区
- 不为了“更深”而写更长，但没有结构

---

## 8. 验收标准

完成后，至少满足这些条件：

- [ ] 课程大纲能解释“为什么是这几节、为什么按这个顺序”
- [ ] 每课只讲一个机制，边界清楚
- [ ] lesson 页面阅读顺序明显更像教材，而不是字段堆栈
- [ ] `whatsNext` 真正形成章节递进
- [ ] `tryIt` 能验证本课机制，而不是附送几条命令
- [ ] `deepSource/sourceCompare` 能稳定讲清“教学版 vs 真实实现”
- [ ] 有限联网模式可显式开启/关闭，默认保守
- [ ] 引用来源质量可控，validate 能识别污染/空洞/幻觉
- [ ] `npm run typecheck && npm run test && npm -w site run build` 全通过

---

## 9. 这份计划相对上一版的变化

上一版更偏：
- 顶栏导航
- timeline / architecture / compare 页面
- 多视图 lesson

这一版改成更偏：
- 课程主线设计
- 单课教学模板
- 深入源码对照
- try-it 实验设计
- 高质量有限联网研究
- validate 收紧

也就是你刚才说的那句话的落地版：

> **重点不是 UI，而是课程具体的拆解、排版、和讲解的深入程度。**

---

## 10. 当前状态

这次先只重写计划书，不直接改业务代码。

计划书文件位置仍然是：

```text
/data/project/aicourse/docs/plans/2026-06-28-learn-shareai-run-alignment.md
```

如果下一步你确认，我就不先做 UI，而是直接从：
- `curriculum.ts`
- `lessonWrite.ts`
- `types.ts`
- `validate*.ts`
- `codex driver/config`

这条内容链路开始改。