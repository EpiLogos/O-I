# Settings contribution

`../panels/settings.tsx` registers `world.settings` with the existing panel
registry. The shell owns opening, native admission, the retained work, and
Return focus. The contribution stays mounted while hidden to retain drafts.

`host.ts` exposes `configureSettingsHost(adapter, onReturn)` and
`openSettings(request)`. `SettingsEntry.tsx` supplies contextual entries for
an exact native setting and scope, or the Machines and Automations pages.
Use the actual scope subject and a new `requestId` on each opening.
Native admission calls `configureSettingsHost(adapter)` without a second
argument and preserves the frame's Return callback. Frame teardown may clear
that callback with an explicit `undefined` second argument.

The window is the catalogue design `settings:window`
(`../inhabitants/catalogue/panels/settings__window.tsx`, manual §10.10), drawn
by the device host in `SettingsWorkspace.tsx` on a binding composed from the
window's engine (registry, resolutions, local changes, review, apply, reset)
and the pages' hooks in `windowPages.ts`. `windowValues.ts` maps each owner
reading to the design's keys and classifies every key the design reads or
presses (`SETTINGS_WINDOW_WIRING`). The design draws every page; the earlier
page components were ported into these modules and retired.

`adapter.ts` reuses Cradle configuration documents and `ConfigPlaneSource`.
The native configuration receiver is `../native/configuration.ts`; its
host admission is in `../native/Foundation.tsx`. Apply must consume the exact
reviewed owner plans. Reset removes an override. Local edits and successful
renderer validation do not establish persistence.

Optional native operations are explicit adapter capabilities. Remote
machines use `machines.ts::RemoteMachinesSource`; routine authoring uses
`routines.ts::RoutineAuthoringSource`. Bind them in the current native access
epoch and preserve owner-minted proof, authority, schedule, acknowledgement
and connection documents. The remaining operation bindings are not implied
by registration of the settings panel.

The single coverage map, exact native-wiring handoff and executed interaction
evidence are maintained in the existing programme:
`ProjectCentral/docs/5-evidence/world-shell/SETTINGS-COVERAGE.md`
and its `settings-evidence/` directory. The frontend census retains all 50
captured native descriptors; ordinary instrument parameters belong to their
working editors and arrive through `pointOfUseEntries` and `navigate`.

From `packages/live-shell/ui`, run:

```sh
node --experimental-strip-types --test src/settings/*.test.mjs
npx tsc --noEmit --pretty false -p src/settings/tsconfig.check.json
npm run build
```

The first two checks cover the settings contribution and imported native
types; `tests/settings-window.test.mjs` covers the window on its design. The full build also consumes the shell and other owners' source.
Explicit development scenarios are guarded by `import.meta.env.DEV`, labelled
in the UI, and make no native writes. The development-only
`/app/src/settings/window-preview.html?settings-scenario=ready` route mounts
the actual registered contribution, including its modal and Return behavior.
Production entry remains the shell's Settings command / Cmd+,.
