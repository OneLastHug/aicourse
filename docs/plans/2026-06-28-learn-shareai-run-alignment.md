# AICourse × learn.shareai.run 对标改造 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 让 `aicourse` 产出的 `course.eitc.top` 从“有课程内容的教程站”升级为更接近 `https://learn.shareai.run` 的“多视角、强信息架构、强交互”的课程产品。

**Architecture:** 这次不先碰生成引擎的大逻辑，先把改造拆成两层：第一层是 **站点信息架构与页面结构**（timeline / version compare / architecture layers / lesson tabs）；第二层是 **生成数据契约补强**（为了支撑上述页面而新增的 outline / lesson 结构）。先做“前端可落地的骨架与路由”，再补 pipeline 和 prompt，让新页面吃到真实数据。

**Tech Stack:** Next.js App Router, React, Tailwind, existing `site/app`, `site/components`, `site/lib/types.ts`, TS pipeline under `src/`.

---

## 0. 当前现状（已核实）

### 已有能力

当前 `aicourse` 已经有这些能力：

- 课程首页：`site/app/[locale]/c/[repoId]/page.tsx`
- lesson 页：`site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx`
- 左侧课程导航：`site/components/Sidebar.tsx`
- 顶部导航：`site/components/TopBar.tsx`
- lesson 级进度条：`site/components/ProgressRail.tsx`
- 步骤模拟器：`site/components/StepSimulator.tsx`
- 生成进度页：`site/app/[locale]/j/[id]/page.tsx`
- 数据契约里已有：`sections`、`archDiagram`、`deepSource`、`compare`、`spine`

### 与 learn.shareai.run 的主要差距

结合当前 `course.eitc.top` 与参考站结构，差距主要不在“有没有正文”，而在 **信息架构层级不够**：

1. **缺少顶层多视角导航**
   - 参考站顶栏有：`Learning Path / Version Compare / Architecture Layers` 这类入口。
   - 当前站点基本只有课程页 + lesson 页，没有 repo 级多视角路由。

2. **缺少 timeline/season 视图**
   - 当前课程首页是卡片网格：`LEARNING PATH · S01 → S12` + lesson cards。
   - 参考站更像“章节时间线 / 连续学习路径”，左栏和正文共同强化顺序感。

3. **lesson 内缺少多标签阅读模式**
   - 参考站 lesson 内通常有 `Learn / Simulate / Source / Deep Dive` 一类阅读入口。
   - 当前页是长文顺排，虽然内容都有，但不利于切换阅读模式。

4. **缺少 architecture layers 独立页面**
   - 当前虽然有 `outline.sections` 和 `archDiagram`，但没有“整门课架构层”页面去组织它们。

5. **缺少 version compare 独立页面**
   - 当前仅有单 lesson 的 compare table。
   - 缺少 repo/course 级“教学 spine vs 真实实现”的总览页。

6. **顶栏产品感不够强**
   - 当前 `TopBar` 只有品牌、语言切换、主题切换。
   - 缺少“课程级导航 + 当前上下文 + 页面切换”。

7. **生成数据虽然已有 section/spine/compare，但还不足以直接支撑多视图**
   - 例如缺少 section 级摘要块、课程级比较数据、lesson 模式摘要、timeline card 所需的短摘要字段。

---

## 1. 改造原则

1. **先搭页面骨架，再补生成契约。**
   不要一开始就重写 prompts；先让站点具备 learn.shareai.run 式的信息架构，再让生成引擎喂数据。

2. **保留现有 URL 与内容资产。**
   现有 `/${locale}/c/${repoId}` 与 `/${locale}/c/${repoId}/lessons/${id}` 不废弃，只扩展新入口。

3. **一份 lesson 内容，多种阅读模式。**
   不复制内容，使用 tabs / segmented controls 在同一份数据上切不同视图。

4. **先做 repo/course 级视图，再做 lesson 微交互。**
   优先级：导航/路由 > 页面结构 > 数据契约 > 动画润色。

