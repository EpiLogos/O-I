/**
 * The dictation stipulation (desktop-owned).
 *
 * Dictation is an input aid owned by the desktop itself — the same class of
 * desktop-owned matter as the Visuals layer ("the appearance and expression
 * layer owned by the desktop itself", settings/types.ts), NOT a product
 * setting: the six-owner settings page projects product-owned descriptors
 * (docs/cradle/06-SYSTEM-SETTINGS.md L4/L6), and no product owns a local
 * speech stack. The composition plane's setting refs
 * (`product:domain:key`, docs/cradle/09-CONFIGURATION-PLANE.md) likewise
 * belong to real product owners; inventing one for the desktop's own input
 * aid would misattribute ownership.
 *
 * So the endpoint stipulation lives here as a versioned, validated
 * localStorage record with a documented default, exactly the
 * visual-preference owner's pattern: wrong or missing shapes fall back
 * field-by-field to the default, and nothing reaches the renderer
 * unvalidated. The seam is named in the contract
 * (docs/contracts/NARA-SPEECH-EXPERIENCE-V1.md § Dictation). If the desktop
 * ever grows a settings slot of its own, that slot binds to this same door.
 */

export const DICTATION_STORAGE_KEY = "oi-cradle.dictation.v1";

/** The documented default: the local whisper.cpp server of the suite's
 * local speech stack (~/.local-speech). This build serves the OpenAI-shaped
 * multipart call on `/inference` (not `/v1/audio/transcriptions`). */
export const DEFAULT_STT_URL = "http://127.0.0.1:8080/inference";

export interface DictationStipulation {
  revision: number;
  stt_url: string;
}

function isLoopbackHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}

/** Structural validation: wrong shapes fall back to defaults field-by-field.
 * The endpoint must be a loopback HTTP(S) URL — dictation is a LOCAL input
 * aid; a remote endpoint is not a dictation stipulation, it is a different
 * product, and this record refuses to become one silently. */
export function sanitizeDictationStipulation(raw: unknown): DictationStipulation {
  const base: DictationStipulation = { revision: 0, stt_url: DEFAULT_STT_URL };
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Record<string, unknown>;
  const revision = typeof record.revision === "number" && Number.isFinite(record.revision) && record.revision >= 0
    ? Math.floor(record.revision)
    : 0;
  const stt_url = isLoopbackHttpUrl(record.stt_url) ? record.stt_url : DEFAULT_STT_URL;
  return { revision, stt_url };
}

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** Read the live stipulation. Reads are never cached: the button's next
 * press always consults the record as it stands now. */
export function readDictationStipulation(): DictationStipulation {
  const storage = safeStorage();
  if (!storage) return { revision: 0, stt_url: DEFAULT_STT_URL };
  const raw = storage.getItem(DICTATION_STORAGE_KEY);
  if (raw === null) return { revision: 0, stt_url: DEFAULT_STT_URL };
  try {
    return sanitizeDictationStipulation(JSON.parse(raw));
  } catch {
    return { revision: 0, stt_url: DEFAULT_STT_URL };
  }
}

/** Write a new endpoint. Refuses (named error) anything that is not a
 * loopback HTTP(S) URL — the refusal is the honesty, not a silent default. */
export function writeSttUrl(url: string): DictationStipulation {
  if (!isLoopbackHttpUrl(url)) {
    throw new Error(`Dictation refuses a non-loopback endpoint ("${url}"): the dictation stipulation names a LOCAL speech server (http://127.0.0.1/… or http://localhost/…).`);
  }
  const current = readDictationStipulation();
  const next: DictationStipulation = { revision: current.revision + 1, stt_url: url };
  const storage = safeStorage();
  if (storage) storage.setItem(DICTATION_STORAGE_KEY, JSON.stringify(next));
  return next;
}
