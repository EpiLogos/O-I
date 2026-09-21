/**
 * The pure text transformation behind the Context plane's correction
 * composer: one scoped correction becomes one bullet of the reading's
 * "Current interpretation" section. Deliberately dependency-free so the
 * node regression can exercise exactly what the desktop runs.
 */

const SECTION = "## Current interpretation";

export function applyCorrection(body, correction) {
  const trimmed = String(correction ?? "").trim();
  if (!trimmed) return body;
  const line = `- ${trimmed}`;
  const at = body.indexOf(SECTION);
  if (at < 0) return `${body.replace(/\s*$/, "\n")}\n\n${SECTION}\n\n${line}\n`;
  const after = body.indexOf("\n", at + SECTION.length);
  const rest = body.slice(after + 1);
  const heading = rest.search(/^## /m);
  const insertAt = heading < 0 ? body.length : after + 1 + heading;
  return `${body.slice(0, insertAt).replace(/\s*$/, "\n")}${line}\n${body.slice(insertAt)}`;
}
