const MODE_CATALOGUE_SCHEMA = "ql.music-modes/v1";
class Refused extends Error {
}
const refuse = (why) => {
  throw new Refused(why);
};
const record = (value, where) => value && typeof value === "object" && !Array.isArray(value) ? value : refuse(`${where} is not an object`);
const text = (value, where) => typeof value === "string" && value.length > 0 ? value : refuse(`${where} is not a non-empty string`);
const integer = (value, where) => Number.isInteger(value) ? value : refuse(`${where} is not an integer`);
const list = (value, where) => Array.isArray(value) ? value : refuse(`${where} is not a list`);
const pitch = (value, where) => Number.isInteger(value) && value >= 0 && value <= 11 ? value : refuse(`${where} is not a pitch class 0..11`);
function lensRow(raw, index, bases) {
  const where = `lens_cf[${index}]`, row = record(raw, where);
  if (row.kind !== "lens-cf") refuse(`${where}.kind is not lens-cf`);
  const anchor = text(row.anchor_basis, `${where}.anchor_basis`);
  if (!bases.has(anchor)) refuse(`${where}.anchor_basis ${anchor} is not a served basis`);
  const tonic = pitch(row.tonic, `${where}.tonic`);
  const pitches = list(row.pitches, `${where}.pitches`).map((p, i) => pitch(p, `${where}.pitches[${i}]`));
  if (pitches.length !== 7) refuse(`${where}.pitches is not seven pitch classes`);
  const steps = list(row.steps_semitones, `${where}.steps_semitones`).map((s, i) => integer(s, `${where}.steps_semitones[${i}]`));
  if (steps.length !== 7 || steps.some((s) => s <= 0)) refuse(`${where}.steps_semitones is not seven positive semitone steps`);
  if (pitches[0] !== tonic) refuse(`${where}.pitches does not begin on its tonic`);
  let walked = tonic;
  for (let i = 0; i < 6; i++) {
    walked = (walked + steps[i]) % 12;
    if (pitches[i + 1] !== walked) refuse(`${where}.pitches does not follow steps_semitones`);
  }
  if (row.tuning !== null) refuse(`${where}.tuning is not null: a lens row states no tuning`);
  if (steps.reduce((a, b) => a + b, 0) !== 12) refuse(`${where}.steps_semitones does not sum to the octave of 12`);
  let at = 0;
  const ratios = steps.map((step) => {
    const ratio = 2 ** (at / 12);
    at += step;
    return ratio;
  });
  return {
    key: text(row.key, `${where}.key`),
    label: text(row.label, `${where}.label`),
    kind: "lens-cf",
    group: `${text(row.lens, `${where}.lens`)} on the ${anchor} basis`,
    ratios,
    tuning: `the row's semitone steps (${steps.join(" ")}) at twelve to the octave; the catalogue states no other tuning for a lens mode`
  };
}
function sourceRow(raw, index) {
  const where = `source_scales[${index}]`, row = record(raw, where);
  if (row.kind !== "source") refuse(`${where}.kind is not source`);
  if (row.pitches !== null) refuse(`${where}.pitches is not null: a quarter-tone source serves no pitch set`);
  if (row.tuning_unit !== "quarter-tone") refuse(`${where}.tuning_unit is not quarter-tone`);
  if (row.tuning !== null) refuse(`${where}.tuning is not null: a quarter-tone source states its tuning in quarter_tone_steps`);
  const steps = list(row.quarter_tone_steps, `${where}.quarter_tone_steps`).map((v, i) => integer(v, `${where}.quarter_tone_steps[${i}]`));
  const fromRoot = list(row.quarter_tones_from_root, `${where}.quarter_tones_from_root`).map((v, i) => integer(v, `${where}.quarter_tones_from_root[${i}]`));
  const cents = list(row.cents_from_root, `${where}.cents_from_root`).map((v, i) => integer(v, `${where}.cents_from_root[${i}]`));
  if (cents.length !== fromRoot.length) refuse(`${where}.cents_from_root does not carry one cent value per degree`);
  if (fromRoot.length !== steps.length + 1 || fromRoot[0] !== 0 || !steps.every((s, i) => s > 0 && fromRoot[i + 1] - fromRoot[i] === s) || fromRoot[fromRoot.length - 1] !== 24)
    refuse(`${where}.quarter_tones_from_root does not follow quarter_tone_steps across one octave of 24`);
  if (cents[0] !== 0 || cents[cents.length - 1] !== 1200 || !cents.every((c, i) => i === 0 || c > cents[i - 1])) refuse(`${where}.cents_from_root does not rise from 0 to the octave of 1200`);
  const ratios = cents.slice(0, -1).map((c) => 2 ** (c / 1200));
  return {
    key: text(row.key, `${where}.key`),
    label: text(row.label, `${where}.label`),
    kind: "source",
    group: text(row.family, `${where}.family`),
    ratios,
    tuning: `the catalogue's cents from the root (${cents.join(" ")}), exact`
  };
}
function parseModeCatalogue(raw) {
  try {
    if (!raw || typeof raw !== "object" || raw.schema !== MODE_CATALOGUE_SCHEMA) refuse(`the reading is not a ${MODE_CATALOGUE_SCHEMA} reading`);
    const root = raw;
    const meta = record(root.provenance, "provenance");
    const bases = new Set(list(root.bases, "bases").map((row, i) => text(record(row, `bases[${i}]`).basis, `bases[${i}].basis`)));
    const modes = /* @__PURE__ */ new Map();
    for (const mode of [...list(root.lens_cf, "lens_cf").map((row, i) => lensRow(row, i, bases)), ...list(root.source_scales, "source_scales").map(sourceRow)]) {
      if (modes.has(mode.key)) refuse(`duplicate key ${mode.key}`);
      modes.set(mode.key, mode);
    }
    const absent = /* @__PURE__ */ new Map();
    list(root.sources_absent, "sources_absent").forEach((entry, i) => {
      const row = record(entry, `sources_absent[${i}]`);
      const name = text(row.scale, `sources_absent[${i}].scale`);
      absent.set(name, { name, status: text(row.status, `sources_absent[${i}].status`), reason: text(row.reason, `sources_absent[${i}].reason`) });
    });
    return { ok: true, catalogue: { revision: text(meta.m2_registry_revision, "provenance.m2_registry_revision"), modes, absent } };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, refusal: `ql music modes refused: ${error.message}` };
    throw error;
  }
}
export {
  MODE_CATALOGUE_SCHEMA,
  parseModeCatalogue
};
