/**
 * The dictation surface's words — one source of truth, asserted verbatim by
 * the conformance suite and the walk. Every state names what actually
 * happened; nothing pretends, nothing auto-sends, and the separation from
 * Nara's own voice mode is carried in the labels themselves
 * ("dictation (local)" — never "voice", never "Nara").
 */

export type DictationCopyKey =
  | "buttonIdle"
  | "buttonRecording"
  | "buttonTranscribing"
  | "recording"
  | "transcribing"
  | "landed"
  | "empty"
  | "serviceDown"
  | "micDenied"
  | "micUnavailable"
  | "failed";

export function dictationCopy(key: DictationCopyKey, fields?: {url?: string; detail?: string}): string {
  const url = fields?.url ?? "";
  const detail = fields?.detail ?? "";
  switch (key) {
    case "buttonIdle":
      return "Dictate into the message (local)";
    case "buttonRecording":
      return "Stop dictation and transcribe locally";
    case "buttonTranscribing":
      return "Transcribing locally…";
    case "recording":
      return "Recording — click again to transcribe locally.";
    case "transcribing":
      return "Transcribing locally…";
    case "landed":
      return "Transcribed locally — the text is yours to amend; nothing is sent until you send it.";
    case "empty":
      return "The transcription came back empty — nothing was placed in the composer.";
    case "serviceDown":
      return `Local speech is not running — start it with ~/.local-speech/start.sh. Dictation expected a local transcription server at ${url || "its stipulated endpoint"}.`;
    case "micDenied":
      return "Microphone permission was refused by the operating system, so dictation cannot capture. Typing is unaffected.";
    case "micUnavailable":
      return "No microphone is reachable, so dictation cannot capture. Typing is unaffected.";
    case "failed":
      return `Local transcription failed${detail ? `: ${detail}` : ""}. Nothing was placed in the composer.`;
  }
}
