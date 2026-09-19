import {useCallback, useEffect, useRef, useState} from "react";

/**
 * Voice dictation for the chat composers (handoff §9: text, voice and
 * attachment facilities in the established grammar). One control, shared by
 * every agent panel through its composer.
 *
 * The engine is the webview's own Web Speech API — a client capability, not a
 * desktop-owned service. Where the webview does not expose it (Tauri's
 * WKWebView today), the control renders in an honest unavailable state: named,
 * never silently missing, and never a fabricated transcript. Interim
 * hypotheses stream into the draft live; only final results are committed.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: {resultIndex: number; results: ArrayLike<ArrayLike<{transcript: string}> & {isFinal: boolean}>}) => void) | null;
  onerror: ((event: {error: string}) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike};
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Whether this webview can dictate at all. Cheap, stable, safe to call
 * during render for control availability. */
export function voiceDictationAvailable(): boolean {
  return !!recognitionCtor();
}

/** One dictation session bound to a draft setter. `compose` receives the
 * whole new draft text: final results are appended after the existing
 * message, interim hypotheses trail live and are replaced as the recognizer
 * revises them. Stop is explicit — the control is a mode, not a leak. */
export function useVoiceDictation(onDraft: (text: string) => void, currentText: () => string): {
  supported: boolean;
  listening: boolean;
  error?: string;
  toggle: () => void;
  stop: () => void;
} {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string>();
  const recognition = useRef<SpeechRecognitionLike>();
  const finalBase = useRef("");
  const getText = useRef(currentText);
  getText.current = currentText;
  const setDraft = useRef(onDraft);
  setDraft.current = onDraft;

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (listening) { stop(); return; }
    const Ctor = recognitionCtor();
    if (!Ctor) { setError("This webview exposes no speech engine yet — voice input stays an honest gap until one is wired."); return; }
    setError(undefined);
    finalBase.current = getText.current();
    const engine = new Ctor();
    engine.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-GB";
    engine.continuous = true;
    engine.interimResults = true;
    engine.onresult = event => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalBase.current = `${finalBase.current}${finalBase.current && !/\s$/.test(finalBase.current) ? " " : ""}${transcript.trim()}`;
          interim = "";
        } else interim += transcript;
      }
      const spoken = interim ? `${finalBase.current}${finalBase.current && !/\s$/.test(finalBase.current) ? " " : ""}${interim}` : finalBase.current;
      setDraft.current(spoken);
    };
    engine.onerror = event => {
      if (event.error === "aborted") return;
      setError(event.error === "not-allowed" ? "Microphone access was refused by the system." : `Voice input failed: ${event.error}`);
      setListening(false);
    };
    engine.onend = () => setListening(false);
    recognition.current = engine;
    engine.start();
    setListening(true);
  }, [listening, stop]);

  useEffect(() => () => {recognition.current?.stop();}, []);

  return {supported: voiceDictationAvailable(), listening, error, toggle, stop};
}
