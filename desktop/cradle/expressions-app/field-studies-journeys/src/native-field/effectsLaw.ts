/** The torus's four effects (manual §21.5: Filter, Dynamics, Delay, Reverb), the owner's law of their chain and parameters. The
 * controller's presentation stage keeps their state and sounds them after the level, between the native receiver and the device
 * (presentationEffects.ts); the stage channel takes their edits (stageCommands.ts InstrumentEdit `effect`, `effect-chain`), and the
 * hosted reading carries their state to the shell (instrumentAnnouncement.mjs `parameters.effects`). The chain names which effects
 * stand after the torus and in what order ("Put any of them on the chain, in any order. The sound passes through them from left to
 * right"); it opens empty, so the torus sounds as the receiver gives it until you put an effect on it. Each effect keeps its
 * parameters on or off the chain, and stands on at first, as the manual's defaults say. Nothing here touches the native PCM, its
 * clock or its clip law.
 * Pure: no DOM, no audio. */

export const PRESENTATION_EFFECTS = ['filter', 'dynamics', 'delay', 'reverb'] as const;
export type PresentationEffect = (typeof PRESENTATION_EFFECTS)[number];
export type EffectValue = number | boolean | string;

type NumberLaw = {readonly kind: 'number'; readonly min: number; readonly max: number; readonly initial: number; readonly unit: string; readonly why?: string};
type ChoiceLaw = {readonly kind: 'choice'; readonly choices: readonly string[]; readonly initial: string};
type SwitchLaw = {readonly kind: 'switch'; readonly initial: boolean};
export type EffectParameterLaw = NumberLaw | ChoiceLaw | SwitchLaw;

const on: SwitchLaw = {kind: 'switch', initial: true};
const number = (min: number, max: number, initial: number, unit: string, why?: string): NumberLaw => ({kind: 'number', min, max, initial, unit, ...(why ? {why} : {})});
const choice = (choices: readonly string[], initial: string): ChoiceLaw => ({kind: 'choice', choices, initial});
const percent = (initial: number, max = 100): NumberLaw => number(0, max, initial, '%');

/** The delay's note lengths in beats (a bar is four). */
export const DELAY_DIVISIONS: Readonly<Record<string, number>> = Object.freeze({'1/32': 0.125, '1/16': 0.25, '1/8': 0.5, '1/4': 1, '1/2': 2, '1': 4});
/** The filter's types, as the browser's biquad names them. */
export const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass', 'notch'] as const;

/** Every parameter of every effect: its kind, its bounds or choices, and the value the effect opens with. */
export const EFFECT_LAW: Readonly<Record<PresentationEffect, Readonly<Record<string, EffectParameterLaw>>>> = Object.freeze({
  filter: Object.freeze({
    on,
    type: choice(FILTER_TYPES, 'lowpass'),
    cutoff: number(20, 20000, 8000, 'Hz'),
    resonance: percent(20),
    drive: number(0, 24, 0, 'dB'),
    mix: percent(100),
  }),
  dynamics: Object.freeze({
    on,
    threshold: number(-60, 0, -12, 'dB'),
    ratio: number(1, 20, 4, ':1'),
    attack: number(0.01, 200, 1, 'ms'),
    release: number(5, 1000, 100, 'ms', 'the compressor the torus sounds through releases within a second (the browser\'s DynamicsCompressorNode)'),
    makeup: number(0, 24, 2, 'dB'),
  }),
  delay: Object.freeze({
    on,
    sync: {kind: 'switch', initial: true} as SwitchLaw,
    division: choice(Object.keys(DELAY_DIVISIONS), '1/8'),
    time: number(6, 4000, 250, 'ms', 'a browser\'s feedback loop takes at least two render quanta (256 frames, 5.3 ms at 48 kHz), so shorter repeats would not keep their time'),
    feedback: percent(35, 95),
    tone: number(200, 12000, 6000, 'Hz'),
    mix: percent(25),
    tempo: number(40, 300, 120, 'BPM'),
  }),
  reverb: Object.freeze({
    on,
    size: percent(50),
    decay: number(0.2, 20, 2.4, 's'),
    damping: percent(40),
    predelay: number(0, 250, 20, 'ms'),
    mix: percent(22),
  }),
});

export const EFFECT_TITLES: Readonly<Record<PresentationEffect, string>> = Object.freeze({filter: 'Filter', dynamics: 'Dynamics', delay: 'Delay', reverb: 'Reverb'});

export type EffectsParameters = Readonly<Record<PresentationEffect, Readonly<Record<string, EffectValue>>>>;
/** The chain, and every effect's parameters (on the chain or not). */
export type EffectsState = EffectsParameters & {readonly chain: readonly PresentationEffect[]};

export const isPresentationEffect = (value: unknown): value is PresentationEffect =>
  typeof value === 'string' && (PRESENTATION_EFFECTS as readonly string[]).includes(value);

/** The four effects as they open: none on the chain, each parameter at its initial value. */
export function initialEffects(): EffectsState {
  return Object.freeze({chain: Object.freeze([]) as readonly PresentationEffect[], ...Object.fromEntries(PRESENTATION_EFFECTS.map(effect =>
    [effect, Object.freeze(Object.fromEntries(Object.entries(EFFECT_LAW[effect]).map(([key, law]) => [key, law.initial])))]))}) as EffectsState;
}

