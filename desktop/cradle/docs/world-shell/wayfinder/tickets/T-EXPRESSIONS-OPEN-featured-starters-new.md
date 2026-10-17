# T-EXPRESSIONS-OPEN — Featured, Starters and New open real native Expressions; works always enumerate

FOUNDATION §4 "Can start now"; PORT-AUDIT §D M6 and M7, §E 6 and 11.
Builder: Sonnet. Wave 1, 14 Oct 2026.

## Realises

- Manual `docs/dlw/DLW.md` §7: "You build in scenes. An Expression holds its
  scenes the way a Live track holds its clips … capture the figure as a new
  scene, and save." "The library of Expressions people make is how they
  learn." §10.3: "To open it, double-click it or drag it into a pane."
- Craft floor: `world-shell-mockup.html` `renderBrowser` (line 1479) for the
  browser rows; the frame's own Library (`desktop/cradle/expressions-app/field-studies-journeys/src/library.ts`)
  for what Featured and Starters are.
- Lock §2.4 (Expressions — the form, sounding).

## What is true (PORT-AUDIT B3, code-read)

- `components/nativeExpressionCommands.ts:39` `FORK_REASON` says the shell
  cannot call `save_as`. False: the kernel serves `create`, `fork`, `save_as`
  (`desktop/cradle/kernel/src/expression.rs:907` operations list), the
  boundary relays them (`packages/expressions-boundary/src/protocol.ts:18`,
  `host.ts:248`), and the shell already calls `save_as`
  (`packages/expressions-boundary/src/nativeMaterials.ts:271`).
- The frame's Library opens a featured work by forking it
  (`field-studies-journeys/src/app.ts:1746–1748`) and commits forks natively
  (`actPanel.ts:132–136`). That sequence is the port source.
- `panels/expressions.tsx:198` skips `enumerate()` when a known ref boots, so
  `nativeWorks` stays empty while a work is open.

## Work

1. **Open on a Featured or Starter row** = the frame's sequence, through the
   kernel-expression channel the panel already holds: `create` (from the
   starter's document) or `fork`, then `save_as` into the owner's folder, then
   open the result (`host.openExpression(ref)` or the panel's existing open
   door, `workspace.requestExpression`). Port the sequence; do not invent a
   new one. A refusal shows the owner's own error text on the row.
2. **New** = `create` with a fresh ref and title, then open it.
3. **Always enumerate**: after boot, in every case, list the works and
   publish them (`workspace.publishWorks`), so the browser's works and
   Technē's Sources list them while a work is open.
4. Remove `FORK_REASON` and every disabled-open row it fed.
5. Tests: the open sequence over a stub channel (create/fork → save_as → open,
   in order, with the refusal path), and enumerate-after-known-boot.

Persistence across restart is N1 (lead), not this ticket: a work opened here
lives as long as the kernel owner's process until N1 lands. Say so in the
return; do not work around it.

## Zone

- `packages/live-shell/ui/src/components/nativeExpressionCommands.ts`
- `packages/live-shell/ui/src/components/NativeExpressionCollections.tsx`
- `packages/live-shell/ui/src/panels/expressions.tsx` (the enumerate path and the open door only)
- `packages/live-shell/ui/tests/native-expression-open*.test.mjs` (new)
- `packages/expressions-boundary/src/**` only if a relay is truly missing (say which)

## Done when

- On screen (lead): Expressions › Featured › "O:I — the mark" › Open opens a
  native Expression; the stage draws it and the device rack fills. New opens
  an empty work. The works list shows both.
- Checks: `npx tsc --noEmit -p .` in `packages/live-shell/ui`;
  `(cd desktop/cradle && npx tsc --noEmit)`;
  `(cd desktop/cradle/expressions-app && npm run lint)`;
  `node --experimental-strip-types --test tests/native-expression-open*.test.mjs tests/expressions-*.test.mjs`
  in `packages/live-shell/ui`; `npm test` in `packages/expressions-boundary`
  if touched.