5. **不为了对标而引入无数据支撑的空页面。**
   若某个页面暂时没有真实数据，先用受控 fallback，从已有 `outline` / `lesson` 计算；等 pipeline 升级后再替换成模型产出。

---

## 2. 目标信息架构

改造后目标路由如下：

```text
/[locale]/c/[repoId]                         -> course landing（默认重定向到 timeline 或保留总览）
/[locale]/c/[repoId]/timeline                -> 学习路径总览（对标 Learning Path）
/[locale]/c/[repoId]/compare                 -> 教学 spine vs 真实实现（对标 Version Compare）
/[locale]/c/[repoId]/architecture            -> 分层架构页（对标 Architecture Layers）
/[locale]/c/[repoId]/lessons/[id]            -> lesson 详情页（内部有 Learn / Simulate / Source / Deep）
```

### 页面职责

| 页面 | 目标 | 数据来源 |
|---|---|---|
| `timeline` | 强化 s01→sN 的学习顺序、section 分层、每课摘要 | `outline.sections`, `outline.lessons` |
| `compare` | 总览教学 spine 与真实仓库实现的差异 | 先由 `lesson.deepSource`, `lesson.compare`, `lesson.spine` 聚合；后续补课程级 compare 数据 |
| `architecture` | 展示整门课的层次结构与系统图 | `outline.archDiagram`, `outline.sections` |
| `lesson` | 用 tab 化阅读模式提升可读性 | `lesson.*` 现有字段 + 少量新字段 |

---

## 3. 实施任务

### Task 1: 新增 course 级二级导航模型

**Objective:** 定义 course 级顶栏导航，让课程不再只有单页/单视图。

**Files:**
- Modify: `site/components/TopBar.tsx`
- Create: `site/components/CourseNav.tsx`
- Test: 手工验证课程页顶部导航

**Step 1: 提取课程导航组件**

在 `site/components/CourseNav.tsx` 新建一个纯展示组件，接收：

```ts
{
  locale: Locale;
  repoId: string;
  current: "overview" | "timeline" | "compare" | "architecture";
}
```

渲染 4 个入口：
- Overview
- Learning Path
- Version Compare
- Architecture Layers

**Step 2: 在 TopBar 中为课程上下文预留插槽**

让 `TopBar` 支持可选 props：

```ts
courseNav?: React.ReactNode;
```

首页不传；课程相关页面传入。

**Step 3: 验证顶部导航不破坏首页**

Run: `npm -w site run build`
Expected: build 通过；首页仍正常。

**Step 4: Commit**

```bash
git add site/components/TopBar.tsx site/components/CourseNav.tsx
git commit -m "feat: add course-level top navigation shell"
```

---

### Task 2: 新增 timeline 页面路由骨架

**Objective:** 把当前课程首页里的 lesson grid 升级为独立 timeline 页面。

**Files:**
- Create: `site/app/[locale]/c/[repoId]/timeline/page.tsx`
- Create: `site/components/TimelineView.tsx`
- Modify: `site/app/[locale]/c/[repoId]/page.tsx`

**Step 1: 抽取当前课程首页的 learning path 主体**

把当前 `course.outline.lessons.map(...)` 卡片区域抽到 `TimelineView.tsx`。

**Step 2: timeline 页面按 section 渲染**

优先使用：

```ts
course.outline.sections
```

每个 section 渲染：
- section 标题
- section summary
- 对应 lesson 列表

没有 `sections` 时 fallback 为单组 `outline.lessons`。

**Step 3: 让课程首页变成总览页或直接跳转**

二选一，默认推荐：
- 保留 `page.tsx` 作为课程总览页，但 CTA 明确引导到 `timeline`
- 或直接 `redirect` 到 `timeline`

本次先保留总览页，避免破坏现有入口。

**Step 4: 验证 timeline 路由**

Run: `npm -w site run build`
Expected: 存在 `/${locale}/c/${repoId}/timeline` 页面，构建通过。

