# Desktop product reconnaissance — 2026-09-06

Standing: implementation audit, not a new design document. The existing design
set and the owner's three-panel desktop priority remain authoritative.

## What was inspected

- Buzz, /Applications/Buzz.app, live native UI: inbox/list/thread constellation,
  channel surface, contextual header, formatting expansion, Agents navigation.
  No messages sent, no agents started, no settings changed. Private conversation
  contents are not reproduced in this audit or committed as reference screenshots.
- ZCode, /Applications/ZCode.app, live native UI: grouped project/task sidebar,
  workspace-bound composer, side-pane reveal, Review tab, Add tab menu, empty
  provider state, closing the temporary Review tab (which closes the side pane).
  Existing draft left untouched; no task submitted or terminal opened.
- Codex direct computer-use was refused by the tool's app safety restriction.
  No bypass attempted. Official product description consulted separately:
  https://openai.com/index/introducing-the-codex-app/ (published 2026-02-02).
  It establishes project-organized concurrent tasks and in-context change review;
  it does not establish the current installed app's exact visual behavior.
- O-I rebuilt native shell: direct screenshot compared with both accessible apps.

## Findings that change the implementation

1. **Navigation has a stable hierarchy.** Buzz separates global entry points,
   collapsible channel/DM collections, and account ground. ZCode separates global
   commands, grouping mode, project collections, and tasks. O-I currently puts
   World, workspace selection, creation, rename, duplicate context, and region
   toggles in a single undifferentiated bar. Its project list is a diagnostic
   report of paths and health. D16/APP-SPEC §3 require a workspace navigator,
   not this report. Workspace identity belongs at the navigator head; project
   and open-surface collections need deliberate row hierarchy. Ground metadata
   belongs in inspectable depth.
2. **The frame is visually stable; the surface carries local actions.** Both
   references use compact aligned headers and small action clusters. O-I stacks
   an application toolbar, an Expand/Collapse toolbar, and another World header.
   Remove duplicate chrome. Each region gets one coherent header. Navigation
   commands, surface actions, and depth controls must be distinguishable.
3. **Three regions are a relationship, not three blank boxes.** Buzz's inbox
   selection determines the adjacent thread; ZCode's side pane has actual tabs
   with their own tools and a reversible open/close path. O-I's right region
   currently defaults to a bare label and three generic buttons. A contextual
   region needs an explicit subject header and meaningful planes; its focus
   comes from the kernel and never from locally duplicated selection.
4. **Depth is disclosed at the point of use.** Buzz adds formatting to the
   composer in place; ZCode adds Review/Terminal/Browser through a small tab
   menu. O-I currently displays canonical hashes, raw refs, bound/unbound labels,
   and verbose provenance as ordinary chrome. Keep identity intact underneath;
   show human names first, put ref/revision/provenance in focused inspection.
5. **Density is designed.** Reference navigation uses compact aligned rows,
   restrained icons, consistent indentation, subtle selected/hover states and
   ellipsis. O-I has widely spaced text rows, wrapping paths, several competing
   type sizes, and large default-looking action buttons. House tokens need an
   application-scale composition: row heights, icon grid, type hierarchy,
   spacing and hit targets must work together. Do not copy Buzz's gradient,
   agent-card grid, or either app's brand palette as a substitute for this work.
6. **The empty state offers the next real act.** ZCode's empty side pane offers
   actual surfaces, then a real provider-specific absence if Review cannot read
   a repository. O-I's unbound text composer suggests agency that is not wired.
   An empty workspace should offer real surface/navigation actions. No fake
   agent composer or inactive product menu should be used to fill space.
7. **Navigation and reversibility are part of polish.** Reference back/forward,
   add/close tabs, compact menus and workspace scope are not decoration. O-I
   needs a coherent action registry for the frame, keyboard/pointer parity,
   predictable focus restoration, resize affordances and full-view return.
   Fixing the current failed full-view/restore checks is part of this work.

## Concrete shell target within the existing spec

- A durable navigator containing workspace identity, global search/action entry,
  projects/Worlds and their available surfaces. Compact sections; present
  commands only where they execute real operations.
- A central surface well with proper tab hierarchy, useful splits and resizing,
  scoped title/context, and surface-local actions. Empty means no surface open,
  with a real way to open one; it is not automatically a pretend Flow.
- A contextual right host with subject/session identity, its own tab/plane
  hierarchy and local actions. Same stable subject across all regions. Agency
  absence remains truthful until the native session host is integrated.
- One language for region collapse/expand/full controls, hover/focus/selection,
  menus, row density and native window chrome, using O-I's token roles.
- Workspace switching/relaunch restores the constellation and held writing;
  source recovery revalidates native authority and revisions. Events never
  rearrange the regions. Preserve canvas room by degrading sides first.

## Acceptance, not a screenshot-only redesign

The current shell is unfinished and not accepted. The last fully green suite
before spatial edits was 172 checks. Spatial integration presently fails old
rest/synthetic-tab assumptions and has real full-view/restore issues. Retain
behavioral coverage while replacing synthetic surfaces with real Central
sources. Re-run the full suite and native walkthrough after the coherent shell
is implemented. Do not publish a green claim for the current branch state.
