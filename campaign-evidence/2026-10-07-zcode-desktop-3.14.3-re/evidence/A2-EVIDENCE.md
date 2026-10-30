# A2 — Evidence Index

Every claim in SPEC-DRAFT.md maps to an entry here. Code is minified single-line
bundles; locators are `file ≈byte-offset` plus the surviving annotated function name
(`a(fn,"name")` / `i(fn,"name")` / `static{i(this,"Name")}`). Code paths relative to
`/tmp/zcode-re/asar/out/`. Quoted code fragments are ≤ 2 lines each, quoted as evidence.

Live-store access was strictly read-only: `sqlite3 'file:...tasks-index.sqlite?mode=ro'`.
No writes of any kind; no automations created.

## 1. Architecture / process topology

| Claim | Confidence | Evidence |
|---|---|---|
| Scheduler is an Electron utilityProcess named `zcode-cron-scheduler` | H | `main/index.js ≈549688`: `PU.fork(ug,[],{serviceName:"zcode-cron-scheduler",execArgv:["--no-warnings"],env:{...ZCODE_PROCESS_LABEL:"scheduler"}})` inside `s(MC,"spawnCronScheduler")` |
| Message protocol (log/counters/dispatch-request/result/wake/dispose) | H | `main/index.js ≈549800-551k` handlers for `scheduler-log`, `offpeak-active-count`, `scheduler-resource-sample`, `cron-dispatch-request`, `offpeak-dispatch-request`; `main/chunk-GJUBRD53.js ≈21050` message-type map: `CronRunResult:"cron-run-result"`, `CronSchedulerWakeRequest:"cron-scheduler-wake-request"`, `OffPeakSchedulerWakeRequest:"off-peak-scheduler-wake-request"` |
| Main forwards CronRun/OffPeakRun to host; "app is shutting down"/"no local host available" failures are transient | H | `main/index.js ≈550300`: `n({type:"cron-dispatch-result",runId:a.runId,ok:!1,failureKind:"transient",error:"app is shutting down"})`; `e.resolveDispatchHost()` → `c.postMessage({type:z.CronRun,...})` |
| Dispose grace 1500 ms then kill | H | `main/index.js ≈549740`: `var IU=1500` and `setTimeout(... t.kill())` in `dispose()` |
| DB path `<appConfigDir>/v2/tasks-index.sqlite`; WAL, NORMAL sync, busy_timeout 5000 | H | `scheduler/index.js ≈718385`: `s(Ms,"getTasksIndexDatabasePath")` returns `rn(Pe(),"tasks-index.sqlite")`, `Pe()=rn(Yd(),"v2")`; repo init: `PRAGMA busy_timeout`, `journal_mode = WAL`, `synchronous = NORMAL` (both `AutomationRepo wr` ≈806900 and `OffPeakTaskRepo Ho` ≈910900) |
| node:sqlite DatabaseSync used | H | `scheduler/index.js ≈806300`: `const {DatabaseSync:zV}=FV("node:sqlite")` |
| Sample automation's cron fires in local time | H | Live row `cron_expr='0 9 * * 1'`, `next_run_at=1791792000000` = Mon 2026-10-12 08:00 UTC = 09:00 America/Los_Angeles (machine TZ) |

## 2. Declaration surface

