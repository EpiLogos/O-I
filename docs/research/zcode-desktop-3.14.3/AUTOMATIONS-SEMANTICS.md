# ZCode Desktop 3.14.3 — Scheduled & Off-Peak Automations: Semantics Spec

> Study deliverable of the ZCode desktop RE study (October 2026). Generated
> output of an agent study — reference until adopted by the owner. This is the
> behavior specification the Rust recreation crate was written from
> (`desktop/cradle/reference/zcode-automation-semantics/`). Per-claim evidence:
> `evidence/A2-EVIDENCE.md`; live-store samples: `evidence/A2-SAMPLES.md`.
> A live-verification addendum (2026-10-07) is appended at the end.

# A2 — Scheduled (cron) & Off-Peak (idle) Automations — Semantics Spec Draft

Subject: ZCode desktop app (Electron) v3.14.3. Document-only reverse engineering of
how automations are declared, stored, triggered, dispatched and reported.
Confidence markers: **[H]** high, **[M]** medium, **[L]** low (per-claim evidence in EVIDENCE.md).
Minified bundle identifiers are quoted as observed; most function names survive as
annotations (`a(fn,"name")` / `i(fn,"name")`), so the original names are recoverable.

Code paths below are relative to the extracted tree `/tmp/zcode-re/asar/out/`.

---

## 1. Architecture at a glance **[H]**

Four participants, three processes:

```
renderer (UI: Automations page, off-peak forms)
   │  IPC (zod-typed)
   ▼
main process  ── utilityProcess.fork ──────────────────────────────┐
   │  spawnCronScheduler (serviceName "zcode-cron-scheduler")     │
   │                                                              ▼
   │  messages:                                       scheduler worker (out/scheduler/index.js)
   │   ▲  scheduler-log | scheduler-resource-sample                 20 s tick loop
   │   │  offpeak-active-count                                      │ claimDue
   │   │  cron-dispatch-request | offpeak-dispatch-request ◄────────┘
   │   └── cron-dispatch-result | offpeak-dispatch-result
   │        scheduler-wake | scheduler-dispose
   ▼
host process (out/host/index.js)
   executes CronRun / OffPeakRun:
     - resolves model selection (availability check)
     - creates or resumes a task/session, sends the prompt
     - subscribes terminal outcome → writes run outcome
   OffPeakTaskService: ticket sync loop against the coding-plan server
     POST/GET <origin>/api/v1/off-peak/ticket*
```

- Storage: a single SQLite DB at `<appConfigDir>/v2/tasks-index.sqlite`
  (= `~/.zcode/v2/tasks-index.sqlite` here), opened by both the scheduler worker
  and the host with `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000` **[H]**.
  The scheduler worker is a *separate OS process* (Electron `utilityProcess`) sharing the file **[H]**.
- Single-host semantics: claims are CAS updates on `running`/`claimed_at` inside
  `BEGIN IMMEDIATE` transactions; a stale claim (`claimed_at` older than **10 min**) is
  reclaimed. There is no network lease — claims hold only while this machine's
  processes are alive **[H]**.

---

## 2. Declaration surface

### 2.1 What the user fills in (Automations page, "定时任务", Beta badge) **[H]**

Tabs: 自动化 (Automation) / 工作流 (Workflow). Create/edit form fields
(i18n keys `automations.form.*`, values from `zh-CN` catalog in
`renderer/assets/IntlProvider-BMWo3Clv.js`):