**Step 5: Commit**

```bash
git add site/app/[locale]/c/[repoId]/timeline/page.tsx site/components/TimelineView.tsx site/app/[locale]/c/[repoId]/page.tsx
git commit -m "feat: add timeline course view"
```

---

### Task 3: 新增 architecture 页面

**Objective:** 把已有 `archDiagram + sections` 升级为独立架构层页面。

**Files:**
- Create: `site/app/[locale]/c/[repoId]/architecture/page.tsx`
- Create: `site/components/ArchitectureView.tsx`
- Reuse: `site/components/Mermaid.tsx`

**Step 1: 渲染课程级 Mermaid 架构图**

优先显示：

```ts
course.outline.archDiagram
```

**Step 2: 渲染 section 层级卡片**

每个 section 显示：
- title
- summary
- lesson ids / lesson titles

**Step 3: 给每层补“如何推进 spine”的位置**

当前 `src/types.ts` 里 `ZhOutlineSection` 有 `spine`，但站点侧 `site/lib/types.ts` 没有对应字段。

本 task 先留 UI 占位，不改 pipeline；下一阶段补契约。

**Step 4: 验证页面**

Run: `npm -w site run build`
Expected: 构建通过，`architecture` 页面可访问。

**Step 5: Commit**

```bash
git add site/app/[locale]/c/[repoId]/architecture/page.tsx site/components/ArchitectureView.tsx
git commit -m "feat: add architecture layers page"
```

---

### Task 4: 新增 compare 页面

**Objective:** 提供课程级“教学 spine vs 真实实现”的总览页，而不是把 compare 散落在 lesson 内。

**Files:**
- Create: `site/app/[locale]/c/[repoId]/compare/page.tsx`
- Create: `site/components/CompareOverview.tsx`
- Reuse: `site/components/CompareTable.tsx`

**Step 1: 先做聚合版 compare**

不等待 pipeline 新字段，先从现有 lesson 数据计算：
- 若 `lesson.compare.rows.length > 0`，取前 1~3 行做 lesson 摘要
- 若 `lesson.deepSource` 存在，标记该课有真实源码对照
- 若 `lesson.spine` 存在，标记该课有教学 spine

**Step 2: compare 页面按 lesson 渲染折叠卡**

每个 lesson 一张 card：
- 标题
- 是否有 spine / source compare
- 一张小 compare table
- 跳转到 lesson source/deep 区块

**Step 3: 后续契约升级预留接口**

组件 props 先设计成可接 `courseCompare?: ...`，当前用聚合 fallback。

**Step 4: 验证页面**

Run: `npm -w site run build`
Expected: compare 页面可访问。

**Step 5: Commit**

```bash
git add site/app/[locale]/c/[repoId]/compare/page.tsx site/components/CompareOverview.tsx
git commit -m "feat: add course compare overview page"
```

---

### Task 5: lesson 页改成多模式阅读

**Objective:** 把当前长文 lesson 改成更接近 learn.shareai.run 的分模式阅读。

**Files:**
- Modify: `site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx`
- Create: `site/components/LessonTabs.tsx`
- Create: `site/components/LessonLearnView.tsx`
- Create: `site/components/LessonSourceView.tsx`
- Create: `site/components/LessonDeepView.tsx`

**Step 1: 定义 tabs**

推荐四个模式：
- Learn
- Simulate
- Source
- Deep Dive

映射关系：

| Tab | 现有内容 |
|---|---|
| Learn | problem / solution / diagram / principle |
| Simulate | StepSimulator / spine changes / tryIt |
| Source | deepSource / references / real source compare |
| Deep Dive | deepDive / compare / what’s next |

**Step 2: 先做 query-param 控制，而不是复杂客户端状态**

使用：

```text
?tab=learn
?tab=simulate
?tab=source
?tab=deep
```

这样 SSR 简单、可分享链接。

