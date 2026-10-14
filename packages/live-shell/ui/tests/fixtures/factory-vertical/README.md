These files are SHAPE fixtures for the Factory vertical walk (14 Oct 2026), placeholder-valued for a public repo.

- `inhabitation.placeholder.json` is shaped as `factory.inhabitation-reading/v1`: the field names, facet forms (`state`/`value`), custody and occupant keys follow `desktop/cradle/src/contributions/factory/inhabitation/model.ts`.
- `attempt-return.placeholder.json` is shaped as `factory.attempt-return-reading/v1` with `attempt.record.readableReturn`, the owner's `attempt return` reading (`desktop/cradle/src/contributions/factory/desk/runReturnReading.ts`).
- Refs keep the owner's grammar (`run:`, `journey:`, `factory:custody:`, `central:position:`, `central:path:<root>:<path>`, `wiki:node:`, `agent-session/`); subjects, summaries and paths are neutral.
- The walk checks the key sets of `readableReturn` and the occupant body against the real capture `desktop/cradle/tests/fixtures/factory-live-events.json` (specimen ground, 26 Sep 2026), so the placeholders cannot drift from the owner's shape.
- No owner capture of a live run's Return exists on this machine yet; the walk says so and does not claim one.
