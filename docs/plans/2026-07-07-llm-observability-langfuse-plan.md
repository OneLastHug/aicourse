# AICourse LLM 可观测性调研与 Langfuse 接入计划

日期：2026-07-07

## 1. 结论

建议接入 Langfuse，但不要把实现写死成 Langfuse 专用代码。第一阶段应先在 Python 后端增加一层很薄的 observability adapter，默认 metadata-only，provider 可配置为 `none | langfuse | otlp`。这样可以马上用 Langfuse 看清楚课程生成失败点，同时保留后续切到 Phoenix、MLflow、OpenTelemetry Collector 等方案的余地。

对当前 aicourse 来说，Langfuse 是最合适的第一选择：

- 当前生产生成链路通过 Python 后端调用 `codex exec` 子进程，不是直接用 OpenAI SDK。Helicone 这类网关型工具只能看到底层 API 请求，无法天然知道 `analyze`、`curriculum`、`lesson`、`validate`、`repair`、`translate` 这些业务阶段。因此必须做应用层 trace，Langfuse 的手动 span/generation 模型更匹配。
- Langfuse 覆盖 tracing、prompt management、evaluation、datasets、score analytics，并且 Python SDK 已是 OpenTelemetry-based，支持手动构造 nested observations。
- aicourse 现在最痛的是“生成最后才失败、repair 后又失败、重试成本高”。Langfuse 能把一次 job 拆成根 trace、阶段 span、每次 Codex generation、JSON parse/validation/repair 事件，直接定位失败发生在哪个 label、哪个 lesson、哪个 repair round。
- 它可用 cloud 快速验证，也可 self-host。self-host 有 ClickHouse、Postgres、Redis、S3/Blob Storage 等运维成本，所以第一阶段建议先用 Langfuse Cloud 或低规模 self-host 做 staging 验证。

什么时候不选 Langfuse：

- 如果核心目标是完全 vendor-neutral，优先接 OpenTelemetry Collector 并由内部可观测平台统一承接，则 Phoenix 或 MLflow GenAI 更合适。
- 如果未来迁到 LangChain/LangGraph agent 架构，LangSmith 的自动追踪和 agent 体验会更强。
- 如果核心需求是统一 LLM gateway、fallback、provider routing、限流和请求计费，Helicone 或 LiteLLM gateway 更合适，但它们不应该替代应用层 trace。
- 如果核心目标是企业级 eval/release gate，并且预算和企业采购流程足够，Braintrust 值得评估，但它不是当前最快落地选项。

## 2. 当前 aicourse 生成链路

当前真实生产生成链路在 `backend/app/services/pipeline/run.py`：

```text
ingest
  -> analyze
  -> curriculum
  -> lessons
  -> spine
  -> validate1
  -> repair round 1, if needed
  -> validate2
  -> repair round 2, if needed
  -> translate
  -> final bilingual validation
  -> done
```

关键代码入口：

| 文件 | 当前职责 | 适合记录的观测数据 |
|---|---|---|
| `backend/app/services/jobs.py` | 创建 job，持有 `job_id`、`repo_id`、SSE 进度、最终保存课程 | 根 trace、job 状态、错误、最终 lesson count |
| `backend/app/services/pipeline/run.py` | 管完整 pipeline 和阶段顺序 | stage span、stage duration、repo sha、validation/repair 结果 |
| `backend/app/services/pipeline/call.py` | `codex_json` 调用 Codex、限制并发、JSON parse、失败重试 | parse attempt、parse error、schema error、retry count |
| `backend/app/services/codex_driver.py` | `CliCodexDriver.run` 执行 `codex exec` 子进程 | generation span、model、reasoning effort、duration、timeout、return code、prompt/output length/hash |
| `backend/app/services/pipeline/repair.py` | 针对 validation issue 做局部修复 | repair round、lesson ids、issue count before/after、局部/全局校验结果 |
| `backend/app/services/cache.py` | stage 缓存 | cache hit/miss、cache key hash、cache_bust |
| `backend/app/api/codex.py` | 右侧助手/问答 | 第二阶段单独接入 assistant trace |

