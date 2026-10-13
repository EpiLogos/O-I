/** The one https gate for opening an external link in the default browser (lane-1 A10, T-NATIVE-ROUTES).
 * A link opens only when it is a well-formed https URL of at most 2048 characters with no credentials in its authority
 * (`https://user:pw@host`, or the deceptive `https://real.example@evil.example`). Every host that answers an
 * `open-external` request — the cradle's PointCloudHost and the live shell's Expressions pane — reads it here; the
 * Tauri opener's own scope (https://*) refuses everything else a second time. */
export function externalHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let target: URL;
  try { target = new URL(raw); } catch { return null; }
  if (target.protocol !== "https:" || target.username !== "" || target.password !== "") return null;
  return target.href;
}
