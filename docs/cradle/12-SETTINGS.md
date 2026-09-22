---
Register: episteme
Standing: design-commitment (proposed 2026-09-22; realises HARNESS-SETTINGS-RESEARCH-2026-09-22 §1–§3 and DESKTOP-LANGUAGE rulings 2, 3, 6)
---

# 12 — Settings and System

**Settings is where you pick a harness by name, pick a model for it, enter and check API keys, and turn skills on and off, and see that each change took.** It follows the grammar that Claude Code, Codex and Hermes converge on (research §1): one canonical store, friendly rows on top, a dedicated manager for each list, and the raw file only as an escape hatch. It renders what the owners already disclose: `aikit system --json` (`oi.product-settings-disclosure/v2`) for *what is true*, and `config-contribution` + `oi config` for *what may be changed*. The companion study renders every section. Choose *Settings*, then a section.

## 1. Where Settings sits

- **Entry:** the gear in the left foot, or ⌘⌥5. **Back to work** (or Escape with nothing pending) returns to the previous mode and arrangement.
- **Left sidebar stays open.** Its body becomes the section list (10-SIDEBARS law 1: one frame, changing body). This replaces the collapsed sides and the in-page rail. The **scope selector** in the head sets the scope used by project-scoped settings.
- **Right panel is collapsed.** Opening it gives a help chat that can read settings but cannot change them.
- **Centre:** the section page, with *Search settings* in the page header. Search spans every section and product page and lands on the exact row.

```text
LEFT (body)              CENTRE
Status                   Models                                   ⌕ Search settings
Harnesses                ─────────────────────────────────────────────────────────
Models        ◉          Default for new chats      Pi (sandboxed) ▾
Credentials   1          Claude Code                Auto · Balanced ▾
Skills        86         Codex                      from its config · Open file
Profiles                 Ranking policy             Balanced ▾
Permissions              Catalogue                  345 models · Browse… · Refresh
Appearance
PRODUCTS                 ── 2 changes pending · Review changes · Discard ──
Central  AIKit  …
```

Sections are organised **by task** (research §2), with **Products** below for the per-owner pages. This settles the conflict between the research brief (categories) and the v2 spec (owner rail): both are present, tasks first. *(Decision S1.)*

## 2. The change model: stage → review → apply → read back

This one path replaces SetupFlow's four-step ceremony.

1. **Stage.** Changing a control stages it (`config_desired_hold`) and marks the row *changed*. Nothing is written yet. **Undo** is on the row.
2. **Pending strip.** A strip appears at the bottom of the page only while something is staged: `2 changes pending · Review changes · Discard`. At rest there is no Apply bar.
3. **Review** opens one sheet. Each change shows setting, scope, from → to, and **its effect in plain words**, taken from the owner's effect kind:

   | Effect kind | Words |
   |---|---|
   | value-change | Takes effect now |
   | restart-required | Restart Claude to apply |
   | session-restart-required | Next session only |
   | provider-reconnect-required | Reconnects the provider |
   | material-effect | Changes files on this machine |

   One primary action: **Apply changes**.
4. **Apply and read back.** Apply runs `config_plan` → `config_apply` with the owner's plan digest. The owner's disclosure is then re-read. Each row shows **Applied ✓** only when the readback matches, otherwise **Partly applied** with the reason. The receipt is one line in the sheet: *Applied 2 changes · read back 12:04*.
5. **Copy:** zero staged → **"No capability changes."** · refused → **"This change wasn't applied."** + the owner's reason · stale → **"These settings changed. Review the plan again."** · unreadable → **"Couldn't load these settings."** + Retry.

**Read-only settings** show their value with a lock and the owning place, e.g. *Set in Codex's config* with **Open file**. A read-only setting never gets a disabled control. A missing native operation is shown once as a plain sentence naming what is missing (L4), never as a disabled button.

## 3. Sections

Example content below is taken from this machine on 22 Sep.

### 3.1 Status: is everything working?

A handful of cards, each linking to its section:

- **Suite:** version and update state.
- **Harnesses:** *4 ready · 11 detected without an adapter*.
- **Credentials:** *OpenRouter · verified 3h ago*.
- **Secret stores:** *Keychain, 1Password, varlock, pass available*.
- **Skills:** *86 active of 212*.
- **Capability changes:** *No capability changes.*

**Drift appears here first.** When a product's own CLI has changed something (declared ≠ effective), Status shows both sides and the owner's remedy (06 §6.3). O:I never rewrites it silently.

### 3.2 Harnesses: pick a harness by name

One card per harness, grouped:

- **Ready**: Claude Code, Codex, ZCode, Pi. Each card shows name, installed or detected, *81 skills projected*, the owner's effect text (*Restart Claude to apply*, *Next session only*), and its config folder behind *Open*.
  - **Install** where the harness is detected but not installed (Pi today).
  - **Set as default**.
- **Detected, no adapter yet**: Gemini CLI, Hermes, Grok Bot, Ollama, OpenCode, Cursor CLI, DeepSeek Harness, …. Collapsed. Each says *Adapter needed* and links to how adapters are made.
- **Not found**: Aider, Goose, Qwen Code. Collapsed.

The broker is AIKit itself, not a harness, and is not listed. Today `harnessSource.ts:81-100` lists it.

### 3.3 Models: pick a model relative to the harness

