/** A plain "observed <relative time>" freshness label (BOOT-06/12/14). Never
 * a substitute for an owner-carried revision — just when this process last
 * pulled the reading, honestly rounded. */
export function formatRelativeTime(unixMs: number, now: number = Date.now()): string {
  const deltaSeconds = Math.max(0, Math.round((now - unixMs) / 1000));
  if (deltaSeconds < 5) return "just now";
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  const minutes = Math.round(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
