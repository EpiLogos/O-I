import {openConversationInCentre} from "../editor-doc.mjs";
// agent-dictation: the agent chat's LOCAL dictation input aid, end to end
// against the real AIKit encounter owner — with a walk-served STT fixture,
// so CI needs no live speech service.
//
// The chain proven here: mic click → REAL getUserMedia capture (chromium's
// synthetic device) → 16 kHz WAV POST to the fixture endpoint speaking the
// whisper.cpp multipart contract → the transcript lands EDITABLE in the
// AIKit-owned shared draft → the person amends it and sends it as ordinary
// text through the owner's own prompt path (a controlled ACP protocol
// fixture answers FIXTURE_REPLY — D/C evidence, never a model). The named
// honest states are proven in the same real surface: service-down (probed
// BEFORE the microphone opens), transcript failure, empty transcript — and
// dictation never auto-sends anything.
//
// Separation law: this is the agent-chat input aid (src/dictation/), NOT
// Nara's voice mode (src/nara/), which keeps its own constitution and its
// own surface untouched.
import {createServer} from "node:http";
import {execFileSync} from "node:child_process";
import {chmodSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
import {setup as sourceSetup} from "./editor.mjs";

const providerScript = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "activity-provider.py");
const COPY = {
  buttonIdle: "Dictate into the message (local)",
  buttonRecording: "Stop dictation and transcribe locally",
  recording: "Recording — click again to transcribe locally.",
  landed: "Transcribed locally — the text is yours to amend; nothing is sent until you send it.",
  empty: "The transcription came back empty — nothing was placed in the composer.",
  serviceDown: url => `Local speech is not running — start it with ~/.local-speech/start.sh. Dictation expected a local transcription server at ${url}.`,
  failed: detail => `Local transcription failed: ${detail}. Nothing was placed in the composer.`,
};

export async function setup(args) {
  const source = await sourceSetup(args);
  const aikit = process.env.OI_AIKIT_BIN ?? "aikit";
  const sessionSpace = process.env.OI_AIKIT_SESSION_SPACE_BIN ?? "aikit-session-space";
  const suite = process.env.OI_BIN ?? "oi", router = join(source.root, "oi-owner-router.mjs");
  writeFileSync(router, `#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args=process.argv.slice(2), routed=args[0]==="aikit-session-space";\nconst child=spawnSync(routed?${JSON.stringify(sessionSpace)}:${JSON.stringify(suite)},routed?args.slice(1):args,{stdio:"inherit"});\nprocess.exit(child.status??1);\n`); chmodSync(router, 0o755);
  const env = {...process.env, ...source.env, AIKIT_HOME: join(source.root, ".aikit-home"), OI_BIN: router, OI_AIKIT_BIN: aikit, OI_AIKIT_SESSION_SPACE_BIN: sessionSpace};
  const native = (...parts) => JSON.parse(execFileSync(sessionSpace, ["-C", source.projectRoot, ...parts], {encoding: "utf8", env}));
  const bind = JSON.parse(execFileSync(aikit, ["--json", "-C", source.projectRoot, "project", "bind", "editor-walk", "--directory", source.projectRoot, "--no-default-skill-sets"], {encoding: "utf8", env}));
  if (!bind.ok) throw new Error(JSON.stringify(bind));
  const apply = preview => native("apply", "--preview-json", JSON.stringify(preview));
  const space = "session-space/agent-dictation-walk", ref = "agent-session/agent-dictation-walk";
  apply(native("create", space, "--label", "Dictation acceptance"));
  for (const intent of [
    {operation: "bind-project-context", binding: native("project-context")},
    {operation: "attach-agent-session", attachment: {agent_session: ref, purpose: "Agent dictation acceptance", provenance: ["Explicit real dictation acceptance"]}},
  ]) apply(native("stage", "--space", space, "--intent-json", JSON.stringify(intent)));
  // The controlled ACP fixture: a scripted protocol transport, never a model.
  native("encounter-configure", "--provider-json", JSON.stringify({id: "dictation-acp", label: "Dictation fixture ACP", protocol: "acp", argv: ["python3", "-u", providerScript, "acp", join(source.root, "dictation-provider.log")]}));
  const owner = native("encounter-start"); if (!owner.ok) throw new Error(JSON.stringify(owner));
  const request = (action, fields = {}) => { const result = native("encounter", "--request-json", JSON.stringify({action, agent_session: ref, ...fields})); if (!result.ok) throw new Error(JSON.stringify(result)); return result.data; };
  return {...source, env, native, request, space, ref, cleanup: () => { try { process.kill(-owner.data.pid, "SIGTERM"); } catch {} source.cleanup(); }};
}