/** Why the owner refuses this chain, in words, or null when it takes it: a list of the four, each at most once. */
export function effectChainRefusal(chain: unknown): string | null {
  if (!Array.isArray(chain)) return 'The chain is a list of effects.';
  const unknown = chain.find(effect => !isPresentationEffect(effect));
  if (unknown !== undefined) return `${String(unknown)}: the torus has no such effect; it has ${PRESENTATION_EFFECTS.join(', ')}.`;
  if (new Set(chain).size !== chain.length) return 'Each effect stands on the chain at most once.';
  return null;
}

/** The state with this chain. Throws the refusal in words; the state it was given is unchanged. */
export function editEffectChain(state: EffectsState, chain: readonly PresentationEffect[]): EffectsState {
  const refusal = effectChainRefusal(chain);
  if (refusal) throw new Error(refusal);
  return Object.freeze({...state, chain: Object.freeze([...chain])}) as EffectsState;
}

const valueOfKind = (law: EffectParameterLaw, value: unknown): boolean =>
  law.kind === 'number' ? typeof value === 'number' && Number.isFinite(value) : law.kind === 'switch' ? typeof value === 'boolean' : typeof value === 'string';

/** Why the owner refuses this edit, in words, or null when it takes it. */
export function effectRefusal(effect: unknown, key: unknown, value: unknown): string | null {
  if (!isPresentationEffect(effect)) return `${String(effect)}: the torus has no such effect; it has ${PRESENTATION_EFFECTS.join(', ')}.`;
  const title = EFFECT_TITLES[effect];
  const law = typeof key === 'string' ? EFFECT_LAW[effect][key] : undefined;
  if (!law) return `${title} has no parameter ${String(key)}; it has ${Object.keys(EFFECT_LAW[effect]).join(', ')}.`;
  if (!valueOfKind(law, value)) return `${title} ${key as string} takes ${law.kind === 'number' ? 'a number' : law.kind === 'switch' ? 'on or off' : 'one of its choices'}.`;
  if (law.kind === 'number' && ((value as number) < law.min || (value as number) > law.max))
    return `${title} ${key as string} goes from ${law.min} to ${law.max} ${law.unit}${law.why ? `: ${law.why}` : ''}.`;
  if (law.kind === 'choice' && !law.choices.includes(value as string)) return `${title} ${key as string} is one of ${law.choices.join(', ')}.`;
  return null;
}

/** The state after one edit. Throws the refusal in words; the state it was given is unchanged. */
export function editEffects(state: EffectsState, effect: PresentationEffect, key: string, value: EffectValue): EffectsState {
  const refusal = effectRefusal(effect, key, value);
  if (refusal) throw new Error(refusal);
  return Object.freeze({...state, [effect]: Object.freeze({...state[effect], [key]: value})}) as EffectsState;
}

/** The edit's operands as the wire carries them, closed and typed (the range is the owner's to refuse, in words), or null. */
export function readEffectOperands(raw: {effect?: unknown; key?: unknown; value?: unknown}): {effect: PresentationEffect; key: string; value: EffectValue} | null {
  if (!isPresentationEffect(raw.effect) || typeof raw.key !== 'string') return null;
  const law = EFFECT_LAW[raw.effect][raw.key];
  if (!law || !valueOfKind(law, raw.value)) return null;
  return {effect: raw.effect, key: raw.key, value: raw.value as EffectValue};
}

/** The effects' state as a reading carries it: the chain, and every effect and every parameter, each within the owner's law, or the
 * fault in words. */
export function readEffectsState(raw: unknown): EffectsState | string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'expected the chain and the four effects';
  const chain = (raw as Record<string, unknown>).chain, chainRefusal = effectChainRefusal(chain);
  if (chainRefusal) return `chain: ${chainRefusal}`;
  const out: Record<string, unknown> = {chain: [...(chain as PresentationEffect[])]};
  for (const effect of PRESENTATION_EFFECTS) {
    const given = (raw as Record<string, unknown>)[effect];
    if (!given || typeof given !== 'object' || Array.isArray(given)) return `${effect}: expected its parameters`;
    const params: Record<string, EffectValue> = {};
    for (const key of Object.keys(EFFECT_LAW[effect])) {
      const value = (given as Record<string, unknown>)[key];
      const refusal = effectRefusal(effect, key, value);
      if (refusal) return `${effect}.${key}: ${refusal}`;
      params[key] = value as EffectValue;
    }
    out[effect] = params;
  }
  return out as unknown as EffectsState;
}

/** The delay's time between repeats in seconds: the note length at the effect's tempo when synced, its own time when not. */
export function delaySeconds(delay: Readonly<Record<string, EffectValue>>): number {
  if (delay.sync === true) return 60 / (delay.tempo as number) * (DELAY_DIVISIONS[delay.division as string] ?? 0.5);
  return (delay.time as number) / 1000;
}

/** The filter's Q from Resonance, as the design draws it (catalogue/panels/live__filter.tsx qOf): the low- or high-pass peak at the
 * cutoff runs from −3 dB at 0 % to +21 dB at 100 %. The browser's biquad reads a low- or high-pass Q as that peak in dB, and a
 * band-pass or notch Q as the plain quality factor. */
export function filterQ(type: string, resonance: number): number {
  const q = Math.SQRT1_2 * 10 ** (1.2 * resonance / 100);
  return type === 'lowpass' || type === 'highpass' ? 20 * Math.log10(q) : q;
}