| Claim | Confidence | Evidence |
|---|---|---|
| UI labels/fields/presets/statuses | H | `renderer/assets/IntlProvider-BMWo3Clv.js` — catalog keys `automations.form.*`, `automations.schedule.*`, `automations.customRepeat.*`, `automations.runs.*`, `automations.lifecycle.*`, `offPeak.*` (values extracted 2026-10-07; e.g. `automations.form.maxRuns.label = 最大运行次数`, `automations.runs.awakeHint = 定时任务仅在电脑处于唤醒状态时运行`) |
| automationCreate schema + refinements | H | `renderer/assets/src-BkoFK6Bn.js ≈235400` and mirrored `scheduler/index.js ≈647700`: `vW=e.object({title…,cronExpr…,relativeDelayMinutes:e.number().int().positive().max(525600)…,intervalUnit:ZI…,interval:e.number().int().min(1).max(200)…}).strict().refine(...)` with the four refinement messages quoted in SPEC §2.2 |
| automationView fields (no dispatch_status/retry_at/last_error projected) | H | `scheduler/index.js ≈648000`: `vw=e.object({automationId…,enabled:e.boolean(),lifecycleStatus:e.enum(["active","completed","failed","paused"]),nextRunAt…,runCount…,scheduleRule…}).strict()` — dispatch fields absent |
| schedule_rule zod schema (strict) | H | `scheduler/index.js ≈647700` `yW=e.object({unit:e.enum(["minute","hourly","daily","weekly","monthly","yearly"]),interval…,hour:e.number().int().min(0).max(23),minute…min(0).max(59),anchorAt…,weekdays…min(0).max(6)…,monthDays…min(1).max(31)…,months…min(1).max(12)…,monthlyMode:e.enum(["date","weekday"])…}).strict()` |
| Weekday numbering 0=Sunday | H | scheduler weekly scan `f=(m+6)%7` off a Monday-anchored week (`Gx`, ≈860700); i18n `automations.weekday.0 = 日` (Sunday) |
| Off-peak create schema + permission modes | H | `scheduler/index.js ≈650000`: `e.object({title…,prompt…,permissionMode:e.enum(["build","edit","plan","yolo"]).optional(),model…,thoughtLevel…,boundSessionId…}).strict()`; mode display names `{id:"build",name:"Ask before changes"}…` at ≈707800 |
| Service methods incl. runAutomationNow duplicate detection | H | `host/index.js ≈346946`: `async runAutomationNow(m){…z=await o.runNow(…); return z?(await x(z),{status:"queued"}):{status:"duplicate"}}` |
| 20-automation cap surfaced in UI | H | `scheduler/index.js ≈805900`: `PS` class message "At most ${20} automations may be retained…" with `code=zw`; `zw="AUTOMATION_CREATE_LIMIT_REACHED"` ≈707700; create checks `SELECT COUNT(*) … >= 20`; i18n `automations.error.createLimit` |
| schedule_edited_by_user semantics | M | `renderer/assets/styles-DEELZGp2.js`: `scheduleEditedByUser&&!!(e&&!jIt(e.cronExpr))&&!K.has('schedule')` and a renderer site emitting `scheduleEditedByUser:!0`; create always inserts 0 (`scheduler/index.js ≈807500`: `schedule_edited_by_user … 0` in INSERT) |
| bot_delivery_target shape | M | `host/index.js ≈732200`: `s(kH,"resolveAutomationBotDeliveryTarget")` returns `{provider,botId,providerUserId,chatType}` for provider feishu/lark/weixin; `cr` zod schema referenced in create payload |
| relativeDelayMinutes → one-shot cron + minute rule | H | `host/index.js ≈272900`: `s(SB,"buildRelativeDelaySchedule")`: `cronExpr:`${n.getMinutes()} ${n.getHours()} ${n.getDate()} ${n.getMonth()+1} *`, scheduleRule:{unit:"minute",interval:e,hour…,minute…,anchorAt:t}}` |
| interval-carrier assertions + forceRecurring | H | `host/index.js ≈271900`: `s(QP,"assertValidAutomationIntervalCarrier")`, `s(yB,"forceIntervalCarrierRecurring")` (`{...e,recurring:!0,maxRuns:null}`) |
| One-shot initial-run rules (<60s → now; 1–30min → error) | H | `host/index.js ≈273100`: `s(kB,"computeInitialAutomationNextRunAt")` with `f7=60*1e3, wB=1800*1e3, m7=/^\d+\s+\d+\s+\d+\s+\d+\s+\*$/`; `eC` = `StaleOneShotAutomationScheduleError` ("一次性定时任务的目标时间…已过去…") |
| Cron validation + rule validation errors | H | `host/index.js ≈276700`: `InvalidCronExprError` ("非法的 cron 表达式"), `InvalidAutomationScheduleRuleError` ("非法的定时任务调度规则"), `InvalidAutomationRelativeDelayError`, monthly interval cap `CB=1200` |
| Croner is the cron engine | M→H | `scheduler/index.js ≈852100`: option normalization with `legacyMode`, `domAndDow`, `mode` ∈ `["auto","5-part","6-part","7-part","5-or-6-parts","6-or-7-parts"]`, `utcOffset`, `dayOffset`, `alternativeWeekdays`, `sloppyRanges`, `CronOptions` error strings — Croner's distinctive surface |
| App-side cron field parsing limited to ints/comma lists; `*/N * * * *` → minute rule | H | `host/index.js ≈277000`: `s(h7,"parseCronFields")` (only `*`,`?`, ints, comma lists), `s(nC,"inferMinuteIntervalScheduleRule")` (`/^\*\/([1-9]\d*)\s+\*\s+\*\s+\*\s+\*$/`) |