第一阶段只做 Python 后端。根目录旧 TypeScript pipeline 和前端 UI 不作为第一批目标，避免扩大改造面。

## 3. 需要解决的问题

从最近的问题看，当前缺的不是普通日志，而是结构化的 LLM workflow 可观测性：

- 失败发生在哪个阶段、哪个 lesson、哪个 CodexCall label，目前需要翻日志推断。
- JSON parse 失败和 schema validation 失败混在一起，难以统计哪个 prompt 最容易出错。
- repair 做了什么、修完还剩多少 issue、是否又重新全局校验，目前缺少可聚合指标。
- 全量重试成本高，但没有足够数据判断哪些失败适合局部 repair、哪些应该从 curriculum 开始重跑。
- 缓存命中、cache_bust、强制重生成对失败率和耗时的影响不可见。
- Codex CLI 不直接返回 token/cost，至少需要先记录 prompt/output 字符数、duration、模型、stage label，用于近似成本分析和性能定位。

目标是把一次生成任务变成如下 trace：

```text
course.generate repo=claude-code job_id=...
  ingest
  analyze
    generation analyze
      json.parse attempt=1 ok
  curriculum
    generation curriculum
  lessons
    lesson s01
      generation lesson:s01
    lesson s02
      generation lesson:s02
  validate1
    validation round=1 passed=false issue_count=3
    repair round=1 lesson_ids=[s02,s07]
      generation repair1:s02
      generation repair1:s07
    validation round=1 scope=global passed=true
  validate2
    validation round=2 passed=true
  translate
    generation translate:outline
    generation translate:s01
  final_validation
  done
```

## 4. 候选方案比较

| 方案 | 适配 aicourse 的结论 | 优势 | 主要风险/不足 |
|---|---|---|---|
| Langfuse | 推荐作为第一阶段默认方案 | LLM tracing、手动 span/generation、prompt management、eval/datasets、self-host、Python/JS SDK、OpenTelemetry-based | full prompt/output 可能泄露源码，需要默认 metadata-only；self-host 生产运维成本不低 |
| Arize Phoenix | 很强的替代方案，适合 vendor-neutral 或自托管优先 | OpenTelemetry/OTLP、OpenInference、tracing/evals/prompts/datasets、可本地运行 | 产品工作流和团队协作体验需要实际试用确认；如果只用 Phoenix，需要自己约束字段和 dashboards |
| MLflow GenAI | 适合已经有 MLflow/Databricks 或想要统一 AI platform 的团队 | 开源、OpenTelemetry GenAI semantic conventions、tracing/eval/prompt registry/AI Gateway | 对当前 aicourse 是偏重的平台引入，短期落地速度不如 Langfuse |
| LangSmith | 未来 LangChain/LangGraph 化时再重点考虑 | Agent/LLM observability、eval、prompt hub、monitoring、LangChain/LangGraph 生态强 | 当前 aicourse 不用 LangChain，手动接入收益不如 Langfuse；self-host/hybrid 主要在 Enterprise |
| Helicone | 不建议作为主 tracing 工具，可作为 gateway/成本层补充 | OpenAI-compatible gateway、provider routing、fallback、requests/cost/sessions/alerts | 主要观测 API 请求，不理解 aicourse 的业务阶段、repair、validation；Codex CLI 子进程下接入也不够直接 |
| Braintrust | 企业 eval/release gate 场景可评估 | tracing、eval、prompt/scorer/dataset、trace-to-eval workflow、混合/自托管企业方案 | 更偏商业/企业平台，短期验证成本高，不是当前最轻路径 |
| OpenLIT/OpenTelemetry Collector | 适合做底层标准化管道 | OTel-native，可接入现有 APM/Grafana/Tempo/Phoenix/MLflow | 单独用时缺少 Langfuse/Phoenix 那类 LLM 产品体验，需要更多自建 dashboards 和 eval 工作流 |

## 5. 推荐架构

