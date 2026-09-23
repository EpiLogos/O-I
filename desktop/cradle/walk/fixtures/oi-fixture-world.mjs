#!/usr/bin/env node
/** The EMPTY fixture world (docs/cradle/06-SYSTEM-SETTINGS.md §6.2) — a
 * minimal read-only `oi` stand-in whose census answers all six products
 * missing. The system-settings walk points OI_BIN here so the REAL
 * kernel→CLI census seam (kernel/src/composition.rs, kernel/src/
 * system_composition.rs — both spawn OI_BIN) reads a genuine bootstrap
 * world: seven named positions, none discovered, and no native owner
 * descriptor mounts (an unknown operation fails loudly, so a seam change
 * surfaces as a walk failure, never as silent fixture drift).
 *
 * Contract implemented, exactly as the kernel validates it:
 *   `current-world --json [--owners]` → oi.current-world/v2, all six
 *     positions present, state "missing";
 *   `status --json`                    → oi.suite-status/v1, no surfaces.
 * Anything else: exit 2 with a plain refusal on stderr.
 */
const operation = process.argv[2];

if (operation === "current-world") {
  process.stdout.write(`${JSON.stringify({
    schema: "oi.current-world/v2",
    context_frame: {
      containing_frame: "walk fixture world (empty)",
      install_mode: null,
      present_positions: [],
    },
    positions: ["central", "actuation", "ai-kit", "software-factory", "workcell", "quaternal-logic"]
      .map((product_id) => ({ product_id, state: "missing" })),
  })}\n`);
} else if (operation === "status") {
  process.stdout.write(`${JSON.stringify({ schema: "oi.suite-status/v1", surfaces: [] })}\n`);
} else {
  process.stderr.write(`oi fixture world: unknown operation "${operation ?? ""}" — the fixture implements only the census reads\n`);
  process.exit(2);
}