## 3. Storage

| Claim | Confidence | Evidence |
|---|---|---|
| DDL | H | Live `.schema` dump (samples.md) matches in-code DDL `scheduler/index.js ≈791800-794500` (`CREATE TABLE IF NOT EXISTS automations …`, indexes incl. partial `idx_automations_target_task`) |
| Column roles | H | Row mappers: `s(vr,"rowToAutomation")` ≈805500, `s(wl,"rowToRun")` ≈809800, `s(We,"rowToTask")` ≈909625 |
| Migration machinery + 3 checksummed migrations | H | `scheduler/index.js ≈800900`: `bS=[{id:"0001_adopt_task_schema",checksumInput:[hS,yS,vS,Rx,Tx,Ex,"scheduled-count-backfill-v1"]},{id:"0002_provider_selection",…},{id:"0003_official_glm_selection",…}]`; checksum-mismatch throw; `runTasksDatabaseMigrations` |
| model_selection backfill/canonicalization | H | `s(Ix,"importLegacyAutomationSelections")` ≈796250; `SS` migration SQL canonicalizing GLM model-id casing ≈797000; `s(EV,"decodeLegacySelection")` ≈795200 |
| `'null'` model_selection sentinel | H | `getModelSelectionForDispatch` ≈810900: `if(!(i.model_selection==="null"))throw` — so string `'null'` is the "unset" sentinel; create writes `vl(n.modelSelection)??"null"` |
| task↔automation linkage columns | H | DDL: `tasks.cron_automation_id`, `tasks.off_peak_task_id` + partial indexes `idx_tasks_cron_automation`, `idx_tasks_off_peak_task`; `automations.target_task_id` + `s(wr.prototype.hasTaskBinding)` ≈812300 (`automationCheckTaskBinding` identifier at scheduler ≈650500) |

## 4. Trigger loop

| Claim | Confidence | Evidence |
|---|---|---|
| 20 s tick + immediate tick + wake coalescing | H | `scheduler/index.js ≈1001930`: `Kl=setInterval(Jl,rX)` with `rX=2e4` (≈996310); `s(Jl,"requestTick")` sets `vk=!0` when a tick is running; `s(cX,"tick")` do/while(vk) |
| end_at expiry step in claimDue | H | `scheduler/index.js ≈813600`: `UPDATE automations SET lifecycle_status='completed', enabled=0, next_run_at=NULL … WHERE enabled=1 AND end_at IS NOT NULL AND end_at < @now` |
| stale-claim sweep at 10 min | H | `zs=10*6e4` (≈805800) used as `stale:n-zs` in claimDue ≈814000 |
| due query uses retry_at OR next_run_at | H | `scheduler/index.js ≈814100`: `WHERE enabled = 1 AND running = 0 AND ((retry_at IS NOT NULL AND retry_at <= @now) OR (retry_at IS NULL AND next_run_at IS NOT NULL AND next_run_at <= @now))`; indexes `idx_automations_due (enabled,next_run_at)`, `idx_automations_retry (enabled,retry_at)` in DDL |
| CAS claim | H | ≈814400: `SET running=1, claimed_at=@now, dispatch_status='claimed' WHERE automation_id=@id AND running=0` with `changes===1` gate, inside `BEGIN IMMEDIATE` |
| run_id formats | H | `s(aX,"buildRunId")` ≈996500 returns `` `${t}:${n}` ``; manual: `` `${n}:manual:${Ax()}` `` in `runNow` ≈813500; sample run_ids match (`automation-…:1788768000000`) |
| manual claim heartbeat 60 s | H | `host/index.js ≈1410575`: `s(jJ,"startManualClaimHeartbeat")` `setInterval(… touchManualClaim …, e.intervalMs??6e4)` |
| scheduler-side stale reclaim only (no heartbeat for scheduled) | H | claimDue sweep is the only reaper; no touch call for scheduled claims in scheduler/index.js |

## 5. Dispatch state machine / retry