| UI field | i18n label | kind | notes |
|---|---|---|---|
| 任务标题 Title | `form.title.label` | text | placeholder 例如：每日站会摘要 |
| 调度 Schedule | `form.schedule.label` | preset picker + custom repeat editor | presets: 一次性 once, 每小时 hourly, 每天 daily, 每工作日 weekdays, 每周 weekly, 每月 monthly, 自定义 custom (`automations.schedule.*`) |
| custom repeat | `customRepeat.*` | 重复频率 frequency (unit 分钟/小时/天/周/月/年), 每 {interval}, time pickers, 选择星期 weekdays, 按日期/按星期 monthly modes, 结束 ends: 永不结束 / 指定日期 | builds `schedule_rule` |
| 运行时间 preview | `form.schedule.preview` | text | "运行时间：{summary}" — live next-run preview |
| 指令 Prompt | `form.prompt.label` | multiline text | the prompt sent each run |
| 模型 Model | `form.model.label` | model + reasoning tier picker | `model.previewRetry` on load failure |
| 无限重复 Recurring | `form.recurring.label` | toggle, hint: 关闭后，运行固定次数即停止 | recurring=false exposes a run limit |
| 最大运行次数 Max runs | `form.maxRuns.label` | number, placeholder 例如：5 | |
| 状态 Status | `form.status.label` | lifecycle display | |

List/row affordances: 立即运行 run now (`runNowAlreadyRunning` guard message exists),
暂停/继续 pause/resume, 重新启动 restart, 编辑 edit, 删除 delete,
运行历史 history tab (来源 trigger, 触发时间 triggered, 时长 duration, 状态 status,
跳到会话 open session, 删除记录 delete record, pagination, status filter
全部/进行中/已完成/失败), 下次运行 next run line, `runCount` / `runCountLimited`
("已运行 {count}/{max} 次"), `retryQueued` ("第 {attempt} 次重试排队中"),
and the awake hint: **"定时任务仅在电脑处于唤醒状态时运行"** (`runs.awakeHint`) **[H]**.
Error toasts include the 20-automation cap: `automations.error.createLimit`
"最多可保留 {limit} 个定时任务（包含已暂停、已完成和失败任务）…" **[H]**.

Schedule display strings (`automations.schedule.*`) confirm the grammar shown to
users: `每 {interval} {unit}，{time}`, `每 {interval} 小时的第 {time} 分`,
`每 {interval} 个月的 {days} 日`, `每 {interval} 个月的第一个周{day}` (first-weekday monthly),
`每 {interval} 年的 {month} 月 {day} 日` (yearly). **[H]**

### 2.2 IPC contract (zod schemas — normative field list) **[H]**

`automationCreate` (scheduler/index.js + host/index.js, shared contract):
```
title?: string            cronExpr: string (required)
relativeDelayMinutes?: int 1..525600      prompt: string
modelSelection?: {providerId, modelId, options?:{reasoningLevel}}
mode?: enum               targetTaskId?: string     botDeliveryTarget?: object
recurring?: bool          maxRuns?: int > 0
intervalUnit?: minute|hourly|daily|weekly|monthly|yearly   interval?: int 1..200
refinements: intervalUnit⇔interval set together; intervalUnit excludes
relativeDelayMinutes; intervalUnit forces recurring=true and no numeric maxRuns
```
Three creation shapes: **(a)** cron expression, **(b)** one-shot relative delay
(`relativeDelayMinutes`, max 1 year), **(c)** interval-carrier shorthand
(`intervalUnit+interval`, always recurring, unlimited).

`automationUpdate`: any of title/cronExpr/prompt/recurring/maxRuns(nullable)/
intervalUnit/interval; "clearing maxRuns requires recurring=true";
"recurring=true cannot be combined with a numeric maxRuns".

`automationView` (what storage returns to UI): automationId, title, cronExpr,
prompt, modelSelection?, mode?, targetTaskId?, enabled, lifecycleStatus
(`active|completed|failed|paused`), nextRunAt?, lastRunAt?, runCount, recurring,
maxRuns?, scheduleRule?. **Note: `dispatch_status`, `retry_at`, `last_error` are NOT
projected to the view**; the UI renders retry state from run rows instead.

Service methods (host/index.js `~346900`): listAutomations, listAllAutomations,
createAutomation, updateAutomation, deleteAutomation, setAutomationEnabled,
restartAutomation, runAutomationNow → `{status:"queued"|"duplicate"}`,
listAutomationRuns, deleteAutomationRun.

### 2.3 Schedule grammar **[H]**

