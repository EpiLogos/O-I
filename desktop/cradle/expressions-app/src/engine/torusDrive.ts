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
 */

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
}

/** The eight audible roles and four nodes M2′ reads from the torus are not yet a drive of the plate; this is said beside every drive. */
export const ROLES_ABSENT = 'M2′ reads eight audible roles and four nodes from the torus (the Vimarśā reading\'s audio_octet_hz and nodal_quartet), but no source says which plate mode each role or node drives, so the plate is driven by the pitches the torus plays.';

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
  roles: { standing: 'absent'; reason: string };
}

/** Only the owner's own finite positive pitches reach the plate. */
const pitches = (tones: readonly number[] | undefined): number[] => (tones ?? []).filter((hz) => typeof hz === 'number' && Number.isFinite(hz) && hz > 0);

const SILENCE = 'The torus is silent';

export class TorusDriveState {
  private last: number[] = [];

  resolve(args: { keySource: KeySource; reading: TorusPlayReading | null; manualHz: number }): ResolvedTorusDrive {
    const roles = { standing: 'absent' as const, reason: ROLES_ABSENT };
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
