/**
 * Read-only readings of every registered focused-instrument source, for
 * receiving planes (Anima / Nara, Epii) and the Technè instrument switcher.
 *
 * A reading is exactly what the source's own `read()` returned, or its
 * refusal verbatim. This hook never commands a source, never attaches an
 * Expression lease and never reconstructs an M state: it lists, reads and
 * re-reads when the registry or a source announces a change.
 */
import {useEffect, useState} from "react";
import {focusedInstrumentSource, focusedInstrumentSources, subscribeFocusedInstrumentRegistry, subscribeFocusedInstrumentSource, type FocusedInstrumentSnapshot} from "./source";

export interface FocusedInstrumentReading {
  ref: string;
  title: string;
  state: "reading" | "read" | "refused";
  snapshot?: FocusedInstrumentSnapshot;
  error?: string;
}

export function useFocusedInstrumentReadings(): FocusedInstrumentReading[] {
  const [sources, setSources] = useState(focusedInstrumentSources);
  const [readings, setReadings] = useState<Record<string, FocusedInstrumentReading>>({});
  useEffect(() => {
    const update = () => setSources(focusedInstrumentSources());
    update();
    return subscribeFocusedInstrumentRegistry(update);
  }, []);
  const refs = sources.map(source => source.ref).join("\n");
  useEffect(() => {
    let live = true;
    const stops = sources.map(({ref, title}) => {
      const read = () => {
        const source = focusedInstrumentSource(ref);
        if (!source) return;
        void source.read().then(
          snapshot => { if (live) setReadings(current => ({...current, [ref]: {ref, title, state: "read", snapshot}})); },
          cause => { if (live) setReadings(current => ({...current, [ref]: {ref, title, state: "refused", error: cause instanceof Error ? cause.message : String(cause)}})); },
        );
      };
      read();
      return subscribeFocusedInstrumentSource(ref, read);
    });
    return () => { live = false; for (const stop of stops) stop(); };
  // The joined refs are the dependency: a new array of the same sources must not re-read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs]);
  return sources.map(({ref, title}) => readings[ref] ?? {ref, title, state: "reading"});
}
