/** K9 controlled-host evidence: the real QL focused-instrument adapter,
 * served byte-exact from the Quaternal-Logic checkout, driving the real
 * privileged composition through the real engine lease.
 *
 * The scenario proves the full hosted loop in one browser context:
 *   - the adapter constructs its own FocusedInstrumentSession over a
 *     controlled transport (walk/fixtures/k9-controlled-host.mjs standing
 *     for the ql-focused-host owner) and registers through the same
 *     registry an external adapter uses;
 *   - attach is an actual zero-frame native acknowledgement on the focused
 *     host sequence; the retained port, owned GPU targets and checkpoint
 *     are the engine's own;
 *   - commands travel through the composition's real controls onto the
 *     exact host sequence; a host refusal is disclosed as refused;
 *   - an advance admits a real field block: the host's owner receipt
 *     rebinds the engine's target textures;
 *   - a real WebGL context loss pauses the field through the lease and the
 *     session restores its acknowledged checkpoint when the same canvas
 *     reports restoration;
 *   - leaving the binding detaches the expression and restores the
 *     ordinary desktop.
 *
 * Standing strings stay "controlled-k9-host-walk": this is not physical
 * evidence and claims nothing about owner-machine sensory validation.
 * Adapter provenance is the checked-in bytes' sha256, recorded below. */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cradleRoot = resolve(here, "..", "..");
const QL_REPO = process.env.K9_QL_REPO ?? "/Users/admin/Central/Work/Quaternal-Logic";
const QL_REF = process.env.K9_QL_REF ?? "origin/main";
const ADAPTER_FILES = ["focused-instrument-session.mjs", "retained-field.mjs", "native-audio.mjs"];
const SOURCE_REF = "ql:host:controlled";

/** Read the adapter's exact bytes from the QL repository at a fixed ref —
 * no working tree is required, so another lane's checkout state is
 * irrelevant and the provenance is exact. */
function adapterSource(file) {
  return execFileSync("git", ["-C", QL_REPO, "show", `${QL_REF}:adapters/retained-field/${file}`], { maxBuffer: 1 << 24 }).toString();
}

function qlHead() {
  return execFileSync("git", ["-C", QL_REPO, "rev-parse", QL_REF]).toString().trim();
}

/** Serve the adapter's exact bytes with their bare imports rewritten to the
 * served module origin. No copy lands in the O:I tree. */
export function adapterRoutes(page) {
  const hashes = {};
  for (const file of ADAPTER_FILES) {
    const raw = adapterSource(file);
    hashes[file] = createHash("sha256").update(raw).digest("hex");
    const rewritten = raw
      .replace(/from '\.\/([\w.-]+)'/g, "from '/k9-host/$1'")
      .replace(/from 'three'/g, "from '/k9-host/three.mjs'");
    void page.route(`**/k9-host/${file}`, (route) => route.fulfill({ contentType: "text/javascript", body: rewritten }));
  }
  // three 0.186's module build re-exports from its sibling three.core.js —
  // serve that too with the same rewriting.
  const three = readFileSync(join(cradleRoot, "node_modules", "three", "build", "three.module.js"), "utf8")
    .replace(/from '\.\/([\w.-]+\.js)'/g, "from '/k9-host/$1'");
  void page.route("**/k9-host/three.mjs", (route) => route.fulfill({ contentType: "text/javascript", body: three }));
  const threeCore = readFileSync(join(cradleRoot, "node_modules", "three", "build", "three.core.js"), "utf8");
  void page.route("**/k9-host/three.core.js", (route) => route.fulfill({ contentType: "text/javascript", body: threeCore }));
  const controller = readFileSync(join(here, "..", "fixtures", "k9-controlled-host.mjs"), "utf8");
  void page.route("**/k9-host/controller.mjs", (route) => route.fulfill({ contentType: "text/javascript", body: controller }));
  return hashes;
}

