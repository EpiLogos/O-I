/**
 * Dictation (local) conformance: the agent-chat input aid's stipulation law,
 * wire encoder, honest-state client and rendered words.
 *
 * Everything asserted here runs against a real local HTTP fixture — the same
 * multipart `file=` + `response_format=json` contract the suite's
 * whisper.cpp server speaks (`~/.local-speech`) — so the client's named
 * states are proven as wire behaviour, never as mocks of themselves.
 *
 * Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/dictation-conformance.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";

// A Map-backed localStorage shim: the store reads the global at call time,
// so conformance exercises the exact persistence path the app runs.
const backing = new Map();
globalThis.localStorage = {
  getItem: key => (backing.has(key) ? backing.get(key) : null),
  setItem: (key, value) => backing.set(key, String(value)),
  removeItem: key => backing.delete(key),
  clear: () => backing.clear(),
};

const {
  DICTATION_STORAGE_KEY, DEFAULT_STT_URL,
  sanitizeDictationStipulation, readDictationStipulation, writeSttUrl,
} = await import("../src/dictation/store.ts");
const {DICTATION_SAMPLE_RATE, resampleTo16k, encodeWav16kMono} = await import("../src/dictation/wav.ts");
const {dictationCopy} = await import("../src/dictation/copy.ts");
const {
  probeTranscriptionEndpoint, transcribeWav, dictationRefusalFromCaptureError,
} = await import("../src/dictation/client.ts");

/** One local STT fixture: whisper.cpp-shaped. `behaviour` picks the reply:
 * ok (200 {"text"}), empty, badjson, nofield, or status (a 500). Records
 * the last request's content type and body for the wire-shape proof. */
function sttFixture(behaviour, text = "Dictated fixture transcript") {
  const fixture = {server: undefined, last: undefined};
  fixture.server = createServer((request, response) => {
    const chunks = [];
    request.on("data", chunk => chunks.push(chunk));
    request.on("end", () => {
      fixture.last = {
        contentType: request.headers["content-type"] ?? "",
        body: Buffer.concat(chunks),
      };
      response.setHeader("access-control-allow-origin", "*");
      if (behaviour === "ok") {
        response.writeHead(200, {"content-type": "application/json"});
        response.end(JSON.stringify({text}));
      } else if (behaviour === "empty") {
        response.writeHead(200, {"content-type": "application/json"});
        response.end(JSON.stringify({text: "   "}));
      } else if (behaviour === "badjson") {
        response.writeHead(200, {"content-type": "application/json"});
        response.end("<html>not json</html>");
      } else if (behaviour === "nofield") {
        response.writeHead(200, {"content-type": "application/json"});
        response.end(JSON.stringify({segments: []}));
      } else {
        response.writeHead(500);
        response.end("boom");
      }
    });
  });
  return fixture;
}