Two interchangeable carriers, stored together; `schedule_rule` wins if present
(`computeAutomationNextRunAt`: `scheduleRule ? Gx(rule, now) : Hx(cron, now)`).

**schedule_rule** (strict zod schema): `{unit: minute|hourly|daily|weekly|monthly|yearly,
interval: int ≥ 1 (monthly ≤ 1200), hour: 0–23, minute: 0–59, anchorAt: epoch-ms,
weekdays?: int[] 0–6 (0=Sunday), monthDays?: int[] 1–31, months?: int[] 1–12,
monthlyMode?: "date"|"weekday"}`. Semantics (`computeScheduleRuleNextRunAt`,
scheduler/index.js `~860486`):
- `minute`: every `interval` minutes from `anchorAt` (pure millisecond stepping).
- `hourly`: at `:minute` of every `interval`-th hour, anchored.
- `daily`: hour:minute local time, every `interval` days (scan ≤ 36600 days).
- `weekly`: weekdays[] (default `[1]` = Monday), every `interval` weeks,
  Monday-anchored (scan ≤ 5220 weeks).
- `monthly`: `monthlyMode:"weekday"` → nth pattern uses first weekday-of-month
  (`weekdays[0] ?? 1`); else `monthDays[]` (default `[1]`), every `interval` months
  (scan ≤ 1200 months).
- `yearly` (fallback): months[0]/monthDays[0], every `interval` years (scan ≤ 400).

**cron_expr**: 5-field cron evaluated by the embedded **Croner** engine
(distinctive options `legacyMode`, `domAndDow`, `mode: "auto"|"5-part"|…`,
`utcOffset`, `alternativeWeekdays` — scheduler/index.js `~852100`).
`Hx = new Croner(expr).nextRun(new Date(now))`. The app's own parsers
(`parseCronFields`) only accept plain integers and comma lists; `*/N * * * *`
is recognized and converted to a minute-interval rule (`inferMinuteIntervalScheduleRule`).
The UI always generates plain numeric crons. **[M on what exotic cron syntax survives end-to-end]**

**relativeDelayMinutes** → `buildRelativeDelaySchedule`: stored as a one-shot cron
`m h dom mon *` at `now + delay`, plus rule `{unit:"minute", interval:delay, anchorAt:now}`. **[H]**

**Timezone/DST**: all wall-clock arithmetic is plain JS `Date` local time
(`atTime = new Date(y, m, d, hour, minute, 0, 0)`; Croner default timezone = system local).
No explicit TZ per automation; DST "spring forward" gaps fall out of JS Date semantics
(nonexistent times shift forward), "fall back" repeats the first occurrence. **[H on mechanism; L on exact DST-gap behavior — untested]**
Observed sample confirms local-time semantics: cron `0 9 * * 1` fires Mon 09:00
America/Los_Angeles = 16:00 UTC.

---

## 3. Storage — column semantics (tables `automations`, `automation_runs`, `off_peak_tasks`)

DDL identical in the live DB and in code (scheduler/index.js `~791800`, migration
`0001_adopt_task_schema`; per-column roles from `rowToAutomation`/`rowToRun`/`rowToTask` mappers). **[H]**