export default async function run({page,baseUrl,check,shot,channel}) {
  const hashes = adapterRoutes(page);
  hashes["_ql_ref"] = QL_REF;
  hashes["_ql_head"] = qlHead();
  await page.goto(baseUrl);
  await channel("info");
  await page.locator(".oi-point-cloud-overlay").waitFor({ state: "attached", timeout: 20000 });

  // The adapter and the controlled host are constructed in the page; the
  // session registers through the registry exactly as an external adapter
  // would (channel `instrument.registerExisting` adds no authority).
  await page.evaluate(async () => {
    const hostModule = await import("/k9-host/controller.mjs");
    const { FocusedInstrumentSession } = await import("/k9-host/focused-instrument-session.mjs");
    // The frame's native sample rate must be the device's own — the audio
    // law refuses implicit resampling, as it should. The headless walk has
    // no listener: the device is suspended so native audio queues in phase
    // instead of racing the wall clock. Audible presentation is the
    // owner-machine receipt, not this one.
    const audioContext = new AudioContext();
    await audioContext.suspend();
    const host = hostModule.createControlledHost({ sampleRate: audioContext.sampleRate });
    const count = 65536; // the engine's retained texture: texWidth * texHeight
    const slots = Array.from({ length: count }, (_, i) => i);
    const session = new FocusedInstrumentSession({
      ref: "ql:host:controlled",
      title: "Controlled host Epi / Nara",
      transport: host.transport,
      initialReceipt: host.ready(),
      correspondence: { sourceRef: "event:host-walk", revision: "registry:r1", slotsA: slots, slotsB: slots },
      audioContext,
      autostart: true,
    });
    globalThis.__k9ExternalSources = { "ql:host:controlled": session };
    globalThis.__k9Host = host;
    globalThis.__k9Session = session;
  });
  const sessionState = () => page.evaluate(() => {
    const reading = globalThis.__k9Session.reading;
    return { available: reading.available, attached: reading.attached, recovering: reading.recovering, host_sequence: reading.host_sequence, native_cursor: reading.native_cursor };
  });

  const registered = await channel("instrument.registerExisting", [SOURCE_REF]);
  check(registered.ok, "The externally constructed QL adapter session registers through the owner registry");
  await channel("instrument.requestOpen", [SOURCE_REF]);
  const instrumentRegion = page.locator('[data-epi-nara-region="instrument"]');
  await instrumentRegion.waitFor({ timeout: 15000 });

  // Attach is the adapter's actual zero-frame native acknowledgement.
  await page.waitForFunction(() => globalThis.__k9Session.reading.attached === true, null, { timeout: 15000 });
  const hostOps = await page.evaluate(() => globalThis.__k9Host.calls.map((c) => c.operation));
  check(hostOps[0] === "advance", "Attach acknowledged natively: the first host exchange is the zero-frame read", hostOps);
  const after = await sessionState();
  check(after.available === true, "The session is available from its ready receipt");

  check((await page.locator('[data-epi-nara-region="bimba"]').count())===0,"Rest enters with the Bimba source aperture closed");
  await instrumentRegion.getByRole("button",{name:"Open sources"}).click();
  await page.locator('[data-epi-nara-region="bimba"]').waitFor();
  check(true,"Bimba is summonable from the resting Nara instrument");
  await instrumentRegion.getByRole("button",{name:"Close sources"}).click();
  await page.locator('[data-epi-nara-region="bimba"]').waitFor({state:"detached"});
  check(true,"Bimba closes without leaving the retained instrument");

  // Commands through the real controls onto the exact host sequence.
  for(const focus of ["M1","M2","M3","M4"])await instrumentRegion.getByRole("button", { name: focus, exact: true }).click();
  await page.waitForFunction(() => globalThis.__k9Host.calls.some((c) => c.operation === "set-focus"), null, { timeout: 5000 });
  await instrumentRegion.getByRole("button", { name: "Freeze view" }).click();
  await page.waitForFunction(() => globalThis.__k9Host.calls.some((c) => c.operation === "freeze"), null, { timeout: 5000 });
  check((await page.evaluate(()=>globalThis.__k9Host.calls.filter(c=>c.operation==="set-focus").map(c=>c.focus))).slice(-4).join(",")==="m1,m2,m3,m4", "M1→M4 focus commands reach the same controlled host session");

  // A host refusal is disclosed, never hidden.
  await page.evaluate(() => { globalThis.__k9Host.refuseNext = true; });
  await instrumentRegion.getByRole("button", { name: "Advance" }).click();
  await page.getByText("advance: refused").waitFor({ timeout: 5000 });
  check(true, "A host refusal surfaces in the composition as refused");

  // An accepted advance admits a real field block: samples move and the
  // engine's target textures are rebound through the port.
  const before = (await sessionState()).native_cursor.samples_elapsed;
  await instrumentRegion.getByRole("button", { name: "Advance" }).click();
  await page.waitForFunction((prev) => globalThis.__k9Session.reading.native_cursor.samples_elapsed !== prev, before, { timeout: 5000 });
  const advanced = await sessionState();
  check(BigInt(advanced.native_cursor.samples_elapsed) > BigInt(before) && advanced.attached,
    "An accepted advance admits the field block and moves the native cursor", advanced);
  check((await instrumentRegion.getByRole("button", { name: "Resume live" }).count()) === 1, "The composition mirrors the host's frozen temporal state");

  await shot("instrument-host-focused");

  // A real WebGL context loss pauses through the lease; the session
  // restores its acknowledged checkpoint when the same canvas returns.
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas[data-oi-stage="engine"]');
    const gl = canvas.getContext("webgl2");
    globalThis.__loseExt = gl.getExtension("WEBGL_lose_context");
    globalThis.__loseExt.loseContext();
  });
  await page.waitForFunction(() => globalThis.__k9Session.reading.recovering === true, null, { timeout: 20000 });
  check(true, "A real context loss puts the session into honest recovery");
  await page.evaluate(() => { globalThis.__loseExt.restoreContext(); });
  await page.waitForFunction(() => {
    const reading = globalThis.__k9Session.reading;
    return reading.recovering === false && reading.attached === true;
  }, null, { timeout: 20000 });
  const recovered = await sessionState();
  check(recovered.attached === true, "The session restores its acknowledged checkpoint after the same canvas reports restoration", recovered);

  // Leaving the binding detaches the expression and restores the desktop.
  await page.locator(".tab-close").first().waitFor({ timeout: 15000 });
  await page.locator(".tab-close").first().click();
  await page.waitForTimeout(400);
  check((await page.locator('[data-epi-nara-region="instrument"]').count()) === 0, "Leaving the binding removes the composition");
  const detached = await sessionState();
  check(detached.attached === false, "The adapter's expression is detached with the binding", detached);

  check(true, "Adapter provenance: sha256 of the served QL bytes", hashes);
}
