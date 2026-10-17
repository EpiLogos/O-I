// The live state behind the time control: "all time" or a moving window.
import { DEFAULT_RAMP, DEFAULT_TRAIL, type TimeWindow } from '../data/time';

export interface TimeSnapshot {
  mode: 'all' | 'cursor';
  cursorU: number;
  trail: number;
  cumulative: boolean;
}

const CUMULATIVE_TRAIL = 3;
export const PLAY_SECONDS = 42;

/** The shared time window as the clock sees it (T-ATLAS-TIME). A move the clock makes is committed through the link before
 * the clock moves: null means the move may stand (written, already standing, or no window to bind); a string is the refusal,
 * named, and the clock does not move. `u` is a slider-position, or null for all time. */
export interface SharedClockLink {
  commit(u: number | null): string | null;
}

/** A range on the shared scale, in slider-positions. */
export interface TimeSpan {
  fromU: number;
  toU: number;
}
/** The breathing room either side of a span, as a share of the span. */
const SPAN_PAD = 0.04;
/** The narrowest range a scoped track may show, as a share of the full scale (u runs 0..1). */
const MIN_SPAN = 0.03;

/**
 * The track's range for a set of years (slider-positions): their extent, padded, and never narrower than MIN_SPAN,
 * clamped to `bounds` (the field's own extent, so no dead track past its last year; the whole scale by default).
 * Null when the years are fewer than two distinct ones (a single year scopes nothing).
 */
export function uSpan(us: ArrayLike<number>, bounds: TimeSpan = { fromU: 0, toU: 1 }): TimeSpan | null {
  const distinct = new Set<number>();
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < us.length; i++) {
    const u = us[i];
    if (!Number.isFinite(u) || u < 0) continue; // [§8.4 host] u < 0 is UNDATED_U: no date, so no span
    distinct.add(u);
    lo = Math.min(lo, u);
    hi = Math.max(hi, u);
  }
  if (distinct.size < 2) return null;
  const pad = (hi - lo) * SPAN_PAD;
  const width = Math.max(hi - lo + 2 * pad, MIN_SPAN);
  const mid = (lo + hi) / 2;
  let from = mid - width / 2;
  let to = mid + width / 2;
  if (from < bounds.fromU) { to += bounds.fromU - from; from = bounds.fromU; }
  if (to > bounds.toU) { from -= to - bounds.toU; to = bounds.toU; }
  return { fromU: Math.max(bounds.fromU, from), toU: Math.min(bounds.toU, to) };
}

/** The track's range for a subject: the span of its located occurrences (`idx`) on the shared scale, within `bounds`. */
export function subjectSpan(m: { u: ArrayLike<number> }, idx: readonly number[], bounds?: TimeSpan): TimeSpan | null {
  return uSpan(idx.map((i) => m.u[i]), bounds);
}

export class TimeModel {
  mode: 'all' | 'cursor' = 'all';
  cursorU = 1;
  /** where smoothing is heading (== cursorU when scrubbing directly) */
  targetU = 1;
  trail = DEFAULT_TRAIL;
  trailTarget = DEFAULT_TRAIL;
  cumulative = false;
  playing = false;
  /** 0..1 blend between "all" and windowed */
  on = 0;
  /** Active view's bounds in the shared historical scale. */
  fromU = 0;
  toU = 1;
  private listeners = new Set<() => void>();
  private direct = true;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  get window(): TimeWindow {
    return { on: this.on, cursorU: this.cursorU, trail: this.trail, ramp: DEFAULT_RAMP };
  }

  setRange(fromU = 0, toU = 1) {
    if (!Number.isFinite(fromU) || !Number.isFinite(toU) || toU <= fromU) throw new RangeError('Time range must have increasing finite bounds');
    const from = clamp01(fromU), to = clamp01(toU);
    if (to <= from) throw new RangeError('Time range is outside the shared scale');
    this.fromU = from;
    this.toU = to;
    this.cursorU = this.mode === 'all' ? to : this.clampU(this.cursorU);
    this.targetU = this.mode === 'all' ? to : this.clampU(this.targetU);
    this.emit();
  }

  private clampU(u: number) { return Math.max(this.fromU, Math.min(this.toU, u)); }

  /** The shared window this clock is bound to (T-ATLAS-TIME, projections/atlas/sharedClock.ts). Null: the clock is its own
   * presentation. Bound, a move the clock makes is committed through the link before the clock moves. */
  link: SharedClockLink | null = null;

  /** Commit a move to slider-position `u` (null: all time) through the bound window. Null means the move may stand. */
  private commit(u: number | null): string | null {
    return this.link ? this.link.commit(u) : null;
  }

