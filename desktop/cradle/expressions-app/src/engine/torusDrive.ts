/**
 * The torus-driven plate (DLW manual §20.14 Resonance, Frequency driver = Torus; §20.2 Field, Key source).
 *
 * Under Torus the plate is driven by what the torus plays: the pitches of the voices sounding now, as the native owner names them.
 * This module decides nothing about pitch. It receives the owner's pitches from the frame (native-field/torusPlay.mjs reads them off
 * the instrument reading), chooses which of them the Key source asks for, and keeps the last drive so that a torus that falls silent
 * leaves the plate where it was:
 *
 *   Key source Torus  the voices the torus plays now
 *   Key source Sky    the sky's voices (the dated sky the instrument was opened at); absent, with its reason, when none is open
 *   Key source Manual the resonance that was set (cymatics.frequencyHz), to study the modes
 *
 * While the source gives nothing the plate holds its last drive and the drive says the torus is silent. A plate that has never had a
 * drive is not driven at all: no tone is made up, and the engine stops the medium so the formation springs keep the figure.
 *
 * The Key source selects among pitch sources only while the Frequency driver is Torus. Manual, Focus and Automation keep their own
 * drive as before; the key never reaches them.
 *
 * Under Torus the plate also takes what M2′ reads from the torus (§20.14; the M2′ seed §3 8+4 contract; O-I 851): the eight voices give
 * the figure its motion (a and b, the two families' weights; the amplitude and the temporal phase of the one native body) and the four
 * boundaries its stillness (m and n, the edge, the families admitted). `roles` carries them beside every drive, read from the owner's
 * influence and the native amplitudes the frame hands over with the pitches (torusObject.ts readRoles).
 *
 * The plate sounds as a body the pulse rings, never a second source. Under Manual, Focus and Automation the pulse is tuned to the drive
 * (`pulseRateFor`); under Torus the pulse is the torus's own.
 */
import {bodyOf, readRoles, type TorusRoles} from './torusObject';

export type KeySource = 'torus' | 'sky' | 'manual';
/** The three values, in the manual's order (§20.2). */
export const KEY_SOURCES: readonly KeySource[] = ['torus', 'sky', 'manual'];
export const isKeySource = (value: unknown): value is KeySource => typeof value === 'string' && (KEY_SOURCES as readonly string[]).includes(value);

/** What the frame hands the engine each time the owner's reading changes. Pitches are the owner's, in Hz. */
export interface TorusPlayReading {
  /** The voices the torus sounds now; `silentBecause` says why there are none. */
  torus: { tonesHz: readonly number[]; silentBecause: string | null };
  /** The sky's voices (a dated sky only); `absentBecause` says why the sky gives no key. */
  sky: { tonesHz: readonly number[]; absentBecause: string | null };
  /** The owner's 1:1, the frequency of its voice at the map's Sun. The plate does not use it; the symbols' voices stand on it. */
  root?: { hz: number | null; absentBecause: string | null };
  /** The body the torus is: the owner's influence (its voices and four boundaries) and the native amplitudes of its voices now. */
  body?: { influence: unknown; amplitudes: readonly { mode_ref: string; re: number; im: number }[] | null } | null;
  /** The Torus's pulse as the owner last read it. */
  pulse?: { steps: number; steps_per_second: number; band: string | null } | null;
}

export interface ResolvedTorusDrive {
  /** The key the drive was taken from. */
  source: KeySource;
  /** What drives the plate now, in Hz. Empty: the plate has no drive. */
  tonesHz: number[];
  /** The source gave nothing this time. */
  silent: boolean;
  /** The tones are the last drive, held. */
  held: boolean;
  /** In words, when silent. */
  reason: string | null;
  /** What M2′ reads from the torus for the plate: the eight and the four, or why they are not read. */
  roles: TorusRoles;
}

/** The roles of the body a reading carries. */
export function rolesOf(reading: TorusPlayReading | null): TorusRoles {
  const body = reading?.body;
  const amplitudes = Array.isArray(body?.amplitudes) ? new Map(body!.amplitudes!.map(a => [a.mode_ref, [a.re, a.im] as const])) : null;
  return readRoles(body ? bodyOf(body.influence) : null, amplitudes, reading
    ? 'The owner states no eight voices and four boundaries for the torus yet, so the plate reads no voices or boundaries.'
    : undefined);
}

/** The rate the pulse is tuned to under a drive that is not the torus's own (§20.14: under Manual, Focus and Automation the pulse is
 * tuned to the drive and rings the plate), in steps a second; null under Torus or without a finite positive drive. */
export function pulseRateFor(drive: { kind: string; targetHz?: number } | null | undefined): number | null {
  if (!drive || drive.kind === 'torus') return null;
  const hz = drive.targetHz;
  return typeof hz === 'number' && Number.isFinite(hz) && hz > 0 ? hz : null;
}

/** Only the owner's own finite positive pitches reach the plate. */
const pitches = (tones: readonly number[] | undefined): number[] => (tones ?? []).filter((hz) => typeof hz === 'number' && Number.isFinite(hz) && hz > 0);

const SILENCE = 'The torus is silent';

export class TorusDriveState {
  private last: number[] = [];

  resolve(args: { keySource: KeySource; reading: TorusPlayReading | null; manualHz: number }): ResolvedTorusDrive {
    const roles = rolesOf(args.reading);
    const { keySource, reading } = args;
    if (keySource === 'manual') {
      // The resonance that was set. It is not the torus's drive, so it never becomes the drive a silent torus holds.
      return { source: 'manual', tonesHz: [args.manualHz], silent: false, held: false, reason: null, roles };
    }
    const given = keySource === 'sky' ? reading?.sky : reading?.torus;
    const tones = pitches(given?.tonesHz);
    if (tones.length > 0) {
      this.last = tones;
      return { source: keySource, tonesHz: [...tones], silent: false, held: false, reason: null, roles };
    }
    const because = !reading
      ? 'No instrument is open'
      : keySource === 'sky' ? ((reading.sky.absentBecause ?? 'The sky gives no voices')) : (reading.torus.silentBecause ?? 'The torus gives no voices');
    const holds = this.last.length > 0;
    const reason = keySource === 'sky'
      ? `${because}. ${holds ? 'The plate holds its last drive.' : 'The plate has no drive yet.'}`
      : `${SILENCE}: ${because}. ${holds ? 'The plate holds its last drive.' : 'The plate has no drive yet.'}`;
    return { source: keySource, tonesHz: [...this.last], silent: true, held: holds, reason, roles };
  }
}
