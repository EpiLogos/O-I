/**
 * The Technē surface host (L5 Technē T0) — the ONE new surface kind
 * `"techne"`, the Cradle body of the DisclosureSession seam. It presents the
 * session's current instrument over the registered Technē source, and shows
 * the reading's disclosure honestly: available instruments are affordances
 * wired to `openInInstrument`; unavailable ones carry their reason and are
 * never hidden (QL-MEF wayfinder §2.1, §5). Instrument components mount
 * through `registerTechneSurface` (lanes T2–T7); until then the pane is the
 * honest placeholder.
 *
 * Agent co-reference rides the existing mechanism: the binding's `ref` is
 * the session subject, the kernel makes the active surface's ref the one
 * focus subject, and the AgentLayer reads `focus.subject` — no second
 * session store here.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { techneSource, subscribeTechneSource, subscribeTechneSources } from "./adapter";
import { techneSurface } from "./registry";
import { disclosureSession } from "./session";
import type { SurfaceBinding } from "../surface/types";
import type { TechneInstrument, TechneReading } from "./contract";
import "./techne.css";

const subscribeSession = (listener: () => void) => disclosureSession.subscribe(listener);
const subscribeSourcesVersion = (listener: () => void) => subscribeTechneSources(listener);

export function TechneSurfaceHost({ binding }: { binding: SurfaceBinding }) {
  const session = useSyncExternalStore(subscribeSession, disclosureSession.get);
  // A source registering later must arrive without a remount.
  const [, bumpSourceVersion] = useState(0);
  useEffect(() => subscribeSourcesVersion(() => bumpSourceVersion((version) => version + 1)), []);
  const [reading, setReading] = useState<TechneReading | null>(null);
  const [readingFailure, setReadingFailure] = useState<string | null>(null);

  const payload = binding.techne;
  // The body follows the session's current instrument; the binding payload
  // is the entry basis. One session across instruments (§3–§4).
  const instrument: TechneInstrument | undefined = session?.instrument ?? payload?.instrument;
  const subjectRef: string | undefined = session?.subject_ref ?? payload?.subjectRef;
  const source = techneSource();

  useEffect(() => {
    if (!source || !subjectRef) {
      setReading(null);
      setReadingFailure(null);
      return;
    }
    let live = true;
    setReadingFailure(null);
    const read = () => {
      source.reading(subjectRef)
        .then((result) => { if (live) { setReading(result); setReadingFailure(null); } })
        .catch((cause: unknown) => { if (live) setReadingFailure(cause instanceof Error ? cause.message : String(cause)); });
    };
    read();
    const stop = subscribeTechneSource(source.ref, read);
    return () => { live = false; stop(); };
  }, [source, subjectRef]);

  if (!payload) return <div className="techne-host"><p className="techne-absent">This surface carries no Technē payload — it names no instrument, subject or selection.</p></div>;

  const disclosure = reading?.disclosure ?? null;
  const entries = disclosure?.instruments ?? [];
  const Instrument = instrument ? techneSurface(instrument) : undefined;

  return (
    <div className="techne-host">
      <header className="techne-head">
        <span className="techne-eyebrow">Technē · {instrument ?? "instrument"}</span>
        <code className="techne-subject" title="Subject ref">{subjectRef}</code>
        {session?.selection.selection_standing
          ? <span className="techne-standing" data-standing={session.selection.selection_standing}>selection {session.selection.selection_standing}</span>
          : null}
      </header>
      {!session || session.subject_ref !== payload.subjectRef
        ? <p className="techne-absent">No DisclosureSession is open for this subject. Select a subject to begin disclosing.</p>
        : (
          <>
            {!source && <p className="techne-absent">No Technē source is registered — readings arrive when an owner-provider lane registers one.</p>}
            {source && readingFailure && <p className="techne-absent" role="alert">The Technē source refused this reading: {readingFailure}</p>}
            {disclosure && (
              <nav className="techne-disclosure" aria-label="Instrument disclosure">
                <ul className="techne-instruments">
                  {entries.map((entry) => {
                    const current = entry.instrument === session.instrument;
                    return (
                      <li key={entry.instrument} className="techne-instrument" data-available={entry.available} data-current={current}>
                        {entry.available
                          ? <button type="button" className="techne-open" disabled={current} onClick={() => disclosureSession.openInInstrument(entry.instrument)}>
                              {current ? `${entry.instrument} — current instrument` : `Open in ${entry.instrument}`}
                            </button>
                          : <span className="techne-unavailable" title={entry.reason}>{entry.instrument} unavailable — {entry.reason}</span>}
                      </li>
                    );
                  })}
                </ul>
                {!!disclosure.degraded?.length && (
                  <ul className="techne-notes" aria-label="Degraded instruments">
                    {disclosure.degraded.map((note) => <li key={`${note.instrument}:${note.reason}`}><strong>{note.instrument} degraded</strong> — {note.reason}</li>)}
                  </ul>
                )}
                {!!disclosure.suggestions?.length && (
                  <ul className="techne-notes" aria-label="Suggested disclosures">
                    {disclosure.suggestions.map((note) => <li key={`${note.instrument}:${note.reason}`}><strong>{note.instrument} suggested</strong> — {note.reason}</li>)}
                  </ul>
                )}
              </nav>
            )}
            <section className="techne-pane" aria-label={`${instrument ?? "techne"} instrument`}>
              {Instrument && instrument
                ? <Instrument binding={binding} session={session} selection={session.selection} reading={reading} capabilities={disclosure} />
                : <div className="techne-placeholder">The {instrument ?? "instrument"} instrument is not mounted yet. Its lane registers through the Technē surface registry; the disclosure above stays honest meanwhile.</div>}
            </section>
          </>
        )}
    </div>
  );
}
