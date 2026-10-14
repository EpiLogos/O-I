# T-CENTRAL-VERTICAL — one real day recovered through the shell

**Source:** WORLD-SHELL-DESIGN §17.2; DLW-PLAN Phase 3 (the two verticals),
the L7/L8 acceptance; LEGACY-CRADLE-RETIREMENT UX cutover gate 2.

## Target

One real day is recovered through the Timeline (day track with return and
handoff clips), the Day document device, a conversation clip and the Nara
device, and the wiki's Constellation, proving Central's resolution without a
separate mode and with no parallel store.

## Acceptance

- Scripted: a walk through the real adapters and selection model (a day, a
  return, a conversation, a wiki subject) keeps one identity in the detail
  row and the projection.
- Native: the same walk by computer use in Central mode.

## Progress

- Leg 1 (14 Oct): all four joins were missing in the live shell (audit, with
  file:line, in the commit). Now, in Central mode:
  - a dated day-track clip sets the spine occasion and the detail row shows
    its Central craft and the Day device for its civil day (the owner's own
    `open-day` reading);
  - a NOW return opens from `central.now.read`, a wiki return through the
    owner's file route;
  - a conversation clip opens the Nara face;
  - a `wiki:node:` ref a return or Day names opens the Constellation focused
    on it.
  Base's Devices chain takes the same occasion's apertures, so the Day die
  docks there, or the owner's non-ready state is named with its op. A browser
  subject still takes precedence. The scripted walk runs on real `ctrl`
  captures with the owner's text redacted (public repo).
- Owner seams, named on the faces:
  - every sampled real day is `uninitialised` (Central `initialise-day`, an
    authenticated write, not fired here);
  - (corrected 14 Oct) `day_read` is handled — `KernelOp::DayRead` landed in
    #237 and answers `day_reading` from `central.day.read`; the earlier note
    here was stale. Its arm is being routed through Central's own read guards;
  - no owner read maps a Nara session-space to its Expression (AIKit
    session-space; `nara_dialogue.rs` holds `expression_ref` in provenance);
  - no temporal stream carries a day-open moment, so a standalone day clip
    needs the kernel to emit one (`temporal_sources.rs`);
  - no real wiki return names a `wiki:node:` ref yet (Central's return
    writer);
  - the `day-now` face is mounted only in the dev harness.
- Open: the native walk (computer use, waiting on the owner's grant).
