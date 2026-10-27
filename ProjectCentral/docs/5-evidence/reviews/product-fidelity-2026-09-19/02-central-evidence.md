# Central review evidence annex — 19 September 2026

Companion to [02-central.md](02-central.md). This annex retains the native Action census and bounded executed evidence needed to distinguish registered capability, observed defects, candidate proof and unavailable private-machine acceptance. It is not a test or product change.

## A. Source, artifact and execution identity

Pinned Central: `0a58a32c7587f5576ace4239a1fd6d9bde868510`.

The native GitHub connector retrieved the published artifact from [workflow run 35451667163](https://github.com/EpiLogos/Central/actions/runs/35451667163), artifact `10586801877`.

| Material | SHA-256 / identity |
|---|---|
| Downloaded ZIP | `e9d9ee055827a68d4dc0b5423d84183bdb30a58e0daf1231f2163db77180849b` |
| Executed Linux binary | `eeebe0b2d1ac3ab7fbd90481b5272e72b14bad5dae11b9197cd610df20a57b3f` |
| Reported version | `ctrl 0.1.0 (0a58a32c7587)` |
| Execution environment | Reviewer container; fresh temporary root and empty HOME; PATH `/usr/bin:/bin`; LANG `C.UTF-8` |
| Effects | New disposable fixture files only. No network, provider/model execution, remote service, user World, private source, installation or active Day/NOW action. Fixtures removed after the run. |

The source workflow [prelocal-build.yml](https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/.github/workflows/prelocal-build.yml) is a build-artifact source. Its success alone was not treated as an end-to-end test.

## B. Native catalogue: 167 returned Action identities

Observed by executing the pinned binary’s `--json action list`. The result was `ok:true`, `status:success`, `action:action.list`; the returned `data.actions` array had **167 elements**. The table reproduces each returned ID and mutation class. It does not infer effects from English names: for example, several reads/reconciliations are correctly retained as **locally-mutating** because that is what the native descriptor says.

This is the scope of the absence claim in CT-001: `projectcentral.flow.list` is not in this returned public catalogue and is rejected when invoked. This census does not establish that every Action succeeded against a configured user World, has a bespoke screen, or was physically tested.

| Action | Native mutation class |
|---|---|
| `action.list` | read-only |
| `agent-profile.express` | locally-mutating |
| `agent-profile.list` | read-only |
| `agent-profile.propose` | locally-mutating |
| `agent-profile.read` | read-only |
| `agent-profile.remove` | locally-mutating |
| `agent-profile.save` | locally-mutating |
| `central.agent-set.list` | read-only |
| `central.agent-set.propose` | locally-mutating |
| `central.agent-set.read` | read-only |
| `central.agent-set.remove` | locally-mutating |
| `central.agent-set.resolve` | read-only |
| `central.agent-set.save` | locally-mutating |
| `central.config.apply` | locally-mutating |
| `central.config.contribution` | read-only |
| `central.config.plan` | read-only |
| `central.config.reset` | locally-mutating |
| `central.config.validate` | read-only |
| `central.day.ensure` | locally-mutating |
| `central.day.lifecycle` | locally-mutating |
| `central.day.read` | read-only |
| `central.doctor` | read-only |
| `central.document.create` | locally-mutating |
| `central.document.export` | read-only |
| `central.document.mutate` | locally-mutating |
| `central.document.read` | read-only |
| `central.file-map.adopt-db` | locally-mutating |
| `central.file-map.inspect` | read-only |
| `central.file-map.link` | locally-mutating |
| `central.file-map.locate` | read-only |
| `central.file-map.move-apply` | locally-mutating |
| `central.file-map.move-plan` | locally-mutating |
| `central.file-map.move-rollback` | locally-mutating |
| `central.file-map.projection-read` | read-only |
| `central.file-map.projection-record` | locally-mutating |
| `central.file-map.record-adopt` | locally-mutating |
| `central.file-map.refresh` | locally-mutating |
| `central.file-map.register` | locally-mutating |
| `central.file-map.resolve` | read-only |
| `central.file-map.scope-register` | locally-mutating |
| `central.file-map.search` | read-only |
| `central.file-map.skill-tree` | read-only |
| `central.files.history` | read-only |
| `central.files.list` | read-only |
| `central.files.read` | read-only |
| `central.files.recovery_preview` | read-only |
| `central.files.restore` | locally-mutating |
| `central.files.write` | locally-mutating |
| `central.init` | locally-mutating |
| `central.local-endpoints.inspect` | read-only |
| `central.local-endpoints.refresh` | locally-mutating |
| `central.local-endpoints.suggest` | read-only |
| `central.migration.apply` | locally-mutating |
| `central.migration.plan` | locally-mutating |
| `central.migration.read` | read-only |
| `central.migration.recover` | locally-mutating |
| `central.migration.rollback` | locally-mutating |
| `central.now.allocate` | locally-mutating |
| `central.now.learnings.distill` | locally-mutating |
| `central.now.learnings.read` | read-only |
| `central.now.lifecycle` | locally-mutating |
| `central.now.list` | read-only |
| `central.now.obligations` | locally-mutating |
| `central.now.read` | read-only |
| `central.now.thoughts.append` | locally-mutating |
| `central.now.thoughts.read` | read-only |
| `central.receiving.include` | locally-mutating |
| `central.receiving.list` | read-only |
| `central.receiving.read` | read-only |
| `central.receiving.recover` | locally-mutating |
| `central.receiving.review` | locally-mutating |
| `central.receiving.submit` | locally-mutating |
| `central.recognize` | read-only |
| `central.recover` | externally-mutating |
| `central.recovery.plan` | read-only |
| `central.remember` | locally-mutating |
| `central.root` | read-only |
| `central.self.ensure` | locally-mutating |
| `central.self.ex.relate` | locally-mutating |
| `central.self.inspect` | read-only |
| `central.self.resolve` | read-only |
| `central.self.source.create` | locally-mutating |
| `central.self.tier.relate` | locally-mutating |
| `central.self.ux.relate` | locally-mutating |
| `central.system` | read-only |
| `central.template.preview` | read-only |
| `central.template.stamp` | locally-mutating |
| `central.temporal.source-history` | read-only |
| `central.time.policy` | read-only |
| `central.wiki.read` | read-only |
| `central.work.policy` | read-only |
| `central.work.validate` | read-only |
| `central.world` | read-only |
| `central.world-relations.list` | read-only |
| `central.world-relations.read` | read-only |
| `central.world-relations.remove` | locally-mutating |
| `central.world-relations.save` | locally-mutating |
| `central.world.effective-sources` | read-only |
| `central.world.project` | read-only |
| `central.world.reproject.apply` | locally-mutating |
| `central.world.reproject.plan` | read-only |
| `control.engineering-ground.plan` | read-only |
| `control.engineering-ground.render` | locally-mutating |
| `control.index` | read-only |
| `control.open` | read-only |
| `control.search` | read-only |
| `control.skills.inspect` | read-only |
| `control.skills.restore` | locally-mutating |
| `control.skills.retire` | locally-mutating |
| `machine.account` | read-only |
| `machine.adopt-current` | locally-mutating |
| `machine.apply` | locally-mutating |
| `machine.declaration` | read-only |
| `machine.inspect` | read-only |
| `machine.oi-suite-policy` | read-only |
| `machine.plan` | read-only |
| `machine.verify` | read-only |
| `projectcentral.adopt` | locally-mutating |
| `projectcentral.adopt.preview` | read-only |
| `projectcentral.change.ack` | locally-mutating |
| `projectcentral.change.horizon` | locally-mutating |
| `projectcentral.change.reconcile` | locally-mutating |
| `projectcentral.doctor` | read-only |
| `projectcentral.ground.apply` | locally-mutating |
| `projectcentral.ground.inspect` | read-only |
| `projectcentral.ground.plan` | read-only |
| `projectcentral.init` | locally-mutating |
| `projectcentral.inspect` | read-only |
| `projectcentral.local-endpoints.inspect` | read-only |
| `projectcentral.local-endpoints.remove` | locally-mutating |
| `projectcentral.local-endpoints.set` | locally-mutating |
| `projectcentral.migrate` | locally-mutating |
| `projectcentral.migrate.preview` | read-only |
| `projectcentral.now.init` | locally-mutating |
| `projectcentral.now.inspect` | read-only |
| `projectcentral.now.promote` | locally-mutating |
| `projectcentral.now.return` | locally-mutating |
| `projectcentral.now.rollover` | locally-mutating |
| `projectcentral.now.update` | locally-mutating |
| `projectcentral.remember` | locally-mutating |
| `projectcentral.self.ensure` | locally-mutating |
| `projectcentral.self.ex.relate` | locally-mutating |
| `projectcentral.self.inspect` | read-only |
| `projectcentral.self.resolve` | read-only |
| `projectcentral.self.retain-tier` | locally-mutating |
| `projectcentral.self.source.create` | locally-mutating |
| `projectcentral.self.tier.relate` | locally-mutating |
| `projectcentral.self.ux.relate` | locally-mutating |
| `projectcentral.source.compare` | read-only |
| `projectcentral.source.history` | read-only |
| `projectcentral.source.read` | locally-mutating |
| `projectcentral.source.recovery.preview` | read-only |
| `projectcentral.source.return` | locally-mutating |
| `projectcentral.source.return_accept` | locally-mutating |
| `projectcentral.source.return_read` | locally-mutating |
| `projectcentral.source.return_reject` | locally-mutating |
| `projectcentral.source.returns` | locally-mutating |
| `projectcentral.source.transfer.apply` | locally-mutating |
| `projectcentral.source.transfer.conflicts` | read-only |
| `projectcentral.source.transfer.export` | read-only |
| `projectcentral.source.transfer.resolve` | locally-mutating |
| `projectcentral.source.write` | locally-mutating |
| `projectcentral.wiki.read` | read-only |
| `work.list` | read-only |
| `work.open` | externally-mutating |
| `work.reveal` | externally-mutating |
| `work.search` | read-only |

## C. Executed request/result observations

Every invocation below used this actual argument form, with the already-verified binary and only a freshly created disposable root:

```text
<verified-ctrl> --json --root <temporary-root> action run <action-id> <JSON-arguments>
```

The process environment was reduced to `HOME=<empty-reviewer-home>`, `PATH=/usr/bin:/bin`, `LANG=C.UTF-8`. Each call was captured with a ten-second timeout. No user configuration, running process or normal home was used.

### C1. Removed Flow Action / legacy root distinction

After successful `central.init {}`:

```json
{"action":"projectcentral.flow.list","arguments":{"project":"demo"},"exit":2,"result":{"ok":false,"status":"invalid_input","action":"projectcentral.flow.list","error":{"code":"invalid_input","message":"Unknown Action: projectcentral.flow.list"}}}
```

This call is made by the reachable pinned [AIKit adapter](https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/central_temporal.rs), through [hook dispatch](https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-cli/src/hook.rs). The whole external harness was not executed in the reviewer environment.

The separate call `projectcentral.now.inspect {}` returned exit 2 with `projectcentral.now.inspect requires project.` This identifies the legacy operation’s scope; it does **not** establish that newer root `central.now.*`, receiving or actor-composition APIs require a fake child Project.

### C2. Concurrent Project initialisation

Starting state: one freshly initialised Central root; twelve ordinary directories `Work/project-00` through `Work/project-11`, each containing the exact same sentinel human file `existing.md` with bytes `Retain existing human material.\n`.

Twelve workers concurrently invoked:

```text
projectcentral.init {"project":"project-NN","project_id":"project:project-NN"}
```

Observed aggregate:

```json
{
  "attempts": 12,
  "success": 7,
  "failure": 5,
  "root_child_count": 7,
  "original_files_preserved": true,
  "failed_projects": ["project-01", "project-03", "project-04", "project-05", "project-08"]
}
```

Every failed request exited **7** with `status: verification_failure`, `action: projectcentral.init`, and the same cause. Temporary prefix omitted; the native relative target and parser error are preserved:

```text
Control/agents/wiki/wiki.json is not valid Wiki JSON:
EOF while parsing a value at line 1 column 0
```

The seven root child references matched the seven successful requests. **No lost successful registration is claimed.** The failure is the observable shared-Wiki race and partial initialisation path. The code cause is in [projectcentral_ops.rs](https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/projectcentral_ops.rs), especially the plain shared federation writer and publication order. The proposed interruption/retry tests in CT-002 were not run as additional probes.

### C3. Benign outside-Project alias

The fixture created a harmless JSON Wiki source in the disposable parent directory, then linked `Work/alias-project/linked.json` to it. It contained only an `okf-wiki/v1` space with ref `wiki:benign-fixture`, revision 1. There was no private file or credential involved.

Both `projectcentral.adopt.preview` and `projectcentral.adopt` returned exit 0 / success. Preview reported `outcome: bind_existing_wiki_in_place`, `preserves_source: true`, source `linked.json`, target `ProjectCentral/agents/wiki/wiki.json`; the adoption result recorded `adopted_sources: ["linked.json"]`. Original sibling bytes remained unchanged.

The paired [AIKit source-descriptor helpers](https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/projectcentral.rs), `push_source` and `path_agent_readable`, withhold a direct symlink. This is evidence for an adoption/usable-source mismatch, **not evidence that the model received the outside source**. The stronger [native file-map](https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/file_map.rs) external-registration/managed-link route is relevant counter-evidence and a repair substrate.

### C4. Configuration contribution

`central.config.contribution {}` returned a valid bare `oi.configuration-contribution/v1` document from the pinned binary. A bare document is the intentional [configuration transport](https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/configuration.rs), not an Action-envelope parsing defect. Source inspection confirms distinct read-only authored-policy entries and writable native Skill standing. No configuration mutation or physical UI apply was executed.

## D. Candidate proof, not baseline or private-machine acceptance

Central [PR #161](https://github.com/EpiLogos/Central/pull/161), head `7bc00200e75427d69f726e2df94d669699637b0b`, was open/unmerged and reported non-mergeable at final inspection. The retained [run 34645210224](https://github.com/EpiLogos/Central/actions/runs/34645210224) artifact `10282007135` was downloaded through the native connector.

| Evidence | Exact qualification |
|---|---|
| ZIP SHA-256 | `80c1ac36b22f95fe5ff1a4d336fba78e2ed3c1e323d62a72751ec670ef63e572` |
| Retained source SHA | `fece91246f28acc2d52d5159e304829c4def80af` — PR test-merge, not today’s main |
| Native test log | 83 `test result: ok` summaries, summed by the reviewer to **428 passed, 0 failed, 0 ignored** |
| Retained consumer record | Eight concurrent same-task allocation processes, one source creation; placement policy explicitly says arbitrary outside writes were not prevented by Central |
| Candidate implementation | External reconciliation and last-native/current-source bases; retained-copy restore; entries/notes; fair multi-Project root receiving and exact grants; retained draft evidence; acknowledgement/pending distinct from inclusion |
| Explicit non-coverage | Original standalone HTML editor/import and full template fidelity; arbitrary host-write containment; user installation; private policy/credentials; actual loaded model/practice; current live app |

The test-merge source archive contains an older Flow module; it must not be substituted for the published baseline when assessing CT-001. Selected candidate files also differ from today’s baseline; no whole-archive equivalence is claimed. The successful same-task allocation does not refute the separate Project-adoption race.

## E. Revision, UI and publication checks

Final native ref reads retained the frozen Central, AIKit, Actuation, Factory and Workcell SHAs. O:I was `a5012f5aa44d0fed317a261b009250d70013ccb5`; the [baseline-to-final comparison](https://github.com/EpiLogos/O-I/compare/a1c7010fa290219d58f78ee03f55651ac14ed75d...a5012f5aa44d0fed317a261b009250d70013ccb5) reports four intervening commits and does not change the receiving client, document Returns, NOW detail or material client used by the report’s findings.

The pushed UI branch was separately resolved to `7747d5e67d2814a29a44788d0b901750cb553215`. Actual [DocumentReturns](https://github.com/EpiLogos/O-I/blob/7747d5e67d2814a29a44788d0b901750cb553215/desktop/cradle/src/receiving/DocumentReturns.tsx), [ContextPlane](https://github.com/EpiLogos/O-I/blob/7747d5e67d2814a29a44788d0b901750cb553215/desktop/cradle/src/contributions/factory/sidebar/ContextPlane.tsx) and [SettingsPageV2](https://github.com/EpiLogos/O-I/blob/7747d5e67d2814a29a44788d0b901750cb553215/desktop/cradle/src/workspace/settings/v2/SettingsPageV2.tsx) were read at that SHA. These readings are not an assertion about unpublished dirty local code.

The installed [#65 receipt](https://github.com/EpiLogos/O-I/issues/65#issuecomment-5743244181), created 2026-09-19 15:52:30 UTC, is owner-returned install evidence; it explicitly defers actual app-consumer/physical acceptance. The report retains that distinction.

Only `02-central.md` and this matching annex are publication artifacts. The dedicated branch starts at O:I `a5012f5...`; the final changed-path check, normal PR/check/merge outcome and main readback belong to the publication receipt returned in chat. No production source, issue state, Skill, canonical source, active Day/NOW or user process was changed.