**Step 3: 抽组件，减少 `page.tsx` 体积**

把当前 lesson 页按视图拆开，`page.tsx` 负责：
- 读数据
- 解析 tab
- 渲染头部 + tabs + 对应视图

**Step 4: 验证旧内容都还在**

Run: `npm -w site run build`
Expected: lesson 内容未丢，只是重组。

**Step 5: Commit**

```bash
git add site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx site/components/LessonTabs.tsx site/components/LessonLearnView.tsx site/components/LessonSourceView.tsx site/components/LessonDeepView.tsx
git commit -m "feat: add tabbed lesson reading modes"
```

---

### Task 6: 扩展站点侧类型契约以支撑 section / architecture 页面

**Objective:** 让站点类型和 pipeline 类型重新对齐，避免 section 信息丢失。

**Files:**
- Modify: `site/lib/types.ts`
- Modify: `src/types.ts`（只在必要时）
- Search: `site/lib/server/*`, `src/pipeline/*`

**Step 1: 对齐 `OutlineSection` 字段**

把站点侧：

```ts
export interface OutlineSection {
  id: string;
  title: Bi;
  summary: Bi;
  lessons: OutlineLesson[];
}
```

升级为支持：

```ts
spine?: Bi;
```

**Step 2: 检查 render 阶段是否已把该字段写入站点内容**

如果 render 阶段已保留，站点直接消费。
如果 render 阶段丢了，再列入后续 task。

**Step 3: 构建验证**

Run: `npm run typecheck && npm -w site run build`
Expected: 类型与构建通过。

**Step 4: Commit**

```bash
git add site/lib/types.ts src/types.ts
git commit -m "refactor: align site types with section spine metadata"
```

---

### Task 7: 补课程级聚合数据（非 prompt 重写，先 render 计算）

**Objective:** 不先动大模型输出，先用 render 阶段从已有 lessons 聚合出 compare / timeline / architecture 所需摘要。

**Files:**
- Modify: `src/pipeline/render.ts`
- Modify: `src/types.ts`
- Modify: `site/lib/types.ts`

**Step 1: 新增 course-level derived metadata**

建议新增：

```ts
courseView?: {
  timeline?: { ... };
  compare?: { ... };
  architecture?: { ... };
}
```

**Step 2: 用已有 lesson 数据派生，而不是要求模型新增输出**

例如：
- timeline card summary ← `theProblem` / `objective`
- compare presence ← `spine`, `deepSource`, `compare.rows`
- architecture section lesson count ← `sections`

**Step 3: 验证兼容旧课程 JSON**

旧数据没有 `courseView` 时页面仍可 fallback 计算。

**Step 4: Commit**

```bash
git add src/pipeline/render.ts src/types.ts site/lib/types.ts
git commit -m "feat: derive course-level view metadata during render"
```

---

### Task 8: 再补 prompt / pipeline，让生成结果更贴近新 UI

**Objective:** 在页面骨架稳定后，再升级 curriculum / lesson prompts，避免 UI 先天缺字段。

**Files:**
- Modify: `src/prompts/curriculum.ts`
- Modify: `src/prompts/lessonWrite.ts`
- Modify: `src/pipeline/*`（按实际需要）

**Step 1: curriculum 增加 section spine 文案约束**

确保每个 section 产出：
- `summary`
- `spine`
- section 的角色定位

**Step 2: lessonWrite 增加多阅读模式友好字段**

补强方向：
- source 视图摘要
- simulate 视图一句话说明
- compare 行更短、更适合 overview

**Step 3: 小仓库重跑一门课程验证 UI**

Run: 选一个样例 repo，重新生成课程
Expected: timeline / compare / architecture / lesson tabs 都能吃到更完整的数据。

**Step 4: Commit**

```bash
git add src/prompts/curriculum.ts src/prompts/lessonWrite.ts src/pipeline
git commit -m "feat: enrich generation contract for multi-view course UI"
```

---