async function listen(server) {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}/inference`;
}

const freshStorage = () => backing.clear();

// --- the stipulation (store.ts) ---

test("an absent record reads as the documented default stipulation", () => {
  freshStorage();
  assert.deepEqual(readDictationStipulation(), {revision: 0, stt_url: DEFAULT_STT_URL});
  assert.equal(DEFAULT_STT_URL, "http://127.0.0.1:8080/inference");
});

test("garbage in the record falls back field-by-field, never into the renderer", () => {
  assert.deepEqual(sanitizeDictationStipulation(null), {revision: 0, stt_url: DEFAULT_STT_URL});
  assert.deepEqual(sanitizeDictationStipulation("nonsense"), {revision: 0, stt_url: DEFAULT_STT_URL});
  assert.deepEqual(sanitizeDictationStipulation({revision: "seven", stt_url: 42}), {revision: 0, stt_url: DEFAULT_STT_URL});
  // A valid endpoint keeps its value even beside an invalid revision.
  assert.deepEqual(sanitizeDictationStipulation({revision: 3.7, stt_url: "http://127.0.0.1:9999/inference"}),
    {revision: 3, stt_url: "http://127.0.0.1:9999/inference"});
});

test("a non-loopback endpoint is refused by name, not silently defaulted", () => {
  freshStorage();
  assert.throws(() => writeSttUrl("https://api.example.com/v1/audio/transcriptions"),
    /refuses a non-loopback endpoint/);
  assert.throws(() => writeSttUrl("ftp://127.0.0.1/inference"), /refuses a non-loopback endpoint/);
  assert.throws(() => writeSttUrl("not a url"), /refuses a non-loopback endpoint/);
  // The refusal left the standing record untouched.
  assert.deepEqual(readDictationStipulation(), {revision: 0, stt_url: DEFAULT_STT_URL});
});

test("a loopback stipulation writes, bumps the revision, and reads back", () => {
  freshStorage();
  const written = writeSttUrl("http://localhost:8123/inference");
  assert.equal(written.revision, 1);
  assert.equal(readDictationStipulation().stt_url, "http://localhost:8123/inference");
  assert.equal(JSON.parse(backing.get(DICTATION_STORAGE_KEY)).revision, 1);
  writeSttUrl("http://127.0.0.1:8080/inference");
  assert.equal(readDictationStipulation().revision, 2);
});

// --- the encoder (wav.ts) ---

test("the WAV container is a minimal 16 kHz mono PCM16 RIFF file", async () => {
  const blob = encodeWav16kMono(new Float32Array(1600));
  const wav = Buffer.from(await blob.arrayBuffer());
  assert.equal(blob.type, "audio/wav");
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.toString("ascii", 12, 16), "fmt ");
  assert.equal(wav.readUInt32LE(16), 16);
  assert.equal(wav.readUInt16LE(20), 1);                    // PCM
  assert.equal(wav.readUInt16LE(22), 1);                    // mono
  assert.equal(wav.readUInt32LE(24), DICTATION_SAMPLE_RATE);
  assert.equal(wav.readUInt32LE(28), DICTATION_SAMPLE_RATE * 2);
  assert.equal(wav.readUInt16LE(32), 2);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.toString("ascii", 36, 40), "data");
  assert.equal(wav.readUInt32LE(40), 3200);                 // 1600 samples × 2 bytes
  assert.equal(wav.readUInt32LE(4), 36 + 3200);
  assert.equal(wav.length, 44 + 3200);
});

test("resampling is identity at 16 kHz and preserves length math below", () => {
  const samples = new Float32Array([0, 0.25, -0.5, 1, -1]);
  assert.equal(resampleTo16k(samples, 16000), samples);
  const down = resampleTo16k(new Float32Array(48000), 48000);
  assert.equal(down.length, 16000);
  const tiny = resampleTo16k(new Float32Array(10), 48000);
  assert.equal(tiny.length, 3);   // Math.round(10/3)
  assert.deepEqual(resampleTo16k(new Float32Array(0), 48000), new Float32Array(0));
});

// --- the rendered words (copy.ts) — exact, no paraphrase ---

test("every honest state has its exact rendered words", () => {
  assert.equal(dictationCopy("buttonIdle"), "Dictate into the message (local)");
  assert.equal(dictationCopy("buttonRecording"), "Stop dictation and transcribe locally");
  assert.equal(dictationCopy("buttonTranscribing"), "Transcribing locally…");
  assert.equal(dictationCopy("recording"), "Recording — click again to transcribe locally.");
  assert.equal(dictationCopy("landed"),
    "Transcribed locally — the text is yours to amend; nothing is sent until you send it.");
  assert.equal(dictationCopy("serviceDown", {url: "http://127.0.0.1:8080/inference"}),
    "Local speech is not running — start it with ~/.local-speech/start.sh. Dictation expected a local transcription server at http://127.0.0.1:8080/inference.");
  assert.equal(dictationCopy("serviceDown"),
    "Local speech is not running — start it with ~/.local-speech/start.sh. Dictation expected a local transcription server at its stipulated endpoint.");
  assert.equal(dictationCopy("micDenied"),
    "Microphone permission was refused by the operating system, so dictation cannot capture. Typing is unaffected.");
  assert.equal(dictationCopy("micUnavailable"),
    "No microphone is reachable, so dictation cannot capture. Typing is unaffected.");
  assert.equal(dictationCopy("failed", {detail: "the local server answered HTTP 500"}),
    "Local transcription failed: the local server answered HTTP 500. Nothing was placed in the composer.");
  assert.equal(dictationCopy("empty"),
    "The transcription came back empty — nothing was placed in the composer.");
});

// --- the client against the real wire (client.ts) ---

test("the transcription POST is the whisper.cpp multipart contract", async () => {
  freshStorage();
  const fixture = sttFixture("ok", "wire shape proof");
  const url = await listen(fixture.server);
  try {
    const outcome = await transcribeWav(url, encodeWav16kMono(new Float32Array(480)));
    assert.deepEqual(outcome, {kind: "transcript", text: "wire shape proof"});
    const seen = fixture.last;
    assert.ok(seen, "the fixture received the dictation POST");
    assert.match(seen.contentType, /^multipart\/form-data;/);
    const body = seen.body.toString("latin1");
    assert.match(body, /name="file"; filename="dictation\.wav"/);
    assert.match(body, /name="response_format"/);
    assert.match(body, /json/);
  } finally {
    fixture.server.close();
  }
});

test("any HTTP answer proves reachability — a 404 probe does not name the gap", async () => {
  const server = createServer((request, response) => {
    response.writeHead(404, {"access-control-allow-origin": "*"});
    response.end("no such path");
  });
  const url = await listen(server);
  try {
    await probeTranscriptionEndpoint(url);
  } finally {
    server.close();
  }
});

test("a dead endpoint probes as service-down before the microphone opens", async () => {
  // A port with nothing listening: bind, note, release.
  const server = createServer(() => {});
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  const url = `http://127.0.0.1:${port}/inference`;
  await assert.rejects(probeTranscriptionEndpoint(url), refusal => {
    assert.equal(refusal.kind, "service-down");
    return true;
  });
  const outcome = await transcribeWav(url, encodeWav16kMono(new Float32Array(48)));
  assert.equal(outcome.kind, "service-down");
});