### automations
| column | role |
|---|---|
| automation_id | `automation-<uuid4>`, PK |
| title / prompt | display + prompt sent each run |
| cron_expr | cron carrier (5-field) |
| schedule_rule | JSON rule carrier (wins over cron) |
| schedule_edited_by_user | set true by the renderer when the user edits a schedule that the rule builder did not generate (renderer sets `scheduleEditedByUser:!0` when the edited cron is not rule-expressible); creation always inserts 0. Informational provenance flag **[M]** |
| model / provider / thought_level | legacy columns; creation writes NULL and `model_selection='null'`; a migration back-fills `model_selection` from legacy triples and canonicalizes model-id casing (migration 0002/0003) |
| model_selection | JSON `{providerId, modelId, options:{reasoningLevel}}`; `'null'` (string) = "unset, use host preferred model" |
| mode | permission mode at dispatch (`build/edit/plan/yolo` enum seen in scheduler; renderer off-peak form uses the same family) |
| workspace_key / workspace_path / workspace_identity | where the run executes; key = path (or identity) |
| target_task_id | optional task binding: run resumes that task instead of creating one; uniqueness per workspace checked by `hasTaskBinding` (`automationCheckTaskBinding` IPC) |
| bot_delivery_target | JSON `{provider: feishu|lark|weixin, botId, providerUserId|chatId, chatType}` — result delivery to an IM bot chat via `botsService.watchAutomationRun` **[M]** |
| location_kind | 'local' at insert (default); 'remote' resolvable at dispatch via a session bound to the workspace **[M]** |
| recurring | 1 = infinite; 0 = bounded by `max_runs` (default 1 → one-shot) |
| max_runs / end_at | stop conditions (see §6) |
| run_count | all dispatched runs (incl. manual) |
| scheduled_run_count | scheduled dispatches only; the counter `max_runs` is checked against **[H]** |
| enabled | 1/0 gate for the due query |
| lifecycle_status | `active` / `paused` / `completed` / `failed` (+ `expired` literal appears twice in bundle but is not produced by any code path we found **[L]**) |
| next_run_at / last_run_at | epoch-ms schedule cursor / last dispatch time |
| running / claimed_at | in-flight claim (CAS pair) |
| dispatch_status | `idle` / `claimed` / `dispatched` / `failed_to_dispatch` |
| dispatch_attempts | consecutive dispatch failures for current slot |
| retry_at | next retry time (epoch-ms), NULL when not retrying |
| last_error | last dispatch failure text (survives give-up; NOT cleared by skip) |
| created_at / updated_at | epoch-ms |

### automation_runs
| column | role |
|---|---|
| run_id | scheduled: `<automation_id>:<scheduled_at>`; manual: `<automation_id>:manual:<uuid>` — PK **[H]** |
| scheduled_at | the slot time (for manual: the trigger time) |
| trigger | `schedule` / `manual` |
| dispatch_status | `claimed` (default) / `dispatched` / `failed_to_dispatch` / `skipped` |
| outcome | terminal session outcome: `running` / `succeeded` / `failed` / `stopped` (UI maps stopped→已停止; see §8) |
| session_id | created/resumed task id → "跳到会话" open-session link |
| error | skip reason or dispatch/session error |
| attempts | claims for this run row (0-based: first claim inserts 0) |
| model_selection | model snapshot fixed at dispatch (`fixRunModelSelection`) |

### off_peak_tasks — see §7.

Migration machinery: `tasks_schema_migration` table, 3 checksummed migrations
(`0001_adopt_task_schema`, `0002_provider_selection`, `0003_official_glm_selection`);
checksum mismatch aborts startup. **[H]**

---

## 4. Trigger loop (cron automations) **[H]**

- Tick: `setInterval(requestTick, 20_000)` (constant `rX=2e4`) plus an immediate
  tick at startup and on `scheduler-wake` messages; a `vk` re-request flag coalesces
  ticks that arrive during a running tick. `dispose` (grace 1500 ms, then kill).
- Per tick, in one worker:
  1. `AutomationRepo.claimDue(now)` — inside `BEGIN IMMEDIATE`:
     a. **end_at expiry**: `SET lifecycle_status='completed', enabled=0, next_run_at=NULL … WHERE enabled=1 AND end_at IS NOT NULL AND end_at < now`.
     b. **stale-claim recovery**: `running=0, claimed_at=NULL WHERE running=1 AND claimed_at <= now − 10 min`.
     c. **due query**: `enabled=1 AND running=0 AND ((retry_at IS NOT NULL AND retry_at ≤ now) OR (retry_at IS NULL AND next_run_at IS NOT NULL AND next_run_at ≤ now))` — served by `idx_automations_due`/`idx_automations_retry`.
     d. **CAS claim** per row: `UPDATE … SET running=1, claimed_at=now, dispatch_status='claimed' WHERE automation_id=? AND running=0` (changes must be 1).
  2. `claimManualRuns` — picks `trigger='manual'` runs still `claimed` whose automation is not running and whose claim went stale (or `attempts=0`).
  3. `OffPeakTaskRepo.claimDue` (§7).
  4. Report off-peak active count to main.