建议新增内部 adapter，而不是在业务代码里到处 import Langfuse：

```text
backend/app/services/observability.py

ObservabilityProvider
  NoopProvider
  LangfuseProvider
  OtlpProvider, optional later

TraceContext
  trace_id
  job_id
  repo_id
  repo_url_hash
  repo_sha
  env

public methods
  start_trace(name, metadata)
  start_span(name, metadata)
  start_generation(name, model, input_metadata)
  record_event(name, metadata)
  record_score(name, value, metadata)
  flush()
```

业务代码只依赖 adapter：

```python
async with obs.span("validate1", metadata={"round": 1}):
    issues = validate_zh_course_schema(...)
    obs.event("validation.result", {"passed": not issues, "issue_count": len(issues)})
```

Langfuse provider 内部再映射成 Langfuse `span`、`generation`、`score`。如果后续换 Phoenix/OTLP，业务层不用大改。

## 6. 配置建议

新增配置项放在 `backend/app/core/config.py`：

```text
R2L_OBSERVABILITY_PROVIDER=none        # none | langfuse | otlp
R2L_OBSERVABILITY_ENV=production       # local | staging | production
R2L_OBSERVABILITY_CAPTURE=metadata     # metadata | debug | full
R2L_OBSERVABILITY_SAMPLE_RATE=1.0
R2L_OBSERVABILITY_ERROR_SAMPLE_RATE=1.0
R2L_OBSERVABILITY_FLUSH_TIMEOUT_MS=2000

LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
LANGFUSE_BASE_URL=https://cloud.langfuse.com

OTEL_EXPORTER_OTLP_ENDPOINT=...
OTEL_SERVICE_NAME=aicourse-backend
```

capture mode 语义：

| 模式 | 记录内容 | 推荐环境 |
|---|---|---|
| `metadata` | prompt/output hash、长度、label、model、duration、issue count、error class，不记录正文 | production 默认 |
| `debug` | 只对失败 trace 记录脱敏和截断后的 prompt/output 片段 | staging 或短期生产排障 |
| `full` | 记录完整 prompt/output，仍需脱敏 token/key | 只对明确允许的公开仓库和临时调试使用 |

默认不把 prompt/output 正文发到第三方服务。因为 prompt 里可能包含仓库源码片段，用户可能输入私有仓库，生成内容也可能复现源码结构。

## 7. 分阶段接入计划

### Phase 0：安全策略和字段规范，0.5 天

- 确认生产默认 `R2L_OBSERVABILITY_CAPTURE=metadata`。
- 定义脱敏规则：API key、token、Authorization header、`.env` 风格内容、长源码片段截断。
- 定义高基数字段规则：`repo_url` 不直接作为 tag，可记录 hash；`lesson_id`、`stage`、`label` 可以作为 tag；完整 file path 放 metadata，不放 tag。
- 明确 full capture 只能按 job/repo 临时打开，并在记录里标记 `capture=full`。

### Phase 1：adapter 和 no-op provider，0.5 天

- 新增 `backend/app/services/observability.py`。
- 新增 `ObservabilityProvider` protocol 和 `NoopProvider`。
- 在 settings 增加 `R2L_OBSERVABILITY_*`。
- 所有 observability 调用必须 fail-open。SDK 报错、网络失败、认证失败都不能影响课程生成。
- 增加 unit test：provider=none 时 pipeline 不改变行为。

### Phase 2：根 trace 和 stage spans，1 天

- 在 `JobManager._run` 创建根 trace，因为这里有 `job_id`、`repo_id`、`repoUrl`。
- 扩展 `generate_course` / `run_pipeline` 参数，把 `TraceContext` 传入 pipeline。
- 在 `run_pipeline` 为每个阶段创建 span：`ingest`、`analyze`、`curriculum`、`lessons`、`spine`、`validate1`、`validate2`、`translate`、`final_validation`。
- 根 trace metadata：
  - `job_id`
  - `repo_id`
  - `repo_url_hash`
  - `repo_name`
  - `repo_sha`
  - `cache_bust`
  - `model`
  - `reasoning_effort`
  - `validate_enabled`
  - `translate_with_codex`
  - `course_lesson_count`
  - `app_git_sha`, if available

