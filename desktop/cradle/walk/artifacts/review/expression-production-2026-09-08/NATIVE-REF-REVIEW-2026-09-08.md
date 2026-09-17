# Serialized native reference review — stopped at a binding discrepancy

Standing: bounded same-candidate observations, **no REF/FND acceptance claim**.
Native UI control acquired from integration lead and released at receipt return.
No source edit, build, relaunch, native process/owner change, or source-data mutation.

## Candidate and ground

Selected full bundle path in CUA:
`/tmp/oi-p1-native-target-final-20260908/debug/bundle/macos/O-I P1 Acceptance.app`.
CUA reported **O-I P1 Acceptance**, and only **Editor / Material / Other** in Work.
Executable SHA256 re-read after UI observations:
`34996f3023a7cf1d32c9cc82a05b871b9305d20e73077192e29c1aaa162cc816`, exactly matching native-launch.json.
Reference comparison uses required relationship IDs from
`.superpowers/sdd/cradle-rebuild/FND-00-REFERENCE-MATRIX-2026-09-08.md`, with the
later owner corrections in this task (minimal header, cursor-only resize,
footer-based focus, no sidebar folder arrows, no agent/wiki buttons by Search).

## Stop finding and evidence

Clicking sidebar **System** opened it as a canvas tab and disclosed:
- Ground: `/Users/admin/Central`
- Suite: `/tmp/oi-p1-exact-bindings-20260908/oi`
- Census: `6 disclosed · 1 not disclosed`

The accepted launch instead binds OI_CENTRAL_ROOT to
`/var/folders/q0/g_91z7355tb58425qwg3xcy80000gn/T/oi-cradle-editor-kumDve`.
This is a proven visible ground mismatch; its underlying cause (owner composition
binding versus presentation) was not inferred. No System refresh/capability/config
control was invoked after seeing it. UI actions stopped as required for candidate
decision. Screenshot: `native-system-ground-mismatch.jpg`.

## Required structural rows

“Visual relationship observed” is not functional closure or owner acceptance.
No required row receives full gate closure in this interrupted pass.

| Row | Same-candidate observation | Standing |
|---|---|---|
| A1 | Sidebar, centre and pane framing visible; right region remained collapsed | Open: full three-ground/tiled comparison incomplete |
| A2 | Compact project rows, tabs and controls visible | Open: size/density measurements and second viewport not completed |
| A4 | No narrow-window state exercised | Open |
| A6 | Global top area contains region toggles; management controls are pane-local; no old global split/tile toolbar | Owner-corrected visual relationship observed; functional closure open |
| A9 | Fresh empty canvas not exercised | Open |
| B1 | Kind glyphs, titles, tab close controls and right-side pane tools visible | Open: scrolling/hover/selected geometry comparison not completed |
| B2 | No two-pane focus comparison exercised | Open; latest owner footer convention supersedes original top-highlight row |
| B4 | Pane window-menu affordance visible in AX and screenshot | Open: contextual menu contents not exercised |
| C2 | Wide Search present; no adjacent agent/wiki buttons | Owner-corrected visual relationship observed; latest owner removed those buttons; summon path not exercised |
| D1 | Right layer remained collapsed | Open |
| D2 | Agent planes not exercised | Open |
| D3 | Agent conversation/composer not exercised | Open |
| D4 | Agent Activity not exercised | Open |
| D5 | Agent Context not exercised | Open |
| D6 | Agent Inspect not exercised | Open |
| D9 | File selection/agent independence not exercised | Open |
| D11 | System opens as its own canvas tab from sidebar | Visual placement observed; functional closure open due visible ground mismatch |
| E2 | Rendered HTML not exercised in this pass | Open |
| E3 | Source document tab present from lead's walk; rendered/source distinction not exercised here | Open |
| E4 | Image/PDF not exercised | Open |
| E5 | Unsupported binary not exercised | Open |

## Native expression / resize observations

- Sidebar splitter was AX-visible. Clicking its AX control changed 240→235.5→231
  during attempts; those are not accepted drag proofs.
- Coordinate drag `[221,450]`→`[310,450]` yielded no confirmed width change.
  CUA screenshot is a 1199×768 JPEG; screen/window coordinate correspondence was
  not established. This remains an automation limitation, not a proved drag bug.
- Actual keyboard resize succeeded via **System click → Tab → Right**: AX splitter
  changed **231→247**. Direct click does not establish keyboard focus. Two initial
  key spelling attempts were rejected by CUA and did not execute app keys.
- Native observer log during the pass stayed at `emitters=0`, `peakEmitters=0`,
  `forms=[]`, `frames=17`, `requests=16`, `scheduled=false`; ink was
  `color(srgb 0.512706 0.530275 0.502196)` (desktop body theme).
- Thus quiet collapsed state was observed without scheduled drawing, but **no
  active resize expression was established**, including after the successful
  keyboard width change. This is an unresolved native FND07 observation, not
  overridden by module tests. `native-visual-handoff-observations.json` contains
  bounded native records and hash verification.
- Native themes, reduced motion, hidden-window changes, full agent, two real
  encounters and crossfade were not walked before the stop. All remain open.

## Release

The integration lead was notified immediately of the System discrepancy and
incomplete expression evidence. The isolated app remains on System with sidebar
width 247 and agent region collapsed. **Native UI control released.** The live
user O-I app and resident were never selected for UI actions or modified.

## Integration lead adjudication — acceptance binding failure

The lead traced System's displayed Ground through SettingsPage → kernel ground.rs
→ exact `oi ground status`. The acceptance launch isolated OI_CENTRAL_ROOT and
AIKit home but omitted **OI_HOME**, so O:I correctly read the existing machine
composition. The failed check is therefore attributed to the **acceptance harness
binding**, not to a proven product/UI defect. No UI repair was requested or made.

The lead owns binding an isolated OI_HOME through canonical Central recognition
and O:I ground bind, freezing the complete environment, and relaunching the same
executable before another explicit handoff. Prior source-save and PTY observations
remain bounded to isolated Central and do not establish a full gate pass. The
resize-expression observation remains independently unresolved. Native UI control
was already released and remains released.