- For each claimed scheduled automation (`handleClaimed`): the slot time is
  `resolveScheduledAt = nextRunAt ?? retryAt ?? now`, run row upserted (`upsertRunClaimed`,
  attempts+1 on conflict), and a `cron-dispatch-request` is posted to main → host.

## 5. Dispatch state machine (automations)

`dispatch_status` values: **idle → claimed → dispatched | failed_to_dispatch** (terminal
back to idle), plus run-row-only **skipped**. Transitions (all in scheduler/index.js):

```
                     create                      claimDue / runNow / claimManualRuns
        ┌──────────────────────────► idle ─────────────────────────────────────┐
        │                                 ▲  │                                 ▼
        │                                 │  │ markDispatchFailed           claimed ──┐
        │                       resetRetry│  │  (attempt<5)                           │ host executes
        │              skipAndReschedule  │  └─── failed_to_dispatch ◄──┐            │ CronRun
        │              (missed slot, §5.1)│        ▲    ▲               │            ▼
        │                                 │        │    │ attempt≥5,    │ give-up: recurring
        │                                 │        │    │ one-shot      │  → idle (attempts=0, next_run_at
        │              markDispatched ────┘────────┘    │  → failed_to_dispatch,     │   advanced, last_error kept)
        │              (success slot)                   │  lifecycle='failed',       │ give-up: one-shot
        │              ▼                                │  enabled=0                 │  → failed (enabled=0)
        │           dispatched (claim released, running=0,                           │
        │           attempts=0, retry=NULL, error=NULL,                              │
        │           next_run_at advanced, run_count++,                               │
        │           scheduled_run_count++, last_run_at=now)                          │
        └─ completion: one-shot done (scheduled_run_count ≥ max_runs ?? 1) or
           next_run_at > end_at → lifecycle='completed', enabled=0, next_run_at=NULL
```

- **Retry/backoff**: `computeRetryAt = min(30s · 2^(n−1), 15 min)` with n =
  `dispatch_attempts` after increment; max **5 attempts** (`Lx=5`), then give-up:
  recurring → `idle` + slot advanced (run row keeps `failed_to_dispatch`, `attempts=4`
  after 5 claims — the counter is 0-based); one-shot → `failed`, `enabled=0`. **[H]**
  Observed: failed runs show `attempts=4` and ≈8.3 min wall time (= 30+60+120+240 s + overhead).
- `failureKind` — `transient` (default) vs `permanent`. In the host, CronRun
  dispatch errors are **always** reported `transient`; only the off-peak path has a
  `permanent` error class. `permanent` → immediately `failed`/`enabled=0`. **[H]**
- `last_error` keeps the last dispatch error text (localized, e.g. the exact string
  thrown by the model-availability check); it is cleared only by `markDispatched`
  and `restart`, **not** by skip. **[H]**
- Claim lifecycle details: manual runs carry a **heartbeat** (`touchManualClaim`
  every 60 s from the host) so a long dispatch isn't reaped; scheduler-side claims
  rely on the 10-minute stale sweep. `releaseClaim`/`releaseManualClaim` on dispose. **[H]**

### 5.1 Late/missed-run semantics — VERDICT **[H]**

`handleClaimed` (scheduler/index.js `~997340`): when a claimed automation's slot is
older than **5 minutes** (`oX = 5·60_000`) and `dispatch_attempts == 0`:

