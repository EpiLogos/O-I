// The Earth's Sun follows the shared window's instant (AtlasProjectionPanel.tsx; T-ATLAS-SUN).
//
// A window that moves offers its instant on every step. A read of the kernel starts only once the offered instant has been
// still for `delayMs`, so a scrub reads once where it stops. A reply is applied only when it answers the instant still
// wanted and no newer read has started since (request order): a late answer never draws a Sun for an instant the window has
// left. Pure apart from the timers, which are injected so the logic is testable without a clock.

import {later} from './src/ui/lifetime.ts';

export interface SunFollowTimers {
  set(run: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface SunFollowOptions<I, S> {
  /** the key of an instant: two instants with one key are one reading */
  keyOf(instant: I): string;
  /** the key of the state already drawn when following starts */
  drawnKey: string;
  /** reads the state for an instant; the reader turns its own failures into a state (the panel does) */
  read(instant: I): Promise<S>;
  /** draws the state read for an instant; called once, for the instant it answers */
  apply(state: S, instant: I): void;
  delayMs?: number;
  timers?: SunFollowTimers;
}

export interface SunFollower<I> {
  /** the window's instant, offered on every change; an instant with the wanted key is ignored */
  offer(instant: I): void;
  /** the instant the window stands at is not yet the one drawn */
  pending(): boolean;
  dispose(): void;
}

/** The stillness the Sun waits for before it is read. */
export const SUN_FOLLOW_DELAY_MS = 300;

// The default timers are the atlas lifetime's: a follower still waiting when the atlas is disposed is cancelled with it, and
// a follower made after dispose waits for nothing (ui/lifetime.ts).
const realTimers: SunFollowTimers = {
  set: (run, ms) => later(run, ms),
  clear: (handle) => (handle as () => void)(),
};

export function createSunFollower<I, S>(options: SunFollowOptions<I, S>): SunFollower<I> {
  const delayMs = options.delayMs ?? SUN_FOLLOW_DELAY_MS;
  const timers = options.timers ?? realTimers;
  let wantedKey = options.drawnKey;
  let wanted: I | null = null;
  let drawnKey = options.drawnKey;
  let timer: unknown = null;
  let requests = 0;
  let disposed = false;

  const fire = (): void => {
    timer = null;
    if (disposed || wanted === null || wantedKey === drawnKey) return;
    const key = wantedKey;
    const instant = wanted;
    const request = ++requests;
    new Promise<S>((resolve) => resolve(options.read(instant))).then((state) => {
      // superseded: a newer read has started, or the window has moved on to another instant since this one was asked
      if (disposed || request !== requests || key !== wantedKey) return;
      drawnKey = key;
      options.apply(state, instant);
    });
  };

  return {
    offer(instant: I): void {
      if (disposed) return;
      const key = options.keyOf(instant);
      if (key === wantedKey) {
        wanted = instant;
        return;
      }
      wantedKey = key;
      wanted = instant;
      if (timer !== null) timers.clear(timer);
      timer = timers.set(fire, delayMs);
    },
    pending: () => wantedKey !== drawnKey,
    dispose(): void {
      disposed = true;
      if (timer !== null) timers.clear(timer);
      timer = null;
    },
  };
}