/** The walk's STT fixture: the whisper.cpp wire (multipart `file=` +
 * `response_format=json` → `{"text": ...}`), with `?behaviour=` switching
 * the honest states (ok / empty / badjson / status). CORS-open so the page
 * (localhost:4173) may call this loopback port. */
async function startSttFixture() {
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", chunk => chunks.push(chunk));
    request.on("end", () => {
      const behaviour = new URL(request.url ?? "/", "http://127.0.0.1").searchParams.get("behaviour") ?? "ok";
      response.setHeader("access-control-allow-origin", "*");
      if (request.method === "OPTIONS") { response.writeHead(204, {"access-control-allow-methods": "POST"}); response.end(); return; }
      if (behaviour === "status") { response.writeHead(500); response.end("boom"); return; }
      response.writeHead(200, {"content-type": "application/json"});
      if (behaviour === "badjson") { response.end("<html>not json</html>"); return; }
      if (behaviour === "empty") { response.end(JSON.stringify({text: "   "})); return; }
      response.end(JSON.stringify({text: "Dictated fixture transcript"}));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {server, url: behaviour => `http://127.0.0.1:${server.address().port}/inference?behaviour=${behaviour}`, close: () => server.close()};
}

/** A port with nothing listening — the honest "service not running". */
async function deadPort() {
  const server = createServer(() => {});
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return `http://127.0.0.1:${port}/inference`;
}

export default async function run({baseUrl, bridgeUrl, artifactsDir, check, log, provision: p}) {
  const stt = await startSttFixture();
  const dead = await deadPort();
  const nativeOp=async operation=>{const response=await fetch(`${bridgeUrl}/op`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(operation)});const result=await response.json();if(!result.ok)throw Error(result.error);return result.outcome;};
  const stipulate=async url=>{const current=await nativeOp({op:"dictation_read"});return nativeOp({op:"dictation_configure",stt_url:url,expected_revision:current.stipulation.revision});};

  // A dedicated browser: chromium's synthetic microphone, the same proven
  // pattern as tests/nara-presence-lifecycle.mjs (the run.mjs browser has no
  // media flags, and the walk never touches ITS page's microphone).
  const browser = await chromium.launch({headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]});
  const context = await browser.newContext({viewport: {width: 1280, height: 820}, permissions: ["microphone"]});
  const page = await context.newPage();
  page.on("pageerror", error => log(`[pageerror] ${error.message}`));
  await page.addInitScript(url => { window.__OI_KERNEL_BRIDGE__ = url; }, bridgeUrl);
  await page.addInitScript(() => {
    if (!new URLSearchParams(location.search).has("frontstate")) {
      sessionStorage.setItem("oi-cradle.welcome.v1", "walk-continuing-session");
    }
  });
  // The stipulation is read at each dictation press, so the walk re-points
  // it live for the honest states below.
  await stipulate(stt.url("ok"));

  const shot = async label => { const file = `agent-dictation-${label}.png`; await page.screenshot({path: join(artifactsDir, file)}); return file; };
  const consoleLines = [];
  page.on("console", message => consoleLines.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", error => consoleLines.push(`pageerror: ${error.message}`));
  /** Wait for a named dictation state, dumping the surface's real state on timeout. */
  const waitForDictation = async (state, timeout = 20000) => {
    try {
      await page.waitForFunction(expected => document.querySelector("[data-dictation-line]")?.getAttribute("data-dictation-line") === expected, state, {timeout});
    } catch {
      const line = await page.locator("[data-dictation-line]").count()
        ? await page.locator("[data-dictation-line]").innerText().catch(() => "(unreadable)") : "(no line)";
      const row = await page.locator(".encounter-composer-actions").first().getAttribute("data-dictation-state").catch(() => "?");
      const value = await page.getByRole("textbox", {name: "Message", exact: true}).inputValue().catch(() => "(unreadable)");
      throw new Error(`dictation never reached "${state}" (row=${row}, line="${line}", composer="${value}", console=${JSON.stringify(consoleLines.slice(-12))})`);
    }
  };

  try {
    await page.goto(baseUrl);
    // The boot barrier: the walk channel mounts through the provider's
    // effects once the app is actually up — the signal channel("info")
    // gives the other scenarios on the harness page.
    await page.waitForFunction(() => typeof (globalThis.__cradle?.walk) === "object", null, {timeout: 30000});
    const nav = page.getByRole("complementary", {name: "World navigator"});
    await nav.locator('[data-project-path="Work/Editor"]').click();
    await nav.getByRole("button", {name: "Editor: chats and tasks", exact: true}).click();
    const conversation = page.getByRole("button", {name: "Agent dictation acceptance", exact: true});
    try { await conversation.waitFor({timeout: 10000}); } catch { throw new Error(`Conversation was not disclosed. Buttons: ${JSON.stringify(await nav.locator("button").allTextContents())}`); }
    await openConversationInCentre(page, "Agent dictation acceptance");
    const message = page.getByRole("textbox", {name: "Message", exact: true});
    await message.waitFor();

    // --- the affordance, labelled for what it is ---
    const mic = page.locator("button.encounter-dictate");
    check(await mic.count() === 1, "The composer's microphone renders beside the actions", {aria: await mic.getAttribute("aria-label")});
    check(await mic.getAttribute("aria-label") === COPY.buttonIdle, "The mic is labelled dictation (local) — the generic voice-input aid, not a voice mode");
    const rowState = page.locator(".encounter-composer-actions").first();
    check(await rowState.getAttribute("data-dictation-state") === "idle", "At rest the dictation state is idle and no status line stands");
    await page.waitForFunction(() => { const button = document.querySelector("button.encounter-dictate"); return button && !button.disabled; }, null, {timeout: 30000});

    // --- recording: real capture, and nothing leaves the composer ---
    await mic.click();
    await waitForDictation("recording", 15000);
    check((await page.locator("[data-dictation-line]").innerText()) === COPY.recording, "Click one records from the (synthetic) microphone and says so");
    check(await mic.getAttribute("aria-pressed") === "true", "The mic reads as pressed while recording");
    check((await message.inputValue()) === "", "Nothing entered the composer while recording — dictation never invents text");
    check(p.request("view").blocks.filter(block => block.kind === "user").length === 0, "The owner's transcript carries no new turn — recording dispatched nothing");

    // --- transcribe: the fixture STT answers; the transcript lands editable ---
    await mic.click();
    await waitForDictation("landed");
    check((await message.inputValue()) === "Dictated fixture transcript", "The fixture transcript landed in the composer as editable text");
    check((await page.locator("[data-dictation-line]").innerText()) === COPY.landed, "The landed line says the text is yours to amend and nothing was sent");
    await shot("transcript-landed");

    // --- the person amends, then sends it as ordinary text ---
    const amended = "Dictated fixture transcript — then the owner adds this.";
    await message.fill(amended);
    check((await message.inputValue()) === amended, "The transcript is the person's text — amended before anything sends");
    await page.getByRole("button", {name: "Dictation fixture ACP", exact: true}).click();
    await page.waitForFunction(() => !document.querySelector(".encounter-connect"), null, {timeout: 60000});
    const send = page.locator("button.encounter-send");
    await page.waitForFunction(() => { const button = document.querySelector("button.encounter-send"); return button && !button.disabled; }, null, {timeout: 30000});
    await send.click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll(".encounter-assistant")).some(node => node.textContent.includes("FIXTURE_REPLY")), null, {timeout: 60000});
    check(true, "The person's send carries the amended transcript; the fixture provider answers through the real owner");
    const view = p.request("view");
    check(view.blocks.some(block => block.kind === "user" && block.text === amended), "The owner's canonical transcript holds the amended dictated text verbatim", {sent: amended});

    // --- service-down: probed BEFORE the microphone opens; the gap is named ---
    await stipulate(dead);
    await mic.click();
    await waitForDictation("service-down", 15000);
    check((await page.locator("[data-dictation-line]").innerText()) === COPY.serviceDown(dead), "A stopped local speech stack names the gap and the start instruction", {probed: dead});
    check(await mic.getAttribute("aria-pressed") !== "true", "The microphone was never opened — the probe refused first");

    // --- transcript failure: the server answers, wrongly ---
    await stipulate(stt.url("status"));
    await mic.click();
    await waitForDictation("recording", 15000);
    await mic.click();
    await waitForDictation("failed");
    check((await page.locator("[data-dictation-line]").innerText()) === COPY.failed("the local server answered HTTP 500"), "A failed transcription names the failure; nothing was placed in the composer");

    // --- empty transcript: the server answers honestly with silence ---
    await stipulate(stt.url("empty"));
    await mic.click();
    await waitForDictation("recording", 15000);
    await mic.click();
    await waitForDictation("empty");
    check((await page.locator("[data-dictation-line]").innerText()) === COPY.empty, "An empty transcription says so and places nothing");
    await shot("honest-states");
  } finally {
    await browser.close();
    stt.close();
  }
}