| Claim | Confidence | Evidence |
|---|---|---|
| markDispatched semantics | H | `scheduler/index.js ≈818900`: increments run_count+scheduled_run_count, `dispatch_status='dispatched'`, clears attempts/retry/error/claim; `c=i.recurring===0&&s>=(i.max_runs??1)`; `l=i.end_at!==null&&(o.nextRunAt??1/0)>i.end_at`; `c||l` → completed+enabled=0 |
| markDispatchFailed: backoff, 5 attempts, give-up split | H | ≈820300: `computeRetryAt` at ≈806050: `Math.min(Dx*2**Math.max(0,n-1),Nx)` with `Dx=3e4, Nx=15*6e4, Lx=5`; `kind==="permanent"` → failed+enabled=0; `c>=Lx` → recurring: idle+attempts reset+next slot; else failed |
| attempt counter 0-based on run rows (sample attempts=4 ⇒ 5 claims) | M→H | `upsertRunClaimed` ≈825900: INSERT attempts 0; ON CONFLICT `attempts=attempts+1`; sample failed rows show attempts=4 with ≈8.3 min duration = 30+60+120+240 s backoff + overhead |
| failureKind transient default; permanent class only off-peak | H | `scheduler/index.js ≈1000400`: `let l=t.failureKind??"transient"`; `host/index.js ≈1487100`: CronRun catch sends `failureKind:"transient"`; OffPeakRun catch: `failureKind:o instanceof wi?"permanent":"transient"` |
| releaseClaim / releaseManualClaim / touchManualClaim | H | `scheduler/index.js ≈822000-823900` (annotated names) |
| manual dispatch failure handling | H | `host/index.js ≈1411441`: `s(qJ,"settleManualDispatchFailureBestEffort")` → `markRunDispatch failed_to_dispatch` + release claim; `s(iAe,"dispatchManualAutomationRun")` ≈1412700 |
| outcome guard ('running' cannot overwrite final) | H | `scheduler/index.js ≈828300`: `s(No.prototype.markRunOutcome …)` SQL CASE: `WHEN @outcome='running' AND outcome IS NOT NULL AND outcome <> 'running' THEN outcome` |

## 5.1 Late/missed semantics (verdict)

| Claim | Confidence | Evidence |
|---|---|---|
| 5-minute lateness window; skip reason string; finalize for one-shot | H | `scheduler/index.js ≈996317`: `var rX=2e4,oX=5*6e4`; `dX handleClaimed` ≈997340: `if(!(t.dispatchAttempts>0)&&t.nextRunAt!=null&&t.nextRunAt<=n-oX){…Fe.skipAndReschedule({…,reason:"computer_asleep_or_app_not_running",nextRunAt:m,finalize:u})…}`; `s(ES,"isOneShotAutomation")` ≈860124 |
| skipAndReschedule writes skipped run row + advances slot | H | `scheduler/index.js ≈823950`: INSERT … `'skipped', @reason, 0 … ON CONFLICT(run_id) DO UPDATE`; non-finalize branch sets `next_run_at=@next_run_at, dispatch_status='idle', dispatch_attempts=0, retry_at=NULL` |
| live sample corroborates (32-min-late slot skipped) | H | samples.md run #5: scheduled 1791187200000, recorded 1791189162463 (+1962 s), dispatch_status=skipped; automation next_run_at advanced to 1791792000000; `dispatch_attempts=0` (reset), `last_error` still the older dispatch error |
| slot resolution `nextRunAt ?? retryAt ?? now` | H | `s(sX,"resolveScheduledAt")` ≈996480 |

## 6. Lifecycle

| Claim | Confidence | Evidence |
|---|---|---|
| setEnabled ⇔ active/paused | H | `scheduler/index.js ≈812400`: `SET enabled=@enabled, lifecycle_status=@lifecycle_status` with `o?"active":"paused"` |
| restart resets counters | H | `restart` ≈812713: `run_count=0, scheduled_run_count=0, dispatch_attempts=0, retry_at=NULL, dispatch_status='idle', running=0, claimed_at=NULL, next_run_at=@next_run_at, last_error=NULL` |
| runNow CAS + duplicate | H | `runNow` ≈813377: stale sweep, `changes!==1 → null` (duplicate), manual run insert attempts=1 |
| one-shot definition | H | `s(ES,"isOneShotAutomation")`: `!t.recurring&&(t.maxRuns??1)<=1` |
| manual runs don't count toward max_runs | H | `markManualRunDispatched` ≈827500: increments `run_count` only (no scheduled_run_count, no completion check) |
| scheduled_run_count backfill | H | migration list entry `["automations","scheduled_run_count","INTEGER NOT NULL DEFAULT 0"]` + `UPDATE automations SET scheduled_run_count=run_count` in `MV adoptSchema` ≈802300; checksum tag `"scheduled-count-backfill-v1"` |
| 'expired' literal exists but no writer | L | `scheduler/index.js`: `"expired"` ×2 (≈ in Croner options region); no SQL/status write found in scheduler/host for automation lifecycle |

