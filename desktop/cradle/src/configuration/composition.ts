/**
 * The settings × composition interface (CONTEXT-FRAME-COMPOSITION-LOCK.md
 * §5, §7): where each mounted owner stands against the effective
 * composition, and what the views may therefore render.
 *
 * The standing is a READING of the world's own facts — the current-world
 * v2 disclosure the kernel census already carries — never a second
 * composition decision and never inferred from a contribution or a product
 * count. Requested and effective stay distinct (`install_mode_basis`
 * names which one is speaking); reality-exceeds-request and
 * request-names-degraded-world travel through the reading's own warnings.
 *
 * The law these helpers make concrete:
 *  - a setting whose owner stands outside the effective composition is
 *    never rendered as an actionable control (recognition precedes
 *    mutation; adopting the product is an explicit owner operation that
 *    names the mode consequence);
 *  - an absent owner is visible only as disclosure — absence never hides
 *    the material relation, and nothing is invented behind it;
 *  - a failed world reading leaves every standing `unknown` — honest
 *    absence, never a guess.
 */

/** Where one owner stands against the effective composition. */
export type Standing = "in_composition" | "absent" | "unpositioned" | "unknown";

/** The composition fact of one mount, beside its availability (a different
 * axis: availability is the owner's own probe; standing is the world's). */
export interface MountComposition {
  standing: Standing;
  position?: number | null;
}

/** The registry-level composition disclosure: the current-world v2 facts
 * verbatim. Behind `error`, no standings are invented. */
export interface RegistryComposition {
  requested_mode?: string | null;
  install_mode?: string | null;
  install_mode_basis?: string | null;
  present_positions: number[];
  warnings: string[];
  error?: string | null;
}

/** True when the mount's settings may render as actionable controls: the
 * owner answered, and it stands inside the effective composition. Anything
 * else — absent, unknown standing, failed reading — renders as disclosure
 * only. */
export function settingsActionable(mount: {composition?: MountComposition | null; availability: {state: string}}): boolean {
  const standing = mount.composition?.standing ?? "unknown";
  return standing !== "absent" && standing !== "unknown" && mount.availability.state === "available";
}

/** The plain line naming the world a settings view stands in: the mode the
 * reading recognises, which basis spoke, and any requested mode beside it.
 * `null` when there is nothing to disclose (an absent block with no
 * error is a pre-v2 world rendered honestly elsewhere). */
export function compositionLine(composition: RegistryComposition | null | undefined): string | null {
  if (!composition) return null;
  if (composition.error) return `Composition unavailable: ${composition.error}`;
  const positions = composition.present_positions.join(",");
  const basis = composition.install_mode_basis ? ` (${composition.install_mode_basis})` : "";
  const mode = composition.install_mode ?? "explicit selection";
  const requested = composition.requested_mode
    ? ` — requested ${composition.requested_mode}`
    : "";
  return `Effective composition: mode ${mode}${basis}${requested} — present positions [${positions}]`;
}
