# T-AE-C2-WORDING — the founding corpus's name leaves the atlas's UI copy

Label: wayfinder:task (no UI leg for the code; the copy is seen at the screen pass)
Claimed-by: —
Blocked-by: the Archetypal-Earth curation lane (AE's working tree carries its
uncommitted `src/` edits — foreign, never touched); see "Where".
Found by: T-AE-REPORT (13 Oct 2026).

## Finding

The re-ported atlas (pinned AE `5fe5117`) carries no corpus bytes (no
quotations or locators in code), but 42 modules still name the founding
corpus in user-facing copy: lens blurbs (`shell/lens.ts:92-94`), the landing
line (`shell/landing.ts` LANDING_COPY), basis titles ("Asserted in Jung's own
text" outside Aion), the Red Book's mode strings, filter labels
(`shell/filter.ts`). C2-b8: the corpus is named by its provider, in data
(`FieldMeta.provider.labels`), never in code.

## Where

Upstream first. AE already took the C2 seam upstream once (`types/corpus.ts`,
`data/corpus.ts`, `ui/passage.ts`, merged at T-AE-REPORT). Doing the wording
in AE keeps the port verbatim (each port-side change is one more recorded
adaptation in `PORT-PIN.json` that every re-port must re-apply). So: when
the AE curation lane has landed and AE's tree is clean, change AE's copy to
read `meta.provider.labels.*` with neutral defaults and AE's own provider
data supplying today's words; then re-port (`atlas-port-pin.mjs --drift`
names the modules) and drop the matching adaptations.

## Acceptance

- AE: no user-facing string names the corpus; AE renders exactly as before
  over its own provider labels (AE's tests + its visual check).
- The port: `atlas-port-pin.mjs --check` green with fewer recorded
  adaptations; `grep -rn "Jung" src/projections/atlas/src` finds comments and
  data-shape names only.

## Resolution

—
