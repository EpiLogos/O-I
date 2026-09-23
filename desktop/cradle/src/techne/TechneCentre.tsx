/**
 * The Technē centre (parent integration, 2026-09-22): the Expressions app's
 * Technē field and the deep-instrument HUD, composed as ONE centre body with
 * ONE active renderer.
 *
 * The field (`PointCloudHost` → field-studies-journeys) is the one physics
 * renderer. It stands visible and running while the HUD is collapsed — the
 * default, so entering Technē mode preserves the field exactly as before, and
 * a Wiki summon still opens its Expression in the live field. Opening the
 * deep-instrument HUD SUSPENDS the field with `display:none` — the same hide
 * the stage visibility flip uses on a mode cross, which pauses the iframe's
 * render loop — so no heavy renderer runs hidden behind the HUD (the
 * dual-reading suspend law, §16/§22: only the active visual surface allocates).
 * Collapsing the HUD reveals and resumes the field.
 *
 * The application's own Lens Studio chooser reaches the same HUD through the
 * host channel (owner direction 2026-09-23): a chooser press inside the
 * application summons the deep instruments, and this centre answers by
 * opening its HUD on that lens — the one registered lens set, the one
 * DisclosureSession, the same suspend handoff as the rail. One press, the
 * instrument opens over the field; collapsing returns to the field with the
 * application's chooser exactly where it stood.
 */
import {useCallback, useState} from "react";
import {PointCloudHost} from "../expressions/PointCloudHost";
import {TechneSurfaceHost} from "./TechneSurfaceHost";
import type {SurfaceBinding} from "../surface/types";
import type {HostedAppState} from "../expressions/hostedApp";
import type {TechneInstrumentId, TechneSubject} from "./techneReading";

export function TechneCentre({binding, subject, deepLink, onHostedState}: {
  binding: SurfaceBinding;
  subject?: TechneSubject;
  deepLink?: string;
  onHostedState?: (state: HostedAppState) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [summon, setSummon] = useState<{instrument: TechneInstrumentId; nonce: number} | null>(null);
  const summonLens = useCallback((instrument: TechneInstrumentId) => {
    setCollapsed(false);
    setSummon(previous => ({instrument, nonce: (previous?.nonce ?? 0) + 1}));
  }, []);
  return (
    <div className="techne-centre">
      <div className="techne-centre-field" style={collapsed ? undefined : {display: "none"}}>
        <PointCloudHost mode="techne" bindingId={binding.id} deepLink={deepLink} onHostedState={onHostedState} onLensSummon={summonLens}/>
      </div>
      <TechneSurfaceHost binding={binding} subject={subject} collapsed={collapsed} onCollapsedChange={setCollapsed} summon={summon}/>
    </div>
  );
}
