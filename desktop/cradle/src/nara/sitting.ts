/** A sitting (manual §24.3; T-WORLDS §6, W4): a still time with a bell to begin and end it, and a record that you sat. Pure.
 *
 * The time is the transport's: a sitting starts when Play is pressed and ends when its length has passed or Stop is pressed, and the
 * record keeps the time actually sat, to the second — never the length set. The bell is the field's own sound: the torus rings a note
 * of the scale at the start, at each interval and at the end (qlSitting.ts sends it as the one instrument's own strike). Nothing here
 * scores a sitting or derives how you are: the record holds what you set and how long you sat, and nothing else.
 *
 * The record is a page in the practice world (practiceWorld.ts makePracticePage): a Flow marked `meta.practice: "sitting"` whose
 * `meta.sitting` is this record, made when the sitting ends; the line you write after it is that Flow's first entry. */

export type SittingFocus = "breath" | "centre" | "inquiry" | "open";
export type SittingAfter = "write" | "nothing";
export const SITTING_FOCI: readonly SittingFocus[] = ["breath", "centre", "inquiry", "open"];
export const SITTING_INTERVALS: readonly number[] = [0, 5, 10, 15, 30];
/** The bell's notes (the design's names, quaternal-logic__sitting.tsx NOTES), by pitch class. */
export const BELL_NOTES: readonly string[] = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

/** What you set before you sit (manual §24.3 "Parameter"). */
export interface SittingSettings {
  /** Minutes, 1 to 120. */
  readonly length: number;
  /** A note of the scale, or off. */
  readonly bell: string;
  /** Minutes between the bells during the sitting; 0 is off. */
  readonly intervals: number;
  readonly focus: SittingFocus;
  readonly centre?: string | null;
  readonly inquiry?: string | null;
  readonly after: SittingAfter;
}

export const DEFAULT_SITTING: SittingSettings = {length: 20, bell: "C", intervals: 0, focus: "breath", centre: null, inquiry: "", after: "write"};

/** The settings checked by their rules; a value out of its rule is refused in words. Pure. */
export function checkSitting(settings: SittingSettings): SittingSettings {
  if (!Number.isInteger(settings.length) || settings.length < 1 || settings.length > 120) throw new Error("A sitting lasts from 1 to 120 minutes.");
  if (settings.bell !== "off" && !BELL_NOTES.includes(settings.bell)) throw new Error("The bell is a note of the scale, or off.");
  if (!SITTING_INTERVALS.includes(settings.intervals)) throw new Error("The intervals are off, or every 5, 10, 15 or 30 minutes.");
  if (!SITTING_FOCI.includes(settings.focus)) throw new Error("The focus is the breath, a centre, an inquiry, or open.");
  if (settings.after !== "write" && settings.after !== "nothing") throw new Error("After the sitting, a line opens, or nothing.");
  return settings;
}

/** The pitch class the bell rings, or null when the bell is off. Pure. */
export function bellPitchClass(bell: string): number | null {
  if (bell === "off") return null;
  const pitch = BELL_NOTES.indexOf(bell);
  if (pitch < 0) throw new Error("The bell is a note of the scale, or off.");
  return pitch;
}

/** When the bell rings, in seconds from the start: the start, each interval before the end, and the end. Pure. */
export function bellMarks(settings: Pick<SittingSettings, "length" | "intervals">): number[] {
  const end = settings.length * 60;
  const marks = [0];
  if (settings.intervals > 0) for (let at = settings.intervals * 60; at < end; at += settings.intervals * 60) marks.push(at);
  marks.push(end);
  return marks;
}

/** One time you sat (`oi.sitting/v1`): what you set, when you began and ended, and the time you actually sat. */
export interface SittingRecord {
  readonly schema: "oi.sitting/v1";
  readonly started_at: string;
  readonly ended_at: string;
  /** The minutes set. */
  readonly length_minutes: number;
  /** The seconds actually sat. */
  readonly sat_seconds: number;
  /** The bell ended it, or you did. */
  readonly ended_by: "bell" | "stop";
  readonly focus: SittingFocus;
  readonly centre: string | null;
  readonly inquiry: string | null;
  readonly bell: string;
  readonly intervals: number;
}

/** The record of a sitting that began at `startedMs` and ended at `endedMs`: the time sat is the time that passed, never more than the
 * length set (the bell ends it there). Pure. */
export function sittingRecord(settings: SittingSettings, startedMs: number, endedMs: number, endedBy: "bell" | "stop"): SittingRecord {
  checkSitting(settings);
  if (!Number.isFinite(startedMs) || !Number.isFinite(endedMs) || endedMs < startedMs) throw new Error("A sitting ends after it begins.");
  const sat = Math.min(settings.length * 60, Math.round((endedMs - startedMs) / 1000));
  return {
    schema: "oi.sitting/v1", started_at: new Date(startedMs).toISOString(), ended_at: new Date(startedMs + sat * 1000).toISOString(),
    length_minutes: settings.length, sat_seconds: sat, ended_by: endedBy, focus: settings.focus,
    centre: settings.focus === "centre" ? settings.centre ?? null : null,
    inquiry: settings.focus === "inquiry" ? (settings.inquiry ?? "").trim() || null : null,
    bell: settings.bell, intervals: settings.intervals,
  };
}

const FOCUS_WORD: Readonly<Record<SittingFocus, string>> = {breath: "the breath", centre: "a centre", inquiry: "an inquiry", open: "open"};
const minutesOf = (seconds: number) => {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
};

/** The record page's title: the date, the time actually sat and the focus. Pure. */
export function sittingTitle(record: SittingRecord): string {
  return `Sitting · ${record.started_at.slice(0, 10)} · ${minutesOf(record.sat_seconds)} · ${record.centre ?? FOCUS_WORD[record.focus]}`;
}

/** A record as a page's meta carries it, or null when the meta holds none. Pure. */
export function sittingOfMeta(meta: unknown): SittingRecord | null {
  const value = meta && typeof meta === "object" ? (meta as {sitting?: unknown}).sitting : null;
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<SittingRecord>;
  if (record.schema !== "oi.sitting/v1" || typeof record.started_at !== "string" || typeof record.sat_seconds !== "number") return null;
  return record as SittingRecord;
}

/** Today's sittings for the widget (the design's `today`: [{at 'HH:MM', minutes}]), from the records the practice world keeps, in the
 * order they began. `day` is the civil date (YYYY-MM-DD) in local time, as the clock reads it. Pure. */
export function todaysSittings(records: readonly SittingRecord[], day: string): {at: string; minutes: number}[] {
  const local = (iso: string) => {
    const d = new Date(iso), pad = (n: number) => String(n).padStart(2, "0");
    return {day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, at: `${pad(d.getHours())}:${pad(d.getMinutes())}`};
  };
  return records.map(record => ({record, when: local(record.started_at)})).filter(item => item.when.day === day)
    .sort((a, b) => a.record.started_at.localeCompare(b.record.started_at))
    .map(item => ({at: item.when.at, minutes: Math.round(item.record.sat_seconds / 6) / 10}));
}