  /** Immediate move (dragging the handle). Returns the refusal when the shared window refuses the move, else null. */
  scrub(u: number): string | null {
    const to = this.clampU(u);
    const refusal = this.commit(to);
    if (refusal) return refusal;
    this.mode = 'cursor';
    this.cursorU = this.targetU = to;
    this.direct = true;
    this.emit();
    return null;
  }

  /** Smoothed move (tour, search results). */
  glideTo(u: number, trail?: number): string | null {
    const to = this.clampU(u);
    const refusal = this.commit(to);
    if (refusal) return refusal;
    if (this.mode === 'all') {
      this.cursorU = to; // start where the new window belongs, avoiding a sweep across all history
    }
    this.mode = 'cursor';
    this.targetU = to;
    if (trail !== undefined) this.trailTarget = trail;
    this.direct = false;
    this.emit();
    return null;
  }

  setCumulative(on: boolean) {
    this.cumulative = on;
    this.trailTarget = on ? CUMULATIVE_TRAIL : DEFAULT_TRAIL;
    this.emit();
  }

  /** All time: the resting state, committed as no window. */
  setAll(): string | null {
    const refusal = this.commit(null);
    if (refusal) return refusal;
    this.rest();
    return null;
  }

  private rest() {
    this.mode = 'all';
    this.playing = false;
    this.cumulative = false;
    this.trailTarget = DEFAULT_TRAIL;
    this.emit();
  }

  /** The shared window moved outside this clock (T-ATLAS-TIME): take its place at once, without writing it back. A null u
   * is all time. An outside move takes the cursor, so play stops. */
  follow(u: number | null): void {
    if (u === null) {
      this.rest();
      return;
    }
    this.playing = false;
    this.mode = 'cursor';
    this.cursorU = this.targetU = this.clampU(u);
    this.direct = true;
    this.emit();
  }

  play(startU?: number): string | null {
    const restart = startU !== undefined || this.mode === 'all' || this.cursorU >= this.toU - (this.toU - this.fromU) * 0.005;
    const from = restart ? this.clampU(startU ?? this.fromU) : this.cursorU;
    const refusal = this.commit(from);
    if (refusal) return refusal;
    if (restart) this.cursorU = this.targetU = from;
    this.mode = 'cursor';
    this.playing = true;
    this.direct = true;
    this.emit();
    return null;
  }

  pause() {
    this.playing = false;
    this.emit();
  }

  snapshot(): TimeSnapshot {
    return { mode: this.mode, cursorU: this.cursorU, trail: this.trailTarget, cumulative: this.cumulative };
  }

  restore(s: TimeSnapshot): string | null {
    const to = s.mode === 'all' ? null : this.clampU(s.cursorU);
    const refusal = this.commit(to);
    if (refusal) return refusal;
    this.playing = false;
    if (s.mode === 'all') {
      this.rest();
    } else {
      this.cumulative = s.cumulative;
      this.mode = 'cursor';
      this.targetU = this.clampU(s.cursorU);
      this.trailTarget = s.cumulative ? CUMULATIVE_TRAIL : DEFAULT_TRAIL;
      this.direct = false;
      this.emit();
    }
    return null;
  }

  update(dt: number) {
    let changed = false;
    if (this.playing) {
      const span = this.toU - this.fromU;
      const next = this.cursorU + dt * span / PLAY_SECONDS;
      changed = true;
      if (next >= this.toU + 0.04 * span) {
        this.cursorU = this.targetU = this.toU;
        this.playing = false;
        this.setAll();
        return;
      }
      // one commit per frame at most: the shared window takes a whole year, so a frame that keeps the year writes nothing
      const refusal = this.commit(this.clampU(next));
      if (refusal) this.playing = false; // the shared window refused the step: play stops where the window stands
      else this.cursorU = this.targetU = next;
    } else if (!this.direct && this.cursorU !== this.targetU) {
      // a glide eases, then lands exactly on its target (a stop short of it reads a year off, and a restore must return the clock exactly)
      if (Math.abs(this.targetU - this.cursorU) > 1e-4) this.cursorU += (this.targetU - this.cursorU) * (1 - Math.exp(-dt * 2.4));
      else this.cursorU = this.targetU;
      changed = true;
    }
    const tt = this.trailTarget - this.trail;
    if (Math.abs(tt) > 1e-4) {
      this.trail += tt * (1 - Math.exp(-dt * 3));
      changed = true;
    }
    const onT = this.mode === 'cursor' ? 1 : 0;
    if (Math.abs(onT - this.on) > 1e-3) {
      this.on += (onT - this.on) * (1 - Math.exp(-dt * 4));
      changed = true;
    } else this.on = onT;
    if (changed) this.emit();
  }
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