### Task 9: 统一视觉语言，向 learn.shareai.run 靠拢

**Objective:** 在结构正确后，再做样式靠拢，而不是先抠 CSS。

**Files:**
- Modify: `site/app/globals.css`
- Modify: `site/components/*`

**Step 1: 统一顶部导航层次**
- 顶栏高度、分割线、活跃态、次级导航布局

**Step 2: 统一 timeline 卡片风格**
- lesson 编号视觉
- section 间距
- active / hover / current lesson 状态

**Step 3: 统一 lesson header 模板**
- 标题、sNN、difficulty、LOC、tags 的排布

**Step 4: 手工验收**
- 首页
- timeline
- architecture
- compare
- lesson 四个 tab

**Step 5: Commit**

```bash
git add site/app/globals.css site/components
git commit -m "style: align course UI with learn-shareai information design"
```

---

### Task 10: 验收与回归

**Objective:** 确保新增多视图后没有破坏现有生成和阅读链路。

**Files:**
- Test existing routes
- Optional docs update in `README.md`

**Step 1: 路由回归**

验证：
- `/[locale]`
- `/[locale]/j/[id]`
- `/[locale]/c/[repoId]`
- `/[locale]/c/[repoId]/timeline`
- `/[locale]/c/[repoId]/compare`
- `/[locale]/c/[repoId]/architecture`
- `/[locale]/c/[repoId]/lessons/[id]?tab=learn|simulate|source|deep`

**Step 2: 构建回归**

Run:

```bash
npm run typecheck
npm run test
npm -w site run build
```

Expected: 全部通过。

**Step 3: 真实页面验收**

部署后人工检查 `course.eitc.top`：
- 顶部出现课程级多视图导航
- timeline 明显比原课程首页更像 learn.shareai.run
- architecture / compare 不再只是内容碎片
- lesson 支持多模式阅读

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update route map for multi-view course experience"
```

---

## 4. 推荐实施顺序

严格按下面顺序，不要跳：

1. Task 1 `CourseNav`
2. Task 2 `timeline`
3. Task 3 `architecture`
4. Task 4 `compare`
5. Task 5 `lesson tabs`
6. Task 6 `site/lib/types.ts` 对齐
7. Task 7 `render` 聚合数据
8. Task 8 `prompt/pipeline` 补字段
9. Task 9 `style polish`
10. Task 10 `regression + deploy verification`

原因：
- 先把站点骨架搭出来，最容易看到真实差距。
- render 层派生数据比 prompt 重写更稳。
- prompt 改造放后面，避免“模型先产字段，前端还没用上”的空转。

---

## 5. 明确不做的事（本轮）

以下内容本轮不要掺进来：

- 不重做首页生成流程
- 不先碰 AIWIKI
- 不引入新的前端框架或状态管理库
- 不把 lesson 改成全客户端 SPA
- 不为了对标而复制参考站文案/素材
- 不先追求像素级 1:1，先追求信息架构与阅读路径对齐

---

## 6. 验收标准

完成后，满足以下条件才算对标成功：

- [ ] `course.eitc.top` 不再只有“课程总览 + lesson 长文”两层，而是具备多视图课程结构
- [ ] 顶栏能在课程上下文中切换 `Learning Path / Version Compare / Architecture Layers`
- [ ] timeline 页面以 section + 顺序感为核心，而不是单纯卡片墙
- [ ] lesson 页支持按阅读目的切到 `Learn / Simulate / Source / Deep Dive`
- [ ] compare 与 architecture 从零散内容升级为独立页面
- [ ] 旧课程数据在字段不完整时仍能 fallback 渲染，不崩页面
- [ ] `npm run typecheck && npm run test && npm -w site run build` 全通过

---

## 7. 本次计划产出的提交策略

本次先只提交：
- 这份计划书文档

不提交：
- 业务代码改动
- 生成内容重跑结果
- 站点结构改动

这样可以先把“设计共识”锁进仓库，再按任务分批落地。