```
skipAndReschedule({reason:"computer_asleep_or_app_not_running", nextRunAt: next slot, finalize: isOneShot})
```
- A run row is written with `dispatch_status='skipped'`, `error=reason`, `attempts=0`
  (the observed sample run #5: scheduled Mon 09:00, recorded 09:32 local — 32 min late).
- The automation advances `next_run_at` to the next occurrence (or completes if one-shot),
  returns to `idle`, resets `dispatch_attempts`. **Coalesce-and-skip: at most one run per
  slot; multiple missed slots collapse into one skipped row for the latest slot only.**
- Within 5 minutes of the slot the run **fires late** (no skip).
- Retrying automations (dispatch_attempts > 0) are exempt from the skip rule — the
  retry path owns the slot.
- Separate, at **creation** time only: a one-shot whose absolute slot just passed
  (< 60 s late) is started immediately; 1–30 min late throws
  `StaleOneShotAutomationScheduleError`; > 30 min is treated as a future schedule. **[H]**

## 6. Lifecycle

- Values: `active`, `paused`, `completed`, `failed` (IPC enum). `enabled` is the
  boolean shadow of the lifecycle for scheduling: pause → `enabled=0, lifecycle='paused'`;
  resume → `active`/`enabled=1` (`setEnabled`). **[H]**
- **restart** (button 重新启动): resets run_count=0, scheduled_run_count=0,
  attempts/retry/error/claim, sets `active`, recomputes `next_run_at` — a fresh
  bounded run. **[H]**
- **One-shot**: `isOneShotAutomation = !recurring && (max_runs ?? 1) <= 1`.
  Completion happens in `markDispatched`: `scheduled_run_count ≥ (max_runs ?? 1)` for
  non-recurring, or the newly computed slot exceeds `end_at` → `completed`, `enabled=0`,
  `next_run_at=NULL`. Manual dispatches increment `run_count` only, so they never
  exhaust `max_runs`. **[H]**
- **runNow**: CAS-claims (`running` 0→1, duplicate runNow returns "duplicate"), inserts
  a manual run (`run_id …:manual:<uuid>`, attempts=1), host dispatches immediately;
  dispatch failure releases the claim and marks the run `failed_to_dispatch`. **[H]**
- Delete: hard DELETE of the row (runs kept; `deleteAutomationRun` removes run rows individually). **[H]**
- Cap: hard limit **20 automations** (count includes paused/completed/failed). **[H]**

## 7. Off-peak queue (idle-time compute)

A separate queue of prompts executed in **server-granted idle compute windows**,
free for Coding-Plan subscribers ("不消耗订阅用户套餐额度") — UI strings + create gating
`offPeak.create.codingPlanOnly`. **[H]**

**Statuses** (IPC enum + repo): `queued` / `paused` / `running` / `completed` /
`failed` / `cancelled` (+ legacy `awaiting_approval`, rewound to `running` at DB
init — semantics unrecoverable from this build **[L]**). Terminal set = completed,
failed, cancelled (`qR`). **[H]**

**Server ticket protocol** (`createOffPeakServerClient`, host/index.js `~1201k`):
HTTP against `<origin>/api/v1/off-peak` with `authorization: Bearer <jwt>` and
`x-coding-plan-api-key` headers; 10 s timeout. Endpoints:
- `GET /ticket/availability` → `{can_take_number, next_take_at}` — the create button's
  quota gate ("额度已用完，可在 {time}后再次创建").
- `POST /ticket {task_id}` → ticket `{ticket_id, state, position?, next_poll_after?}`
  (state ∈ `queued|ready|active|expired|settled|not_found`).
- `POST /ticket/status {ticket_ids ≤100}` → batch states + `next_poll_after`.
- `POST /ticket/:id/settle` → `{settled_at}`.
`server_ticket_id` is this remote ticket id. **[H]**

**Local lifecycle**:
- create: validate (title/prompt/workspacePath/permissionMode ∈ a permissive set),
  resolve+validate model selection, bound-session uniqueness (UNIQUE index
  `idx_off_peak_bound_active`: one non-terminal task per workspace+session — a second
  create for the same session is rejected as `session_bound`), `takeTicket`, insert
  `status='queued'`, `schedulable = (ticket.state==='ready')`, snapshot
  `queue_position`, `next_poll_at = now + next_poll_after·1000`, `registered_at`. **[H]**
- **Sync loop** (`OffPeakTaskService.runSyncCycle`, in the host process): settle
  outbox first; retake tickets for queued rows with no ticket; `batchStatus` for the
  rest and `applyTicketStatus`: `ready` → `schedulable=1` (+scheduler wake),
  `queued` → `schedulable=0` + position, `active` → position=NULL,
  `expired` → retake. Cadence: server `next_poll_after`, default **5 s**, clamped
  [5 s, 5 min]; failure backoff `10s · 2^n` capped 5 min. **[H]**
- **Claim + dispatch**: scheduler tick claims `status='queued' AND schedulable=1
  AND claim_running=0` FIFO (CAS `claim_running` 0→1; stale after 10 min), posts
  `offpeak-dispatch-request` → host `dispatchOffPeakRun`: **requires a server ticket**,
  validates selection (invalid → `permanent`-kind error), builds **request auth from
  the ticket** (`buildRequestAuth(serverTicketId)` — the run is authorized by the
  server-side reservation), then:
  - bound-first-run: resume the bound session, set mode config;
  - resume (after interruption): send the fixed continuation prompt *"Continue the
    previous task from where it left off. The run was interrupted (app restart or
    execution window expired)…"*;
  - init: create task with `deferPersistenceUntilFirstPrompt`, send prompt with
    `modelExecution: {memoryExtraction:"skip", subagents:{foregroundModel:"submission",
    background:"deny"}}`, `offPeakRunType: init|resume`.
  `markRunning` sets `status='running'`, `started_at`, conversation/session ids. **[H]**
- **Settlement**: on terminal outcome — `succeeded→completed`, `stopped→cancelled`,
  else `failed`; `files_changed` = file-change count from the task snapshot
  (`resolveOffPeakFilesChanged`); `failure_reason`; `attempt_count += 1` when a
  dispatch error occurred; then `settled_at` is stamped after the server `settle` ack
  (4xx settles locally; 5xx/outage retries via the outbox). If the ticket expired
  mid-run, the task is requeued for continuation and a new ticket taken. **[H]**
- pause/continue (`queued↔paused`), cancel (terminal + stop running conversation),
  delete (cancel + hard delete), `history_deleted_at` for chat-history cleanup. **[H]**
- Recovery: at scheduler start, `running → queued` (`recoverInterrupted`); at DB init
  `awaiting_approval → running`. **[H]**

## 8. Reporting

- **automation_runs** is the run ledger. Outcomes: `running` (transient marker written
  at dispatch; guarded so it never overwrites a final outcome), `succeeded`, `failed`,
  `stopped` (never observed in the live sample; UI has a 已停止 status string). **[H on values]**
- Every successful dispatch also flips the session task **unread** (`setTaskUnread`) —
  results surface as an unread chat. **[H]**
- Renderer run history (`automations.runs.*`): columns 来源 trigger (定时/手动),
  触发时间, 时长, 状态 (成功/失败/进行中/已跳过/已停止), 跳到会话 (needs the workspace
  connected), 删除记录, pagination, status filter, plus the awake hint. `skipped`
  rows expose their error text as the reason (e.g. the computer-asleep reason). **[H]**
- New sessions created by automations ping the renderer with source
  `automation_scheduled` (cron) / `automation_idle` (off-peak) → the
  "chatCreated" toast/open affordance. **[M]**
- Bot delivery: `bot_delivery_target` wires `botsService.watchAutomationRun` so the
  run's result is pushed to an IM bot chat (feishu/lark/weixin). **[M]**

## 9. Model / mode of a run

- Declaration: `model_selection` JSON `{providerId, modelId, options.reasoningLevel}`
  (legacy `model/provider/thought_level` triple migrated in; `'null'` = follow host
  preferred model). `mode` = permission mode enum (`build/edit/plan/yolo` names:
  Ask before changes / Edit automatically / Plan mode / Full access). **[H]**
- At dispatch the selection is resolved against the target host's
  model-selection service (`resolveAutomationSubmissionModelSelection`): a stored
  selection with an issue, or lacking a reasoning level, throws **"Automation 模型选择不可用，
  请重新选择模型与思考档位"** — the exact `last_error` in the observed automation (GLM-5-Turbo
  selection unavailable on the plan at run time). Without a stored selection the host's
  preferred model is used ("无法从目标 Host 解析首选模型" if none). **[H]**
