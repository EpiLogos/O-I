# A2 — Redacted Live-Store Samples

Source: `sqlite3 'file:/Users/admin/.zcode/v2/tasks-index.sqlite?mode=ro'` (read-only URI;
never written; opened 2026-10-07). Contents: `automations` = 1 row, `automation_runs` = 5 rows,
`off_peak_tasks` = 0 rows. The only free-text column in `automations` is `prompt`
(2237 chars) — truncated to ~80 chars below. `automation_runs` carries no prompt column.

Row counts confirmed via `SELECT COUNT(*)` per table; other tables in the file
(`tasks`, `task_groups`, `task_group_members`, …) were not sampled except where
automations reference them.

## automations (1 row)

| column | value |
|---|---|
| automation_id | `automation-41eedc8c-0c36-498f-a128-462019476c23` |
| title | `Weekly lane stewardship & build-hygiene sweep` (45 chars) |
| cron_expr | `0 9 * * 1` |
| prompt | `Run the weekly stewardship pass for this machine's development field. You are a steward of…` [TRUNC — 2237 chars total] |
| model / provider / thought_level | `builtin:zai-coding-plan/GLM-5-Turbo` / `glm` / `enabled` (legacy columns, populated) |
| model_selection | `{"providerId":"account:zai-individual-coding-plan","modelId":"GLM-5-Turbo","options":{"reasoningLevel":"enabled"}}` |
| mode | `yolo` |
| workspace_key / workspace_path | `/Users/admin/Central` / `/Users/admin/Central` |
| workspace_identity | `` (empty string, not NULL) |
| target_task_id | `sess_c2f51a32-7569-420c-80f2-2882e4ca68ad` |
| bot_delivery_target | NULL |
| location_kind | `local` |
| recurring | 1 |
| max_runs / end_at | NULL / NULL |
| schedule_rule | `{"unit":"weekly","interval":1,"hour":9,"minute":0,"weekdays":[1],"anchorAt":1788739470624}` |
| schedule_edited_by_user | 0 |
| run_count / scheduled_run_count | 1 / 1 |
| enabled | 1 |
| lifecycle_status | `active` |
| next_run_at | 1791792000000 (Mon 2026-10-12 08:00 UTC = 09:00 America/Los_Angeles) |
| last_run_at | 1788768010445 (2026-09-07 08:00:10 UTC — 10 s after slot) |
| running / claimed_at | 0 / NULL |
| dispatch_status | `idle` |
| dispatch_attempts / retry_at | 0 / NULL |
| last_error | `Automation 模型选择不可用，请重新选择模型与思考档位` ("model selection unavailable; please reselect model and reasoning tier") |
| created_at / updated_at | 1788739470626 / 1791189162463 |

Reading: created 2026-09-07 00:04:30 UTC; first (and only successful) run dispatched
2026-09-07; three subsequent Mondays failed to dispatch (model unavailable), each
exhausting 5 claims (~8.3 min of backoff each); the 2026-10-05 slot was claimed
32 minutes late while the app was closed and was **skipped** with reason
`computer_asleep_or_app_not_running` (which reset `dispatch_attempts` to 0 but left
`last_error` from the earlier dispatch failures); next slot advanced to 2026-10-12.

## automation_runs (5 rows, oldest first)

`run_id` = `<automation_id>:<scheduled_at>`. All rows share automation_id
`automation-41eedc8c-…` and workspace_key `/Users/admin/Central`; `model_selection`
is NULL on all five.

| # | run_id suffix | scheduled_at (UTC) | trigger | dispatch_status | outcome | session_id | error (truncated) | attempts | created_at | updated_at |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `:1788768000000` | 2026-09-07 08:00 | schedule | `dispatched` | `succeeded` | present (`sess_…`) | NULL | 0 | 08:00:08 | 08:06:56 |
| 2 | `:1789372800000` | 2026-09-14 08:00 | schedule | `failed_to_dispatch` | `failed` | NULL | `当前会话使用的模型已不可用，请从当前模型列表中选择一个可用模型后继续。` | 4 | 08:00:07 | 08:08:27 |
| 3 | `:1789977600000` | 2026-09-21 08:00 | schedule | `failed_to_dispatch` | `failed` | NULL | (same as #2) | 4 | 08:00:02 | 08:07:41 |
| 4 | `:1790582400000` | 2026-09-28 08:00 | schedule | `failed_to_dispatch` | NULL | NULL | `Automation 模型选择不可用，请重新选择模型与思考档位` | 4 | 08:00:03 | 08:07:43 |
| 5 | `:1791187200000` | 2026-10-05 08:00 | schedule | `skipped` | NULL | NULL | `computer_asleep_or_app_not_running` | 0 | 09:32:42 | 09:32:42 |

Notes:
- Run #1: attempts=0 is the first-claim INSERT value; the run took ~6.8 min of
  session time before its outcome was written (`updated_at`).
- Runs #2–3 error text ("The model used by this session is no longer available…")
  differs from #4's ("Automation model selection unavailable…") — two distinct
  failure messages in the model-unavailable family, both stored verbatim.
- Run #4 row shows `dispatch_status='failed_to_dispatch'` but `outcome` NULL: the
  5th dispatch attempt failed and the give-up branch did not mark the run outcome —
  only the automation row's `last_error` (matching text). The failure window was
  08:00:03 → 08:07:43, matching the 30+60+120+240 s backoff chain.
- Run #5: `created_at == updated_at`, attempts=0 — the pure skip-row write from
  `skipAndReschedule`; 32 min late ⇒ outside the 5-minute fire-late window.

## off_peak_tasks (0 rows)

Empty on this machine — the off-peak machine in SPEC-DRAFT §7 is reconstructed
entirely from code, with no observed rows.
