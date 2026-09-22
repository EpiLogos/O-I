# Harness settings & acceptance research — 2026-09-22

Owner commission: "use other harnesses as a guide — JUST EXPOSE THE OPTIONS
THEY EXPOSE" (Hermes, Claude Code, Codex for configuration coverage; Buzz,
Grok Bot, DeepSeek Harness UI for visual reference), plus a scour of our own
test suite for demo/below-bar assertions. Six research passes ran this day;
this dossier is the synthesis and the working brief for the settings rebuild
and the acceptance-protocol work. Screenshots: `research/ui-research-2026-09-22/`.

## 1 · The convergent settings grammar

All three reference harnesses — and AIKit itself — agree on the same shape.
This convergence is the spec signal; Cradle's settings should follow it, not
invent a fourth variant:

1. **One canonical store, many surfaces.** Hermes `config.yaml`, Claude Code
   `settings.json`, Codex `config.toml` — the wizard/panel/toggles all write
   the same keys. No UI-only settings. (Cradle's chat-defaults file and
   kernel ops already fit this; the UI must have no second store.)
2. **Friendly rows on top, dialogs for lists, raw format as escape hatch.**
   Claude Code's `/config` is plain-language rows, one control each; lists
   (permissions, MCP, plugins, skills) get dedicated dialog managers
   (`/permissions`, `/mcp`, `/skills`). Codex has no monolithic settings at
   all — a deliberately tiny interactive surface plus slash managers, TOML as
   the full escape hatch. DeepSeek Harness: settings **modal with its own
   mini-nav** (General / Models / Built-in plugins / Agent presets) plus an
   "Open configuration file" button.
3. **Masked credential status by law.** Claude Code: OAuth in OS keychain,
   API-key consent stored as a truncated hash, `/status` shows state only.
   Codex: `login status` prints "Logged in using ChatGPT"; `mcp list` masks
   every env value; `doctor --json` is a redacted report. Hermes: `auth
   list/status` never print keys; `doctor --live` does one bounded real call.
   **AIKit already implements all of this** (`credential list/explain/verify`
   carry no field a value could occupy).
4. **Catalogs and profiles are data, not code.** Codex `model_catalog_json`
   (per-provider static model list) and sparse-overlay profile files
   (`zai.config.toml` layered on base, selected by `-p`); Hermes
   `model_aliases` + fallback chains; Claude Code aliases (`sonnet`,
   `opusplan`). AIKit's owner-catalogue layer (`~/.aikit/model-catalogue/*.json`)
   and ranking policies are the same idea.
5. **Skills/extensions are a first-class settings domain with their own
   declared settings.** Hermes is the lead: per-skill settings declared in
   SKILL.md frontmatter, auto-prompted at setup, shown grouped under "Skill
   Settings"; per-platform enable/disable via checkbox UI; per-skill token
   cost visible. Claude Code `/skills` dialog: list with source + token cost,
   Space/Enter cycles visibility. Codex: `[[skills.config]]` enabled toggles.

## 2 · The Cradle settings blueprint (mapped to what exists)