## 7. Off-peak

| Claim | Confidence | Evidence |
|---|---|---|
| status enum + terminal set | H | `renderer/assets/src-BkoFK6Bn.js ≈238000`: `status:M(["queued","paused","running","completed","failed","cancelled"])`; `scheduler/index.js ≈707667`: `qR=["completed","failed","cancelled"]` → `qo` SQL list; off-peak view schema `Hv` |
| unique active binding per workspace+session | H | DDL `CREATE UNIQUE INDEX idx_off_peak_bound_active … WHERE session_id IS NOT NULL AND status NOT IN ('completed','failed','cancelled')`; `s(td,"isOffPeakBoundSessionConflict")` `host/chunk-NKOHJ4QI.js ≈48900`; create-time check `hasActiveBoundTask` |
| server client endpoints + auth headers | H | `host/index.js ≈1201300`: `s(JA,"createOffPeakServerClient")`: ``t(`${l}/api/v1/off-peak${o}`)``; headers `authorization:Bearer ${a.jwt}`, `x-coding-plan-api-key`; `dbe=1e4` abort timeout; endpoints `GET /ticket/availability`, `POST /ticket`, `POST /ticket/status` (≤100 ids), `POST /ticket/:id/settle` |
| ticket state enum | H | `KA=e.enum(["queued","ready","active","expired","settled","not_found"])` in both `scheduler/index.js ≈923000` and `host/index.js ≈1200000`; response schemas with `next_poll_after`, `position`, `ready_deadline`, `active_deadline`; `can_take_number/next_take_at` gate |
| create failure taxonomy | H | `s(mv,"classifyOffPeakCreateFailure")` ≈1204300: failureStage client_validation/ticket_request/local_persist; bizCode 3101→eligibility_3101, 3103→quota_3103; renderer variant `A('ok',[…failureStage:M([`client_validation`,`ticket_request`,`local_persist`])…])` in src-BkoFK6Bn.js |
| sync loop cadence + applyTicketStatus | H | `host/index.js ≈1210500`: `fv=5e3, YA=5*6e4, pbe=1e4`; `runSyncCycle` (settle outbox → retake ticketless → batchStatus → applyTicketStatus switch on ready/queued/active/expired); clamp `Math.min(Math.max(t,fv),YA)` |
| claimDue (queued+schedulable FIFO, claim_running CAS, 10-min stale `tk`) | H | `scheduler/index.js ≈916500`: `tk=10*6e4`; `WHERE status='queued' AND schedulable=1 AND claim_running=0 ORDER BY queued_at ASC, created_at ASC`; CAS update |
| markRunning / markTerminal semantics | H | `scheduler/index.js ≈919000-920500`: COALESCE writes, terminal guard `WHERE … status NOT IN (${qo})`, `schedulable=0`, `attempt_count+@dispatch_attempt_inc` |
| dispatch requires server ticket; request auth from ticket | H | `host/index.js ≈1460042`: `s(eAe,"dispatchOffPeakRun")`: `if(!e.serverTicketId)throw new Error("off-peak dispatch without server ticket")`; `n.buildRequestAuth(e.serverTicketId)` |
| invalid selection → permanent-class error | M→H | `eAe`: `if(!await n.validateSelection(r))throw new vf("idlePlan")`; host result handler maps `o instanceof wi → "permanent"` |
| resume continuation prompt (exact text) | H | `host/index.js ≈1458600`: `JRe="Continue the previous task from where it left off. The run was interrupted (app restart or execution window expired). Do not start over; …"` |
| modelExecution restrictions (skip memory extraction, deny background subagents) | H | `eAe` sendPrompt options: `modelExecution:{memoryExtraction:"skip",selectionScope:"execution",requestAuth:o,subagents:{foregroundModel:"submission",background:"deny"}}` |
| outcome mapping + files_changed + settle | H | `host/index.js ≈1459200`: `XRe finalizeOffPeakRun`: `e.outcome==="succeeded"?"completed":e.outcome==="stopped"?"cancelled":"failed"`; `YRe resolveOffPeakFilesChanged` (taskSnapshot.fileChanges→fileCount, warn "off-peak files_changed 汇总失败（不阻塞终态落库）"); ticket-expired mid-run → `handleTicketExpiredDuringRun` → requeue + retake; `settleOne` (4xx settles locally; 5xx retries) ≈1211500 |
| recovery (running→queued at start; awaiting_approval→running at init) | H | `s(Ho.prototype.recoverInterrupted)` ≈921500 (`UPDATE … SET status='queued' WHERE status='running'`); init: `UPDATE off_peak_tasks SET status='running' WHERE status='awaiting_approval'` in repo initialize ≈912000; called from scheduler `gX main` ≈1001800 |
| pause/continue/cancel/delete/history ops | H | `Sf OffPeakTaskService` ≈1204500-1212000: `pauseTask/continueTask/cancelTask/deleteTask/deleteHistory/updateTask` + renderer strings `offPeak.action.*`, `offPeak.edit.peakHoursWarning`, `offPeak.form.keepAwake*` |
| keep-awake global setting | M | `offPeak.form.keepAwakeHint`: "阻止系统因空闲进入休眠（桌面端全局开关，设置 → 常规 中可改）" — settings toggle not traced further |