- **Default for new chats**: the provider picker (the one live write today, `chat_default_hold`).
- **One row per ready harness**, e.g. `Claude Code · Auto · Balanced ▾`. The picker is searchable and grouped by provider. Each model shows its routes' availability in words:
  - **Usable** (route observed and credential bound; the UI joins routes with the bound credentials, because the route's own condition stays "required" even when a key is bound).
  - **Needs an Anthropic key**, with a link to Credentials.
  - **Local** (Ollama).
  - **Auto keeps its identity**: it names its policy and is never shown as "the first model".
- **Ranking policy**: the eight real policies in plain words. Balanced (default) · Cheapest that fits · Best for the task · Best for the role · Best for the profile · Best quality under budget · Independent reviewer · Local and inspectable.
- **Catalogue**: *345 models · Browse… · Refresh*. Browse opens a searchable dialog, never a wall table.
- **Honesty:** per-harness model choice has no write operation today. Until it does, the row shows the current model read-only, with one sentence naming the missing operation.

### 3.4 Credentials: enter and check API keys *(Decision S2)*

One card per provider that matters: OpenRouter, Anthropic, OpenAI, DeepSeek, Z.ai.

- **Configured**:
  - *OpenRouter · Keychain · verified 3h ago*
  - actions **Verify** (shows working / refused / unreachable with the time), **Rotate**, **Revoke**
- **Not configured**:
  - **Add key**, which reveals a single **write-only** field. Paste, Save: the key goes to the keychain through `aikit credential setup`, and the field empties.
  - **Or use a stored secret**, which takes a reference: `keychain://`, `op://`, `varlock://`, `pass://`.
- **Look for keys on this machine** runs `credential discover` and pre-fills proposals for you to confirm.
- **Never:** a key is never shown again after saving, and there is no reveal or copy of secret material anywhere (DOM, clipboard, logs). This satisfies both ruling 6 ("enter and see API keys") and the v2 no-secret-material rule: you see *that* a key is present and working, never the key.

### 3.5 Skills: skills as settings

- **Scope switch** at the top: *This machine · This project · This session*. It maps to the writable `skills.capabilities` scopes.
- Skills are **grouped by source**: personal 62, mattpocock 41, nara-skills 33, aikit 17, central 8, …. Each row has a toggle, the name, a trust mark, and token cost where the owner supplies it.
- A row opens a **detail sheet** with description, source and version, and the skill's own declared settings (the Hermes pattern).
- **Skill sets** (central-engineering, nara, oi-guardian, …) toggle as groups.
- **Real today:** `skills.capabilities` is writable, so toggles stage real changes. The effect shown is *Next session only*.

### 3.6 Profiles

- Named sparse overlays (`oi.profile/v1`): *None yet* today.
- **New profile from current settings**, and **Use profile**, which stages the profile's changes into the ordinary review.
- **Import** never applies anything.

### 3.7 Permissions

- Per-harness approval and trust as friendly rows. Examples: *Codex trusts this project* and *Codex trusts your home folder* (both read-only today → *Open file*).
- Environment import: *Closed*.
- Trust keys: *157 trusted · 3 reviewed*, with details in a dialog.

### 3.8 Appearance

The existing Visuals view (Light / Dark / System, opening options). Keep as is.

### 3.9 Products (System)

One page per product (Central, AIKit, Actuation, Factory, Workcell, Quaternal Logic, O:I), rendered uniformly from its descriptor:

- **Health:** a line and its degradations.
- **Settings:** friendly rows. Axes appear only when they disagree.
- **Actions:** available ones as buttons; missing ones as a sentence.
- **Known gaps:** collapsed.
- **Show raw:** last and collapsed, the only place JSON appears.

Install and set up (the adoption flow) lives on the O:I page, and its review uses the same sheet as §2.

## 4. State catalogue (Settings)

| ID | State | What you see | Check |
|---|---|---|---|
| S1 | Reading | Section skeleton, "Reading settings…" | No invented values |
| S2 | Unreadable | "Couldn't load these settings." + Retry | Distinct from empty |
| S3 | At rest | No pending strip | Strip absent from the DOM |
| S4 | Staged | Row marked changed + Undo; the pending strip | Nothing written before Apply |
| S5 | Review | One sheet: change, scope, from → to, effect in words | Effects match the owner's effect kinds |
| S6 | Applied | "Applied ✓" per row after readback | The readback value equals the requested value |
| S7 | Partly applied / refused | The owner's reason on the row | Not reported as success |
| S8 | Stale plan | "These settings changed. Review the plan again." | Apply refused until re-reviewed |
| S9 | No changes | "No capability changes." | Only when a plan was read and was empty |
| S10 | Drift | Both sides and the remedy, first on Status | No silent rewrite |
| S11 | Read-only | Lock + owner place + Open file | No disabled controls |
| S12 | Credential entry | Write-only field; empties after Save | No secret in DOM, attributes, clipboard or logs |
| S13 | Credential verify | Working / refused / unreachable + time | Result from the owner's verify |
| S14 | Model availability | Usable / Needs a key / Local | Route joined with bound credentials |
| S15 | Missing operation | One plain sentence naming it | Never a disabled button |

## 5. What changes from today

| Today | Becomes |
|---|---|
| Both sides collapse; an in-page rail of owners plus five new panels | Left body = task sections + Products; the right is a help chat |
| Credential verbs printed as `aikit credential …` text | Buttons calling kernel operations (to be added: setup, verify, rotate, revoke, discover) |
| Model catalogue as a 60-row table; skills as a 212-row table | Searchable pickers and dialogs; skills grouped by source with toggles |
| Harness cards ignore the owner's state, items and effect | Cards use them; the broker is removed |
| SetupFlow: four steps, legal paragraphs, `JSON.stringify` values | Stage → one review sheet → apply → readback |
| "Advanced — the raw record" `<pre>` on product pages; AdoptionFlow `native_plan` JSON | *Show raw*, last and collapsed |
| "Copy id" on every row; monospace profile refs; contract language | Removed; refs only in *Show raw* |
| Walk builds default to the fixture world | Fixtures only with `?fixtures=1` (v2 rule) |

## 6. Kernel operations this needs

These are listed so they are built, not faked:

- `credential_setup | verify | rotate | revoke | discover` over `aikit credential`
- `client_install` over `aikit client install`
- a per-harness model default: a new owner setting in AIKit's config contribution
- `compose_read` for route availability

Skill toggles, profiles and the new-chat default already have operations.

## 7. Decisions for the owner

- **S1: Tasks first, products below.** The research brief groups by category; the v2 spec by owner rail. *Recommend both, task sections first*, since that is how people look for settings.
- **S2: A write-only key field.** Ruling 6 says enter and see keys; the v2 spec forbids a masked token field. *Recommend: a write-only entry that empties after saving*, and you only ever see that a key is present and whether it works.