- The resolved selection is snapshotted onto the run row (`fixRunModelSelection`) and
  applied to the session (`setAutomationSessionConfig` with modelSelection,
  thoughtLevel, mode). Off-peak runs additionally deny background subagents and skip
  memory extraction. **[H]**

## 10. Open questions for live testing

1. **Skip-window boundary**: is the 5-minute lateness window measured from slot time
   to claim time (code reading says yes)? Test: close the app for 3 min past a slot →
   run should fire late; 7 min → skipped row. **[needs live test]**
2. **DST behavior**: local-time cron in a DST gap/repeat — which occurrence fires?
   Mechanism is JS Date/Croner local, but no code path mentions DST explicitly.
3. **`lifecycle_status='expired'`**: literal exists in the bundle but no writer found —
   dead value, or produced by a path we could not see (server-driven)?
4. **`awaiting_approval`** (off-peak): legacy or reachable? Which UI/flow sets it?
5. **Relative-delay one-shots across restart**: rule `{unit:"minute", interval:delay}`
   + one-shot cron — after a restart the cron fires the slot; verify the skip rule
   treats a sleeping app the same way (expected: skipped row, automation completes).
6. **Remote automations**: `location_kind='remote'` and dispatch via a bound session —
   how is it set today (no writer found in this build)?
