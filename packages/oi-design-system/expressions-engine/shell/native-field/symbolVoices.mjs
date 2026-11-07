import { soundingGain } from "./entitySound.mjs";
const AUDIBLE_HZ = Object.freeze({ low: 20, high: 2e4 });
const ROOT_PLANET_REF = "#2-5-0/1";
function bandPlan(ratios, rootHz, sampleRate) {
  if (!(rootHz > 0) || !Number.isFinite(rootHz) || !ratios.length) return [];
  const high = Math.min(AUDIBLE_HZ.high, sampleRate / 2), low = AUDIBLE_HZ.low;
  const raw = [];
  const first = Math.floor(Math.log2(low / rootHz)) - 1, last = Math.ceil(Math.log2(high / rootHz)) + 1;
  for (let octave = first; octave <= last; octave++) ratios.forEach((ratio, degree) => {
    const hz = rootHz * 2 ** octave * ratio;
    if (hz >= low && hz < high) raw.push({ hz, degree, octave });
  });
  raw.sort((a, b) => a.hz - b.hz);
  const centres = raw.filter((entry, i) => i === 0 || entry.hz - raw[i - 1].hz > entry.hz * 1e-9);
  return centres.map((entry, i) => {
    const below = i > 0 ? entry.hz - centres[i - 1].hz : Infinity, above = i < centres.length - 1 ? centres[i + 1].hz - entry.hz : Infinity;
    const nearest = Math.min(below, above), distance = Number.isFinite(nearest) ? nearest : entry.hz;
    const widthHz = distance / 2;
    return { centreHz: entry.hz, widthHz, q: entry.hz / widthHz, degree: entry.degree, octave: entry.octave };
  });
}
function resolveCarry(carry, catalogue, catalogueWhy, root, sampleRate) {
  if (!catalogue) return { state: "absent", because: catalogueWhy ?? "The mode catalogue has not been read yet" };
  if (carry.kind === "name") {
    const entry = catalogue.absent.get(carry.ref);
    return { state: "absent", because: entry ? `${entry.name} (${entry.status}): ${entry.reason}` : `The store names no "${carry.ref}", so this voice has no sound to carry` };
  }
  const mode = catalogue.modes.get(carry.ref);
  if (!mode) return { state: "absent", because: `The mode catalogue has no mode "${carry.ref}"` };
  if (root.hz === null || !(root.hz > 0)) return { state: "absent", because: root.absentBecause ?? "The torus's root is not given" };
  const bands = bandPlan(mode.ratios, root.hz, sampleRate);
  if (!bands.length) return { state: "absent", because: `No degree of ${mode.label} falls in the audible range over a root of ${root.hz} Hz` };
  return { state: "carrying", mode, bands, rootHz: root.hz, tuning: mode.tuning };
}
function placeOf(screenX, stageWidth) {
  if (!(stageWidth > 0) || !Number.isFinite(screenX)) return 0;
  return Math.max(-1, Math.min(1, (screenX - stageWidth / 2) / (stageWidth / 2)));
}
const later = (run, ms) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};
const SMOOTH = 0.02;
class SymbolVoices {
  constructor(defer = later) {
    this.defer = defer;
  }
  tap = null;
  banks = /* @__PURE__ */ new Map();
  voices = /* @__PURE__ */ new Map();
  readings = [];
  retiring = /* @__PURE__ */ new Set();
  /** Listen to this tap (or to none). True when that is a change: the same node in the same context is no change. */
  attach(tap) {
    if ((tap?.input ?? null) === (this.tap?.input ?? null) && (tap?.context ?? null) === (this.tap?.context ?? null)) return false;
    this.teardown();
    this.tap = tap;
    return true;
  }
  /** Follow the scene's plan. Cheap when nothing changed (the nodes are updated in place). */
  sync(input) {
    const readings = [];
    const reading = (entityId, state, because, carry, carried, place = 0, classes = null, bands = 0) => ({ entityId, state, because, carry, mode: carried?.mode.key ?? null, harmony: classes, tuning: carried?.tuning ?? null, rootHz: carried?.rootHz ?? null, bands: carried?.bands.length ?? bands, place });
    for (const silent of input.plan.silent) readings.push(reading(silent.entityId, "silent", silent.because, null));
    const wanted = /* @__PURE__ */ new Map();
    const tap = this.tap, rate = tap?.context.sampleRate;
    for (const voice of input.plan.voices) {
      const place = input.places.get(voice.entityId) ?? 0;
      if (!tap || rate === void 0) {
        readings.push(reading(voice.entityId, "silent", input.torusSilentBecause ?? "No instrument is open: the torus is not sounding", voice.carry, void 0, place));
        continue;
      }
      const silentTorus = input.torusSilentBecause ? `The torus is silent: ${input.torusSilentBecause}` : null;
      if (!voice.carry) {
        const harmony = input.harmonies?.get(voice.entityId) ?? { state: "absent", because: "The symbol's harmony is not read yet" };
        if (harmony.state === "absent") {
          readings.push(reading(voice.entityId, "absent", harmony.because, null, void 0, place));
          continue;
        }
        const bands = harmony.harmony.bands;
        wanted.set(voice.entityId, { voice, tuned: { key: `harmony:${voice.entityId}`, rootHz: null, bands, weighted: true } });
        readings.push(reading(voice.entityId, "carrying", silentTorus, null, void 0, place, [...harmony.harmony.classes], bands.length));
        continue;
      }
      const carried = resolveCarry(voice.carry, input.catalogue, input.catalogueWhy, input.root, rate);
      if (carried.state === "absent") {
        readings.push(reading(voice.entityId, "absent", carried.because, voice.carry, void 0, place));
        continue;
      }
      wanted.set(voice.entityId, { voice, tuned: { key: carried.mode.key, rootHz: carried.rootHz, bands: carried.bands, weighted: false } });
      readings.push(reading(voice.entityId, "carrying", silentTorus, voice.carry, carried, place));
    }
    if (tap) {
      const context = tap.context, now = context.currentTime;
      for (const [id, held] of [...this.voices]) if (!wanted.has(id)) this.release(id, held, now);
      for (const [id, { voice, tuned }] of wanted) {
        const bankKey = tuned.key;
        const bank = this.bank(tap, tuned);
        let held = this.voices.get(id);
        if (held && held.bank !== bankKey) {
          this.release(id, held, now, true);
          held = void 0;
        }
        if (!held) {
          const env = context.createGain();
          env.gain.setValueAtTime(0, now);
          const panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
          bank.sum.connect(env);
          if (panner) {
            env.connect(panner);
            panner.connect(context.destination);
          } else env.connect(context.destination);
          bank.users.add(id);
          held = { voice, bank: bankKey, env, panner, signature: "" };
          this.voices.set(id, held);
        }
        held.voice = voice;
        held.panner?.pan.setTargetAtTime(input.places.get(id) ?? 0, now, SMOOTH);
        const own = input.mixOf?.(id);
        const gain = own ? soundingGain(voice.gain, own.muted, own.levels) : soundingGain(voice.gain, input.muted, input.levels ?? { level: 1, main: 1 });
        const signature = JSON.stringify([gain, voice.attack]);
        if (held.signature !== signature) {
          held.signature = signature;
          held.env.gain.cancelScheduledValues(now);
          held.env.gain.setValueAtTime(held.env.gain.value, now);
          held.env.gain.linearRampToValueAtTime(gain, now + Math.max(5e-3, voice.attack));
        }
      }
      this.retireBanks();
    }
    this.readings = readings;
    return readings;
  }
  inspect() {
    return {
      attached: !!this.tap,
      banks: [...this.banks].map(([key, bank]) => ({ mode: key, rootHz: bank.rootHz, bands: bank.filters.length, weighted: bank.weights.length > 0, users: [...bank.users] })),
      voices: this.readings.map((reading) => ({ ...reading }))
    };
  }
  /** The rate of the context the voices sound in, or null while no instrument is open. */
  sampleRate() {
    return this.tap?.context.sampleRate ?? null;
  }
  dispose() {
    this.teardown();
    this.tap = null;
    this.readings = [];
  }
  /** The bank for a mode: made once and shared, and moved in place when the root moves (or rebuilt when the band count changes). A harmony's
   * bank is its symbol's own, and each band passes through its own gain at the chord's weight. */
  bank(tap, tuned) {
    const context = tap.context, now = context.currentTime, key = tuned.key;
    let bank = this.banks.get(key);
    if (bank && bank.filters.length !== tuned.bands.length) {
      for (const filter of bank.filters) {
        try {
          tap.input.disconnect(filter);
        } catch {
        }
        filter.disconnect();
      }
      for (const weight of bank.weights) weight.disconnect();
      bank.filters = [];
      bank.weights = [];
    }
    if (!bank) {
      bank = { mode: key, rootHz: tuned.rootHz, filters: [], weights: [], sum: context.createGain(), users: /* @__PURE__ */ new Set(), signature: "" };
      this.banks.set(key, bank);
    }
    const signature = tuned.bands.map((band) => `${band.centreHz}:${band.q}:${band.gain ?? 1}`).join(" ");
    if (!bank.filters.length) {
      bank.filters = tuned.bands.map((band) => {
        const filter = context.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = band.centreHz;
        filter.Q.value = band.q;
        tap.input.connect(filter);
        if (tuned.weighted) {
          const weight = context.createGain();
          weight.gain.value = band.gain ?? 1;
          filter.connect(weight);
          weight.connect(bank.sum);
          bank.weights.push(weight);
        } else filter.connect(bank.sum);
        return filter;
      });
    } else if (bank.signature !== signature) tuned.bands.forEach((band, i) => {
      const filter = bank.filters[i];
      filter.frequency.setTargetAtTime(band.centreHz, now, SMOOTH);
      filter.Q.setTargetAtTime(band.q, now, SMOOTH);
      bank.weights[i]?.gain.setTargetAtTime(band.gain ?? 1, now, SMOOTH);
    });
    bank.rootHz = tuned.rootHz;
    bank.signature = signature;
    return bank;
  }
  release(id, held, now, immediate = false) {
    this.voices.delete(id);
    const seconds = immediate ? 0 : held.voice.release;
    held.env.gain.cancelScheduledValues(now);
    held.env.gain.setValueAtTime(held.env.gain.value, now);
    if (seconds > 0) held.env.gain.linearRampToValueAtTime(0, now + seconds);
    else held.env.gain.setValueAtTime(0, now);
    const bank = this.banks.get(held.bank);
    const apart = () => {
      this.retiring.delete(cancel);
      held.env.disconnect();
      held.panner?.disconnect();
      bank?.users.delete(id);
      this.retireBanks();
    };
    const cancel = this.defer(apart, Math.ceil(seconds * 1e3) + 50);
    this.retiring.add(cancel);
  }
  /** A bank no voice uses (and none is still releasing on) goes. */
  retireBanks() {
    const tap = this.tap;
    for (const [key, bank] of [...this.banks]) {
      if (bank.users.size > 0 || [...this.voices.values()].some((held) => held.bank === key)) continue;
      for (const filter of bank.filters) {
        try {
          tap?.input.disconnect(filter);
        } catch {
        }
        filter.disconnect();
      }
      for (const weight of bank.weights) weight.disconnect();
      bank.sum.disconnect();
      this.banks.delete(key);
    }
  }
  teardown() {
    for (const cancel of [...this.retiring]) cancel();
    this.retiring.clear();
    for (const held of this.voices.values()) {
      held.env.disconnect();
      held.panner?.disconnect();
    }
    this.voices.clear();
    for (const bank of this.banks.values()) {
      for (const filter of bank.filters) {
        try {
          this.tap?.input.disconnect(filter);
        } catch {
        }
        filter.disconnect();
      }
      for (const weight of bank.weights) weight.disconnect();
      bank.sum.disconnect();
    }
    this.banks.clear();
  }
}
export {
  AUDIBLE_HZ,
  ROOT_PLANET_REF,
  SymbolVoices,
  bandPlan,
  placeOf,
  resolveCarry
};