### Phase 3：Codex generation 和 JSON 重试，1 天

- 在 `CliCodexDriver.run` 包 generation span，记录：
  - `call.label`
  - `model`
  - `reasoning_effort`
  - `cwd`
  - `prompt_chars`
  - `prompt_sha256`
  - `output_chars`
  - `output_sha256`
  - `duration_ms`
  - `timeout_ms`
  - `return_code`
  - `error_type`
- 在 `codex_json` 记录：
  - `attempt`
  - `attempts`
  - `json_parse_ok`
  - `schema_validate_ok`
  - `retry_reason`
  - `model_name`
- 对 `attempt > 1` 的 retry 增加事件，后续可以统计哪些 label 经常需要二次 JSON 修复。

### Phase 4：validation、repair、cache 指标，1 天

- 在 `run_pipeline` 的 validate round 记录：
  - `round`
  - `scope=global`
  - `passed`
  - `issue_count`
  - `issue_types`
- 在 `repair_zh_validation_round` 记录：
  - `round`
  - `attempt`
  - `lesson_ids`
  - `issue_count_before`
  - `issue_count_after_local`
  - `issue_count_after_global`
  - `repair_success`
- repair 结束后必须记录一次同 round 的校验结果。工程行为上，推荐“局部 repair span + 全局终检 score”组合：
  - 局部校验用于快速判断改动 lesson 是否修好。
  - 全局校验用于防止修 A 破 B，作为是否允许进入下一阶段的最终门禁。
- 在 cache 使用处记录 `cache.hit` / `cache.miss` / `cache.bypass`，cache key 只记录 hash。

### Phase 5：Langfuse provider，0.5 到 1 天

- 在 `backend/pyproject.toml` 增加 `langfuse`，固定一个测试通过的版本。
- `LangfuseProvider` 使用环境变量初始化。
- 使用 Langfuse context manager 创建 span/generation。
- 在应用 shutdown 或 job 结束时 flush，flush timeout 不得阻塞主流程太久。
- staging 开启 `provider=langfuse`、`capture=metadata`、`sample_rate=1.0`。

### Phase 6：dashboard 和回归数据集，1 到 2 天

先做 8 个 dashboard/metric：

- job success rate / failure rate
- p50/p95 total generation duration
- p50/p95 duration by stage
- Codex call duration by label
- JSON parse retry rate by label
- validation issue count by round and type
- repair success rate and remaining issue count
- timeout/error rate by model and label

再把历史失败项目和代表性公开仓库沉淀成 eval dataset：

- 以 repo URL + commit sha + expected constraints 作为 dataset item。
- 现有 deterministic validators 作为 code evaluator。
- 先不引入 LLM-as-judge，避免把“校验是否可靠”这个问题再次交给模型。
- CI 或手动脚本跑小样本 regression：`claude-code`、`next.js`、`fastapi`、以及几个旧版本生成失败的仓库。

## 8. Prompt management 策略

不要第一阶段就把 prompts 全部迁进 Langfuse。

原因：

- 当前 prompt 与 Pydantic schema、JSON parse、repair 逻辑强耦合，prompt 版本脱离代码后容易出现“UI 改了 prompt，但 schema 没改”的漂移。
- 现在优先问题是定位失败，不是让非工程人员在线改 prompt。

建议顺序：

1. 第一阶段只把本地 prompt 的 `prompt_name`、`prompt_version`、`prompt_sha256` 记录进 trace。
2. 稳定后，把最频繁迭代的 `curriculum`、`lesson`、`repair` prompt 复制到 Langfuse 做只读对照。
3. 等 eval dataset 和 CI regression 存在后，再考虑让 Langfuse prompt label 驱动 staging prompt。
4. production prompt 仍建议通过代码发布，除非已经有 prompt release gate。

## 9. 隐私和安全风险

