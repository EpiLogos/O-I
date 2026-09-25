/** Pure production WAV/copy/refusal behaviour. Native ownership, persistence,
 * endpoint refusal and transport are exercised by dictation-native.test.mjs
 * and kernel::dictation tests; no pretend speech server or browser storage. */
import test from "node:test";
import assert from "node:assert/strict";
import {DICTATION_SAMPLE_RATE,resampleTo16k,encodeWav16kMono} from "../src/dictation/wav.ts";
import {dictationCopy} from "../src/dictation/copy.ts";
import {dictationRefusalFromCaptureError} from "../src/dictation/client.ts";
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
