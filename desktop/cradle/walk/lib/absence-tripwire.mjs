// A minimal-installation environment for a walk: Factory and Workcell are genuinely absent from the discovery the
// product uses (PATH), and a tripwire records — and refuses — any attempt to dispatch to them anyway through the
// explicit routes the kernel also honours (OI_BIN namespace dispatch, OI_WORKCELL_BIN, OI_FACTORY_BIN).
//
// Absence is not faked: the sandbox PATH simply omits the excluded binaries, so the owner's own census
// (`oi current-world`, read through the kernel's `composition_read`) reports them missing. The tripwire shims are NOT
// on PATH (a shim on PATH would make discovery find the product); they are named only by the explicit env routes.
// Dev tooling only; it grants the renderer nothing.
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {homedir, tmpdir} from "node:os";
import {basename, dirname, join} from "node:path";

export const EXCLUDED = /^(workcell|factory|software-factory)/;

export function installTripwireEnvironment({localBin = join(homedir(), ".local/bin"), base = process.env, home} = {}) {
  const root = mkdtempSync(join(tmpdir(), "oi-minimal-"));
  const bin = join(root, "bin"), trip = join(root, "tripwire"), log = join(root, "tripwire.log");
  mkdirSync(bin); mkdirSync(trip); writeFileSync(log, "");
  // Everything the product legitimately uses stays reachable; only the excluded products are withheld.
  const withheld = [];
  for (const name of readdirSync(localBin)) { if (EXCLUDED.test(name)) withheld.push(name); else symlinkSync(join(localBin, name), join(bin, name)); }
  const shim = join(trip, "shim.sh");
  writeFileSync(shim, `#!/bin/sh\necho "$(basename "$0") $* <- $(ps -o command= -p $PPID | cut -c1-160)" >> "$OI_TRIPWIRE_LOG"\necho "tripwire: $(basename "$0") must not be dispatched in a minimal installation" >&2\nexit 97\n`);
  chmodSync(shim, 0o755);
  for (const name of ["workcell", "factory"]) symlinkSync(shim, join(trip, name));
  const guard = join(trip, "oi-guard");
  writeFileSync(guard, `#!/bin/sh\ncase "$1" in workcell|factory|software-factory) echo "oi $*" >> "$OI_TRIPWIRE_LOG"; echo "tripwire: oi $1 dispatched" >&2; exit 97;; esac\nexec "$OI_REAL_BIN" "$@"\n`);
  chmodSync(guard, 0o755);
  // The candidate build of `oi` (OI_CANDIDATE_BIN) stands in for the installed one when a change to the CLI is under test.
  const real = join(bin, "oi");
  if (process.env.OI_CANDIDATE_BIN) { rmSync(real, {force: true}); symlinkSync(process.env.OI_CANDIDATE_BIN, real); }
  if (!existsSync(real)) throw new Error(`no oi at ${real}: the minimal environment needs the real oi for the owner's census`);
  const node = dirname(process.execPath);
  const env = {
    PATH: [bin, node, "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":"),
    OI_BIN: guard, OI_REAL_BIN: real, OI_WORKCELL_BIN: join(trip, "workcell"), OI_FACTORY_BIN: join(trip, "factory"), OI_TRIPWIRE_LOG: log,
  };
  // A clean installation runs under its own HOME: nothing of the everyday installation (its ~/.local/bin, ~/.config/oi,
  // ~/Applications, ~/.aikit) is reachable except what the sandbox PATH names.
  if (home) Object.assign(env, {HOME: home, OI_HOME: join(home, "oi-home"), AIKIT_HOME: join(home, ".aikit")});
  Object.assign(base, env);
  return {root, env, withheld, log, entries: () => readFileSync(log, "utf8").split("\n").filter(Boolean), clear: () => writeFileSync(log, "")};
}