必须按“可能处理私有源码”来设计，即使当前大多数输入是公开 GitHub 仓库。

风险：

- prompt 包含 repo tree、文件片段、架构分析，可能泄露私有代码。
- output 是课程内容，可能间接复述源码结构。
- trace metadata 如果直接包含完整 repo URL，也可能暴露客户或内部项目名称。
- LLM observability SDK 或网络异常不应影响生成任务。
- OTel 自动采集可能带来过多 FastAPI/HTTP/DB span，增加成本和噪声。

控制措施：

- production 默认 `capture=metadata`。
- `repo_url` 默认记录 canonical hash，UI 需要可读名时只记录公开仓库 owner/repo 或 repoId。
- prompt/output 正文只在 `debug/full` 模式记录，且做脱敏和长度限制。
- 所有 provider 调用 fail-open。
- sampling 初期 metadata 全量，payload 只对 error trace 或指定 job 打开。
- Langfuse SDK/OpenTelemetry span filter 只导出 aicourse 自定义 LLM spans，避免把基础设施 span 全发出去。

## 10. 验收标准

第一阶段上线后，一个失败 job 必须能回答这些问题：

- 失败在第几个 stage、哪个 `CodexCall.label`、哪个 lesson。
- 是否是 Codex CLI timeout/exit、JSON parse、Pydantic schema、业务 validation、repair 后仍失败。
- repair 前后 issue count 是否下降，局部校验和全局校验分别是什么结果。
- 是否命中缓存，是否是 force regenerate/cache_bust。
- 同一 label 最近 20 次调用的失败率和 p95 耗时。
- 不打开 full capture 时，Langfuse/OTLP 中看不到完整 prompt、源码正文或完整 output。

## 11. 建议实施顺序

最小可用版本：

1. `observability.py` no-op adapter。
2. settings 增加 `R2L_OBSERVABILITY_*`。
3. `JobManager._run` 根 trace。
4. `run_pipeline` stage spans。
5. `CliCodexDriver.run` generation span。
6. `codex_json` parse/retry events。
7. validation/repair result events。
8. Langfuse provider。
9. staging 验证后部署 production metadata-only。

暂缓：

- Prompt management 全量迁移。
- LLM-as-judge。
- 前端 trace。
- 旧 TypeScript pipeline trace。
- Helicone gateway 替换当前 Codex relay。

## 12. 官方资料来源

- Langfuse Observability: https://langfuse.com/docs/observability/overview
- Langfuse SDK overview: https://langfuse.com/docs/observability/sdk/overview
- Langfuse Prompt Management: https://langfuse.com/docs/prompt-management/overview
- Langfuse Evaluation: https://langfuse.com/docs/evaluation/overview
- Langfuse Self-hosting: https://langfuse.com/self-hosting
- Langfuse Pricing: https://langfuse.com/pricing
- Arize Phoenix docs: https://arize.com/docs/phoenix
- Arize Phoenix tracing: https://arize.com/docs/phoenix/tracing/llm-traces
- LangSmith Observability docs: https://docs.langchain.com/langsmith/observability
- LangSmith pricing: https://www.langchain.com/pricing
- Helicone quickstart: https://docs.helicone.ai/getting-started/quick-start
- Helicone OpenAI-compatible endpoints: https://docs.helicone.ai/getting-started/integration-method/openai-proxy
- Helicone pricing: https://www.helicone.ai/pricing
- Braintrust docs/API: https://www.braintrust.dev/docs/api-reference
- Braintrust self-hosting: https://www.braintrust.dev/docs/admin/self-hosting
- MLflow GenAI: https://mlflow.org/docs/latest/genai/
- MLflow OpenTelemetry GenAI semantic conventions: https://mlflow.org/docs/latest/genai/tracing/opentelemetry/genai-semconv/
- OpenTelemetry GenAI semantic conventions notice: https://opentelemetry.io/docs/specs/semconv/gen-ai/
- OpenLIT: https://openlit.io/
- Comet Opik docs: https://www.comet.com/docs/opik
