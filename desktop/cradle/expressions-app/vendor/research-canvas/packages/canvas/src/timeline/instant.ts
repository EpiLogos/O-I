export const MS_PER_DAY = 86_400_000;

/** Fractional proleptic Gregorian year, using astronomical year numbering.
 * Native signed six-digit ISO instants are preserved by the source. Only the
 * parser input for legacy short signed dates is padded to JavaScript ISO. */
export function parseTemporalInstant(iso: string | null): number | null {
  if (iso === null) return null;
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const bareYear = /^([+-]?\d{1,6})$/u.exec(trimmed);
  if (bareYear) return Number(bareYear[1]);
  const match = /^([+-]?)(\d{1,6})(-\d{2}-\d{2}.*)$/u.exec(trimmed);
  if (!match) return null;
  const year = Number(`${match[1]}${match[2]}`);
  const normalizedYear = year < 0 ? `-${String(-year).padStart(6, "0")}`
    : year > 9999 || match[1] === "+" ? `+${String(year).padStart(6, "0")}`
    : String(year).padStart(4, "0");
  const at = Date.parse(`${normalizedYear}${match[3]}`);
  if (!Number.isFinite(at)) return null;
  const actualYear = new Date(at).getUTCFullYear();
  // Date.UTC(0..99, ...) silently adds 1900. setUTCFullYear does not.
  const boundary = (value: number) => {
    const date = new Date(0);
    date.setUTCFullYear(value, 0, 1);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime();
  };
  const start = boundary(actualYear), end = boundary(actualYear + 1);
  return actualYear + (at - start) / (end - start);
}