7. **bot_delivery_target** end-to-end: which UI sets it (no form string found; likely
   chat-created automations only)?
8. **Manual-run outcome overruns**: a manual run's `outcome='stopped'` mapping was not
   observable in the live sample (no stopped rows yet).
9. **Cron syntax ceiling**: Croner supports rich patterns; app parsers/UI only emit
   plain numeric crons — does the IPC accept e.g. ranges (`1-5`) end-to-end
   (`parseCronFields` suggests no for rule inference, but the cron carrier itself goes
   straight to Croner)?

---

## 11. Live-verification addendum (parent session, 2026-10-07 ~01:31–02:00 +0100)

The parent session ran the testing gate against the live store through the
harness's own automation surface (which writes the same SQLite store):

1. **One-shot cron probe, 3-minute relative delay** (`automation-faa4d02a…`):
   - Stored exactly as §2.3 predicts: cron `34 1 7 10 *` + rule
     `{unit:"minute", interval:3, anchorAt:creation}`; `next_run_at` =
     `anchorAt + 180000` **to the millisecond**; `recurring=0`, `max_runs=NULL`,
     `dispatch_status='idle'`, `location_kind='local'`.
   - Fired at the documented time: run row created **6.8 s after the slot**
     (the next 20 s tick), `scheduled_at` = the exact planned slot,
     `dispatched` ~1 s after claim.
   - §6 verified live: on dispatch the automation flipped to
     `lifecycle_status='completed'`, `enabled=0`, `next_run_at=NULL`.
   - §8 verified live: `outcome` wrote `running` at dispatch, flipped to
     **`succeeded`** only after the delivered turn completed in the bound
     session (`session_id` = the live conversation — automations deliver into
     the workspace's session rather than spawning a detached one).
2. **Off-peak probe** (`offpeak-4cfa8406…`): ticket issued at create
   (`server_ticket_id` populated), `permission_mode='yolo'` default,
   `schedulable=0`, `next_poll_at = queued_at + 90 s`, one-per-session binding
   via the session column; the sync loop then flipped `schedulable` 1→0 and
   advanced `queue_position` 29→33 across polls — §7's ticket reconciliation
   observed live. The task itself remains queued awaiting an idle-compute
   window (it will run unattended with a single-line no-tool prompt).

Not newly tested (remains open): the 5-minute skip boundary was verified by
code path + the live sample row (32-min-late slot skipped with reason), not by
a controlled sleep test; DST gap behavior; `expired` lifecycle writer.
