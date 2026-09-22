/**
 * The Technē HUD (parent integration, 2026-09-22) — the ONE surface through
 * which the six existing M0′–M5′ instruments (registered via lensMount.ts by
 * instrumentLenses.ts) become AVAILABLE in the live app's Technē mode. It is
 * mounted over the Expressions app's Technē centre (PointCloudHost →
 * field-studies-journeys) by TechneCentre.tsx, and it is NOT a second
 * renderer: the iframe is the one physics field; these instruments are the
 * deep 4:2 read-model apertures (SVG/DOM) over the SAME live reading.
 *
 * One reading: the wiki-grounded provider (wikiReadingProvider.ts) is
 * registered here so useTechneDisclosure resolves the register's real
 * ql.techne/v1 reading (whole, temporal, spatial — the M4′ place facets the
 * producer now emits, expressions, actions). One chooser: every lens is shown
 * with its honest availability from the reading's own disclosure; selecting a
 * lens mounts its body (m0m5/LensBody.tsx) over the same DisclosureSession.
 * Availability is the reading's disclosure, never what happens to be mounted.
 */
import {useEffect, useMemo, useState, useSyncExternalStore, type ReactNode} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {Glyph} from "../workspace/Glyph";
import type {SurfaceBinding} from "../surface/types";
import "./instrumentLenses"; // side effect: registers the six M′ lenses
import {subscribeTechneLenses, techneLenses, type TechneLensStudio} from "./lensMount";
import {registerTechneReadingProvider, techneReadingProvider, useTechneDisclosure, type TechneInstrumentId, type TechneSubject} from "./techneReading";
import {useTechneGroundSubject, wikiTechneReadingProvider} from "./wikiReadingProvider";
import {disclosureSession} from "./session";
import type {KernelTransportStatus} from "../kernel/types";
import "./techneHud.css";

const subscribeSession = (listener: () => void) => disclosureSession.subscribe(listener);

/** Register the wiki-grounded reading provider once for the app: the HUD may
 * mount more than once (warm trees, a second pane), but exactly one provider
 * of this ref may stand. First mount binds it; it is never double-registered
 * and never torn down under another live host. */
let providerBound = false;
function ensureWikiProvider(transport: KernelTransportStatus): void {
  if (providerBound || techneReadingProvider()) { providerBound = true; return; }
  // Bind only on a SUCCESSFUL registration: a throw here means another host
  // won the race (one provider of this ref stands), and techneReadingProvider()
  // short-circuits the next call — a real registration failure is not masked.
  try { registerTechneReadingProvider(wikiTechneReadingProvider(transport)); providerBound = true; }
  catch { /* another host bound it between the check and here — one provider stands */ }
}

export function TechneSurfaceHost({binding, subject, collapsed, onCollapsedChange}: {binding: SurfaceBinding; subject?: TechneSubject; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void}) {
  const kernel = useKernel();
  useEffect(() => { ensureWikiProvider(kernel.transport); }, [kernel.transport]);

  const lenses = useSyncExternalStore(subscribeTechneLenses, techneLenses);
  const groundSubject = useTechneGroundSubject(subject);
  const disclosure = useTechneDisclosure(groundSubject);

  // The active lens follows the ONE DisclosureSession's instrument, so the
  // chooser, an instrument's own cross-open (openInInstrument) and Epii — which
  // reads the session, not the HUD — all agree on which instrument is live
  // (§4 cross-instrument transition, §17 one co-referencing session). A local
  // fallback stands only until the first lens mounts a session.
  const session = useSyncExternalStore(subscribeSession, disclosureSession.get);
  const [fallback, setFallback] = useState<TechneInstrumentId>("project");
  const active = session?.instrument ?? fallback;
  const choose = (instrument: TechneInstrumentId) => {
    if (disclosureSession.get()) {
      try { disclosureSession.openInInstrument(instrument); } catch { setFallback(instrument); }
    } else {
      setFallback(instrument);
    }
  };

  // The floating Studio slot the active lens parks its controls into.
  const [studioBody, setStudioBody] = useState<ReactNode>(null);
  const [studioTools, setStudioTools] = useState<ReactNode>(null);
  const studio: TechneLensStudio = useMemo(() => ({setBody: setStudioBody, setTools: setStudioTools}), []);

  const activeLens = lenses.find(lens => lens.instrument === active) ?? lenses[0];
  const Body = activeLens?.Body;
  const sceneId = binding.engine?.expressionRef ?? binding.id;

  if (collapsed) {
    return (
      <div className="techne-hud techne-hud--collapsed">
        <button type="button" className="techne-hud-reveal" onClick={() => onCollapsedChange(false)} title="Show the Technē instruments">
          <Glyph name={activeLens?.glyph ?? "material"}/> Technē
        </button>
      </div>
    );
  }

  return (
    <div className="techne-hud" role="group" aria-label="Technē instruments">
      <nav className="techne-hud-chooser" aria-label="Instrument chooser">
        {lenses.map(lens => {
          const standing = lens.standing(disclosure);
          const current = lens.instrument === active;
          return (
            <button
              key={lens.instrument}
              type="button"
              className="techne-hud-lens"
              data-current={current}
              data-available={standing.available}
              aria-pressed={current}
              title={standing.available ? `${lens.label} · M${lens.mPrime}′` : `${lens.label} — ${standing.reason}`}
              onClick={() => choose(lens.instrument)}
            >
              <Glyph name={lens.glyph}/>
              <span className="techne-hud-lens-label">{lens.label}</span>
              {!standing.available && <span className="techne-hud-lens-off" aria-hidden="true">·</span>}
            </button>
          );
        })}
        <button type="button" className="techne-hud-collapse" onClick={() => onCollapsedChange(true)} title="Hide the instruments and return to the field">–</button>
      </nav>
      {studioTools && <div className="techne-hud-tools">{studioTools}</div>}
      <section className="techne-hud-pane" aria-label={`${activeLens?.label ?? "instrument"} instrument`}>
        {Body
          ? <Body binding={binding} subject={groundSubject} disclosure={disclosure} sceneId={sceneId} studio={studio}/>
          : <p className="techne-hud-empty">No Technē instruments are registered.</p>}
      </section>
      {studioBody && <aside className="techne-hud-studio" aria-label="Lens Studio">{studioBody}</aside>}
    </div>
  );
}