test("transcript failures are named, never faked into text", async () => {
  for (const behaviour of ["empty", "badjson", "nofield", "status"]) {
    const fixture = sttFixture(behaviour);
    const url = await listen(fixture.server);
    try {
      const outcome = await transcribeWav(url, encodeWav16kMono(new Float32Array(48)));
      if (behaviour === "empty") {
        assert.deepEqual(outcome, {kind: "empty"});
      } else if (behaviour === "badjson") {
        assert.equal(outcome.kind, "failed");
        assert.match(outcome.detail, /not JSON/);
      } else if (behaviour === "nofield") {
        assert.equal(outcome.kind, "failed");
        assert.match(outcome.detail, /no "text" field/);
      } else {
        assert.deepEqual(outcome, {kind: "failed", detail: "the local server answered HTTP 500"});
      }
    } finally {
      fixture.server.close();
    }
  }
});

test("capture refusals map to their named states", () => {
  const denied = dictationRefusalFromCaptureError(new DOMException("denied", "NotAllowedError"));
  assert.deepEqual(denied, {kind: "mic-denied"});
  const secured = dictationRefusalFromCaptureError(new DOMException("secured", "SecurityError"));
  assert.deepEqual(secured, {kind: "mic-denied"});
  const absent = dictationRefusalFromCaptureError(new DOMException("no device", "NotFoundError"));
  assert.deepEqual(absent, {kind: "mic-unavailable"});
  const opaque = dictationRefusalFromCaptureError(new Error("something else"));
  assert.deepEqual(opaque, {kind: "mic-unavailable"});
});