The decisive finding: **the backend is already built.** `aikit system --json`
emits `oi.product-settings-disclosure/v2` — ten sections, each setting with
`axes{active, declared, effective, staged}` + drift — and `aikit
config-contribution --json` gives the six owner groups. The refusal strings
are already plain-language UX copy ("provider:anthropic needs a credential
and none is bound; bind it with `aikit credential setup credential:anthropic`").
The desktop ships diagnostic dumps instead of rendering this contract.

Proposed sections (each → its real backend):

| Section | Controls | Backend (exists today) |
|---|---|---|
| **Status** | Version, auth state per provider (masked), model in use, connectivity, varlock daemon locked/unlocked | `aikit status`, `credential list`, `system --json` |
| **Harnesses** | One card per harness (detected/installed/items/effect "restart Claude"), install button | `aikit client status` / `client install` |
| **Models** | Harness → model picker fed by route availability (credential condition + hint per route); default per harness; ranking policy (7 named); catalogue browse + refresh | `aikit compose --json`, `model-catalogue show/refresh`, `harness run --dry-run` (launch preview) |
| **Credentials / API keys** | Provider cards (DeepSeek-Harness pattern): key field (write-only) → `credential setup --from-env`; or "declare location" (`varlock:// pass:// keychain:// op://`); Discover button pre-fills proposals; Verify button (working/refused/unreachable + timestamp); Rotate; Revoke; masked list | `aikit credential discover/setup/verify/rotate/revoke/explain`; varlock resolver states |
| **Skills** | List with source, trust level, token cost; enable/disable per scope (machine/project/session); source sync/promote/rollback with digests; declared per-skill settings prompted; overlay editor | `aikit enable/disable --scope`, `source *`, `set *`, `skill overlay`, `method list` |
| **Profiles** | Named sparse overlays (Codex pattern) → aikit contexts/profiles; dropdown selection | `aikit use <PROFILE>`, resolution.profiles |
| **Permissions/Trust** | Approval defaults, capsule trust revisions, allowlists | `aikit trust show/record`, scopes toml |
| **Appearance / General** | Already fine (VisualsView is the one surface that matches the register) | visuals store |

Deletions this implies (the chat-over list, now concrete): SetupFlow's
discover→configure→review→result ceremony from the default path, ProfilesView
contract-speak, the census tables in ChatHarnessPanel, DevView (ships raw
owner JSON in production today), per-product "Developer record" dumps, the
GroundChooser "Recognition details" dump, AdoptionFlow's `native_plan` dump.
Advanced material lives under an "Advanced" disclosure, never the primary
view (spec L5: primary view contains no raw JSON — the walk check for L5 is
still unimplemented; see §4).

## 3 · Sidebar / UI grammar from Buzz, Grok Bot, DeepSeek (screenshots preserved)

Buzz (Block, Nostr collab platform — Tauri/React like Cradle; harness is its
word for agent runtime), Grok Bot (xAI's persistent-agent product), DeepSeek
Harness (`dsh`, developer preview with its own Web UI). The convergent
grammar, mapped to Cradle:

1. **Search/command row first in the sidebar** (Buzz "Search everything ⌘K"
   is row 1; DeepSeek top-bar Search ⌘K). Cradle's left navigator has no
   persistent search by law — the command aperture is ⌘K; the pattern
   supports keeping it the primary entrance.
2. **Object rosters, not chat history** — Buzz Inbox/Projects/Agents with
   grouped sections and unread dots; Grok Bot's sidebar is a Bot roster with
   per-row live status. Cradle's per-project navigator rows are the same
   object shape; rows should carry live state (presence dot / status glyph),
   which the existing glyph system already supports.
3. **Agent status lives in the frame**: Buzz pins "Honey: Working" under the
   composer; Grok animates presence avatars and shows a title-bar icon when
   the bot's computer is active. **The steal: a Status → Preview → Takeover
   gradient** (Grok's own levels) for agent work in Cradle's right panel — a
   presence dot by default, the pinned panel on demand, full takeover for
   intervention. This is the replacement shape for the "returns boxes": the
   returned material renders in the context tabs and canvas embeds, with a
   presence/state channel in the frame — no word "returns" anywhere.
4. **Mode/model pickers live on the composer** as labeled dropdown + toggle
   chips (Grok Fast/Auto/Expert/Heavy; DeepSeek DeepThink/Search chips), not
   in a sidebar. Cradle's chat composer should carry harness/model selection
   (the per-chat `model-select` already exists — promote it to the composer
   grammar).
5. **Agent output renders as cards in the transcript** (Buzz PR embed cards,
   Grok Routine cards) — never raw logs. Maps to the Inspect-plane reader
   registry in the sidebar lane.
6. **Settings as modal with mini-nav, provider cards, single Apply,
   write-only secrets** (DeepSeek Harness `dsh_models_page.png`) — the
   concrete visual pattern for §2's Credentials section.
7. **Workspace gate before composer** (DeepSeek: composer visibly disabled
   until a workspace is chosen) — Cradle's GroundChooser/boot phases already
   embody this; keep it visible rather than hidden.

## 4 · The acceptance protocol (spec-derived fixtures; positive + negative rosters)

The scour quantified the failure: **~25–30% of cradle UI assertions sit below
the "working as intended" bar.** By surface: Factory/Desk ≈90–100% proven on
the fixture world (invented agents, simulated runs — the only proof those
surfaces have), Configuration ≈70% (frozen fixture registry + verbatim wire
snapshots; one live group), Wiki/Search ≈40–50%, Documents/Day/Editor ≈10%
(`document-entry`/`day-edit` are the model cells: real bytes, CAS, "the face
never wrote bytes"). Eight mechanisms named: presence-not-presentation
(~97 walk checks are `count()>0`), controlled-standing-creep (14 receipt
writers whose `passed:true` artefacts look like acceptance), fixture-as-product,
weak-invariant (the rest reserve check couldn't tell stacked from tallest),
wire-fidelity-as-requirement, vocabulary-as-requirement, print-as-verification
(probes that always exit 0), fixture modules in the shipping tree.

**Protocol (owner ruling 8):** acceptance fixtures derive from the designs —
each spec row becomes a behavioral check; the known plausible compromises are
removed from acceptance. Both rosters:

**Negative roster (banned; enforcement)** —
1. Verbatim wire/demo snapshots as requirements (`chat-settings` LIVE_*
   constants) → live-read round-trip required.
2. Presence-only UX claims (`count()>0` proving "presents/expands") → pair
   with content equality or geometry; grep-flag bare presence checks.
3. One-sided layout invariants (`height >= tallest-0.5`) → two-sided ±0.5px
   + exercise the triggering transition.
4. Controlled receipts in acceptance shape (`passed:true` + `standing:
   controlled`) → receipt lint: committed receipts need `spec_ref` + `grade`;
   controlled ⇒ grade D; evidence aggregators may not emit `passed:true`
   without ≥1 grade-A receipt (`verify-shell-evidence.mjs` is the offender).
5. Acceptance on the dev fixture world for surfaces with a real owner route
   → fixture-backed scenarios excluded from the acceptance set; production
   bundle must contain zero fixture markers (`verify-live-settings.mjs` is
   the seed).
6. Static imports of fixture modules outside the walk gate → grep.
7. Probes without a failure path → must exit nonzero on failure or be named
   `*.diagnostic.mjs` (footer-probe, tab-pane-probe).
8. Raw dumps in the primary view → implement spec 06 §7 L5 as a walk check
   (no visible `<pre>`/JSON text node outside a disclosure).
9. Attribute vocabulary as proof of legibility (`data-reconciliation='drifted'`)
   → require the visible-text counterpart.
10. Controlled double where the spec row names live/installed/human → may
    support, never discharge the row (the `local-shell-acceptance.mjs`
    consent-gated pattern is the required shape).

**Positive roster (seeds that already meet the bar)** —
`document-entry.mjs` (byte-exact carrier), `day-edit.mjs` ("the face never
wrote bytes"), `verify-live-settings.mjs`, `local-shell-acceptance.mjs`
(consent-gated live proof), `rest.mjs` honest-unavailability legs,
`system-settings.mjs` L1/L3 honesty checks, `factory-development.mjs`
real-read legs, `knowledge-projection-geometry.mjs` (rendered-pixel
measurement technique), `personal-web-browser.mjs` (controlled inputs, real
behavior), `kernel-cas.mjs`.

**Spec→fixture derivation map:** 06-SYSTEM-SETTINGS §7 table (L1–L6, §6.2
bootstrap, §6.3 drift — L5/6.2/6.3 not yet implemented as checks);
STORIES.md UI stories → one walk scenario each; FACTORY-AGENCY §4/§5/§12 →
Factory acceptance restated over real kernel legs; 05-EXECUTION §3 remains
the constitutional basis ("walks are the acceptance").

**Fix first:** (1) the Factory/Desk fixture-probe family — restate over
`factory-development.mjs` legs; (2) `chat-settings.test.mjs` — live round
trips; (3) `configuration.mjs` + `verify-shell-evidence.mjs` — row-by-row
live acceptance + the receipt lint.

## 5 · Evidence index

- Harness research: Hermes installed at `~/.hermes` (v0.21.1; config.yaml,
  `hermes config/auth/skills/doctor` families); Claude Code local install +
  docs (settings.json schema, keychain service `Claude Code-credentials`,
  `/skills` `/mcp` `/plugin` dialogs); Codex 0.155.1 (`~/.codex/config.toml`
  101 root properties, `zai.config.toml` profiles, `models.json` catalog).
- AIKit: `credential` five-verb contracts, keychain service
  `dev.aikit.credentials`, `~/.aikit/state/credentials/*.json` (no secret
  field), varlock as native default of `central.security/v1`,
  `system --json` (`oi.product-settings-disclosure/v2`) + `config-contribution`
  as the render-ready contract; `compose --json` route availability.
- Visual: 63 screenshots at `research/ui-research-2026-09-22/` (Buzz official
  repo shots incl. channel/agents/media-review; Grok home + model picker +
  Grok Bot design-post figures; DeepSeek Harness settings modal + provider
  cards). Login-walled surfaces (grok.com in-app, chat.deepseek.com) rest on
  official release notes/design posts, cited in the session record.
- Test scour: catalogue with file:line for every below-bar specimen; full
  reports in the 2026-09-22 session record,
  `ProjectCentral/now/agents/ui-convergence-review-seven-lanes-surveyed-2026-09-22.json`.

## 6 · Proposed execution order (owner to rule)

1. **Acceptance floor first** (kills the regression engine): negative-roster
   lints (receipt lint, probe exit paths, L5 no-raw-JSON walk check,
   two-sided geometry) + fix the three worst offenders. Small, self-contained.
2. **Settings rebuild** per §2, rendering the AIKit disclosure contract —
   harness cards, model-per-harness, credential cards with verify/rotate,
   skills-as-settings; delete the dumps. Desktop-only; backend exists.
3. **Sidebar grammar pass** per §3: presence gradient (Status/Preview/
   Takeover), composer-carried pickers, cards-not-logs, kill "returns".
4. **Wedge re-authoring** with the owner's eye (no code exists to restore).
5. **Card button** once the Epi-Card form HTML is realized from the specced
   system (`Antykathera-Essay-Work/submission-package/epi-card-system-v1` +
   the `<epi-card>` component in the recovery bundle); Graph routes to the
   existing wiki-map/expression Graph aperture.