## 8. Reporting

| Claim | Confidence | Evidence |
|---|---|---|
| outcome values | H | writer `markRunOutcome` (CASE guard); host `oAe trackCronRunOutcome` subscribes `onDynamicTaskTerminalOutcome(taskId)` and writes `o.outcome`; `XRe` maps succeeded/stopped/failed; UI strings `runs.status.succeeded/failed/running/skipped/stopped` |
| unread on completion | H | `oAe` and `XRe`: `setTaskUnread({taskId…, unread:!0})` |
| run history UI | H | i18n `automations.runs.*` (columns, open-session failure string, delete record, pagination, filters) |
| renderer notification sources | M | `host/index.js ≈1467900/1462200`: `dk(Fe,{sessionId,messageId,source:"automation_scheduled"|"automation_idle",…})` |
| deleteAutomationRun | H | service method list `host/index.js ≈347200`: `async deleteAutomationRun(m){return o.deleteRun(m.runId,…)}; i18n automations.runs.delete |

## 9. Model / mode

| Claim | Confidence | Evidence |
|---|---|---|
| selection resolution + availability error (exact sample string) | H | `host/index.js ≈1453054`: `s(c4,"resolveAutomationSubmissionModelSelection")`: `if(r.selectionIssue||!r.effectiveSelection?.options?.reasoningLevel)throw new Error("Automation 模型选择不可用，请重新选择模型与思考档位")`; preferred-model fallback error "Automation 无法从目标 Host 解析首选模型"; `getModelSelectionForDispatch` throw of same text at `scheduler/index.js ≈811000` (message matched against live `last_error`) |
| selection snapshotted onto run | H | `s(No.prototype.fixRunModelSelection)` ≈826800; call in `k4` ≈1464500 |
| config applied to session | H | `s(rAe,"applyCronRunConfigToExistingTask")` ≈1461800: `setAutomationSessionConfig({modelSelection, thoughtLevel, mode})` |
| target-task binding at dispatch | H | `k4 dispatchCronRun` ≈1464446: `e.targetTaskId ? {taskId:e.targetTaskId} : await n.createTask({…, automationId})` + `resumeTask` + config reapply |
| remote-host resolution | M | `s(tAe,"resolveAutomationTargetServices")` ≈1460500: `Ht.findSessionForWorkspace` + `workspaceIdentity` ("Automation 目标 Remote Host 缺少 workspaceIdentity") |

## Limitations

- Bundles are minified; byte offsets shift if the tree is re-extracted. Annotated
  function names (`a/i/s(fn,"name")`, `static{i(this,"Class")}`) are the stable handles.
- The scheduler/host files contain *duplicated copies* of the repos and schemas
  (scheduler worker copy, host copy); both copies agree on every constant checked.
- Live-store sampling is n=1 automation / n=5 runs / n=0 off-peak rows; the off-peak
  machine is reconstructed from code only, and `outcome='stopped'`,
  `lifecycle_status='expired'`, `awaiting_approval` have no observed rows.
- The app was not driven (document-only): no create/edit/run-now/pause exercised,
  per task instructions (parent session owns the live trigger test).
