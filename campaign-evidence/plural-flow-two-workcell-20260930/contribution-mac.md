Verified read-only: `PRIMARY KEY(session, delivery)`, phases, first/terminal cursors, and the unique partial index permitting one active delivery per session.

Reply correlation must rest on durable delivery identity — the delivery row and its cursor span — never on positional recency.

The row key `(session, delivery)` guarantees each request is a distinct durable fact keyed by caller-supplied `delivery_ref` (with conflict refusal), which outlives any UI client; the partial index guarantees per-session serialization, one active delivery at a time. The `first_cursor`/`terminal_cursor` pair maps that delivery to an exact span of the single autoincrement `encounter_events` journal — the reply reducer is simply the text between those cursors carrying the `delivery_ref`, with per-event `connection_generation` attributing journaled provider events across reconnects.

Recency inference — reading "the answer" off the newest assistant block — breaks precisely:

- **Misattribution:** interleaved multi-recipient turns mean the newest block may belong to a different session, delivery, or connection generation; generation attribution is discarded.
- **Loss on UI closure:** the owner-written journal is the source of truth; a UI-local "newest" read dies when the client closes, though incorporation is owned by the encounter owner, and UI closure is only an observer leaving.
- **Concurrency:** without the serialized row and cursor span, simultaneous deliveries across sessions cannot be assigned to their requesters at all.

MACSIG-OI203-7K2M