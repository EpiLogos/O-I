/** The K9 controlled host — an O:I-side stand-in for QL-MEF's
 * `ql-focused-host` owner, faithful at the request/receipt seam.
 *
 * It owns NO QL domain law: the Bimba disclosure, focus payload, clock
 * identity and sample field here are explicit controlled fixtures whose
 * standing is always "controlled-k9-host-walk". This is repository-native
 * evidence that the desktop consumes the focused-host contract honestly —
 * producer truth lives in QL-MEF (PR #188, merged), and owner-machine
 * sensory validation remains a separate receipt.
 *
 * Admission mirrors the accepted host law: one exact request sequence, the
 * caller's expected generation/samples must match the owner's cursors
 * (never retried after unknown), refusals are explicit, and only field
 * operations (advance / set-clock-axis) carry an owner receipt. */

const HOST_RECEIPT = "ql.focused-host-receipt/v1";
const REQUEST_CONTRACT = "ql.focused-host-request/v1";
const SNAPSHOT_CONTRACT = "ql.focused-instrument/v1";
const BIMBA_CONTRACT = "ql.focused-host-bimba-navigation/v1";
const FRAME_CONTRACT = "ql.continuous-field/v1";
const STANDING = "controlled-k9-host-walk";

export function createControlledHost({
  instanceRef = "focused:host-walk",
  eventRef = "event:host-walk",
  subjectRef = "subject:nara-walk",
  samples = 65536,
  sampleRate = 48000,
} = {}) {
  let generation = 1n;
  let sampleClock = 512n;
  let sequence = 0n;
  let refuseNext = false;
  let closed = false;
  const calls = [];

  const cursor = () => ({
    event_ref: eventRef,
    subject_ref: subjectRef,
    profile_generation: 1,
    field_generation: String(generation),
    samples_elapsed: String(sampleClock),
  });

  const targets = () => Array.from({ length: samples }, (_, i) => ({
    identity: i,
    constituent: "#" + (1 + (i % 7)),
    position: [
      Math.sin(((i % 256) / 255) * Math.PI * 2 + Number(generation) * 0.08) * 0.45,
      Math.cos((Math.floor(i / 256) / 255) * Math.PI * 2 + Number(generation) * 0.05) * 0.45,
      0,
    ],
  }));

  const frame = () => ({
    schema: FRAME_CONTRACT,
    event_ref: eventRef,
    subject_ref: subjectRef,
    registry_revision: "registry:r1",
    geometry_ref: "geometry:host",
    material_ref: "material:host",
    model_ref: "model:host",
    sample_rate: sampleRate,
    generation: String(generation),
    samples_elapsed: String(sampleClock),
    standing: STANDING,
    audio: [],
    presentation_units_per_metre: 1,
    clock: {
      field_ref: "#3-0",
      centre_ref: "#3-5-5/0",
      generation: String(generation),
      inscription: { turns: "0", half_degrees: 1 },
      lensing: { turns: "0", half_degrees: 2 },
    },
    m2_identity: { event_ref: eventRef, profile_generation: 1 },
    amplitudes_metres: [[0, 0]],
    targets: targets(),
  });

  const selection = () => ({
    contract: "ql.focused-instrument-bimba-selection/v1",
    selection_ref: "bimba:host:1",
    coordinate_ref: "#1",
    source_ref: "source:host",
    source_revision: "registry:r1",
    disclosure_ref: "disclosure:host:1",
    subject_ref: subjectRef,
    field_constituent_ref: "#1",
    assertion_refs: [],
  });

  const bimba = () => ({
    contract: BIMBA_CONTRACT,
    source_revision: "registry:r1",
    selected_ref: null,
    items: [{
      selection: selection(),
      label: "Controlled host centre",
      face: "bimba",
      depth: 1,
      relation_refs: [],
    }],
    standing: STANDING,
  });

  const view = () => ({
    schema: SNAPSHOT_CONTRACT,
    available: true,
    event: { event_ref: eventRef, subject_ref: subjectRef, profile_generation: 1, registry_revision: "registry:r1" },
    live_cursor: cursor(),
    presented_cursor: cursor(),
    temporal: "live",
    tracking: "follow",
    selection: null,
    selection_standing: null,
    selected_target: null,
    focus: { focus: "m3", available: true, current: true, source_refs: ["source:host"], payload: {}, standing: STANDING },
    clock: { presentation: { view: "assembled" }, owner_clock: null, field_ref: "#3-0", centre_ref: "#3-5-5/0", standing: STANDING },
    vak_expression: null,
    vak_performance: null,
    personal_current: false,
    standing: STANDING,
  });

  let current = view();
  const nav = bimba();

  const base = () => ({
    schema: HOST_RECEIPT,
    instance_ref: instanceRef,
    request_id: null,
    last_request_id: String(sequence),
    status: "ready",
    available: true,
    error: null,
    standing: STANDING,
  });

  const ready = () => ({ ...base(), snapshot: structuredClone(current), bimba: structuredClone(nav), owner_receipt: null });

  const reply = (request, status, owner) => ({
    ...base(),
    status,
    request_id: request.request_id,
    last_request_id: String(sequence),
    error: status === "ok" ? null : "controlled-refusal",
    snapshot: structuredClone(current),
    bimba: undefined,
    owner_receipt: owner,
  });

  const transport = {
    get closed() { return closed; },
    close() { closed = true; },
    errors: [],
    async request(request) {
      calls.push(structuredClone(request.command));
      try {
      if (request?.schema !== REQUEST_CONTRACT) throw new Error("foreign focused-host request schema");
      if (request.instance_ref !== instanceRef) throw new Error("foreign focused-host instance");
      if (request.event_ref !== eventRef || request.subject_ref !== subjectRef) throw new Error("foreign focused-host event or subject");
      sequence += 1n;
      if (BigInt(request.request_id) !== sequence) throw new Error("stale, repeated or skipped focused-host request sequence");
      if (BigInt(request.expected_generation) !== generation) throw new Error("foreign currentness: the field generation moved");
      if (BigInt(request.expected_samples_elapsed) !== sampleClock) throw new Error("foreign currentness: samples moved");
      } catch (error) { this.errors.push(String(error?.message ?? error)); throw error; }
      if (closed) return { ...reply(request, "unknown", null), error: "the controlled host is closed" };
      if (refuseNext) { refuseNext = false; return reply(request, "refused", null); }
      const command = request.command;
      const previous = current;
      let owner = null;
      if (command.operation === "set-focus") {
        current = structuredClone(current);
        current.focus = { ...current.focus, focus: command.focus };
      } else if (command.operation === "select-bimba") {
        const known = nav.items.find((item) => item.selection.selection_ref === command.selection_ref);
        if (!known) return reply(request, "refused", null);
        current = structuredClone(current);
        current.selection = structuredClone(known.selection);
        current.selection_standing = "current";
        current.selected_target = structuredClone(frame().targets[0]);
        nav.selected_ref = command.selection_ref;
      } else if (command.operation === "clear-selection") {
        current = structuredClone(current);
        current.selection = null;
        current.selection_standing = null;
        current.selected_target = null;
        nav.selected_ref = null;
      } else if (command.operation === "set-tracking") {
        current = structuredClone(current);
        current.tracking = command.tracking;
      } else if (command.operation === "freeze") {
        current = structuredClone(current);
        current.temporal = "frozen";
      } else if (command.operation === "resume-live") {
        current = structuredClone(current);
        current.temporal = "live";
      } else if (command.operation === "assemble-clock") {
        current = structuredClone(current);
        current.clock = { ...current.clock, presentation: { view: "assembled" } };
      } else if (command.operation === "explode-clock") {
        current = structuredClone(current);
        current.clock = { ...current.clock, presentation: { view: "exploded", pair: command.pair ?? null } };
      } else if (command.operation === "advance") {
        if (command.frames > 0) {
          sampleClock += BigInt(command.frames);
          current = view();
          if (previous.selection) {
            current.selection = structuredClone(previous.selection);
            current.selection_standing = "field-advanced";
            current.selected_target = structuredClone(frame().targets[0]);
          }
          current.focus = { ...current.focus, focus: previous.focus.focus };
          current.tracking = previous.tracking;
          current.temporal = previous.temporal;
        }
        owner = frame();
        // An advance that moves the native cursor delivers the PCM for the
        // moved interval — a silent cursor move is inadmissible by law.
        if (command.frames > 0) owner.audio = Array(Number(command.frames)).fill(0.05);
      } else if (command.operation === "set-clock-axis") {
        generation += 1n;
        current = view();
        current.clock = { ...current.clock, presentation: { view: previous.clock.presentation.view } };
        owner = frame();
      } else {
        throw new Error(`unsupported focused-host operation: ${String(command?.operation)}`);
      }
      return reply(request, "ok", owner);
    },
  };

  return {
    transport,
    ready,
    calls,
    get refuseNext() { return refuseNext; },
    set refuseNext(value) { refuseNext = value; },
    get generation() { return String(generation); },
    get sequence() { return String(sequence); },
  };
}
