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
 */
import {useState} from "react";
import {PointCloudHost} from "../expressions/PointCloudHost";
import {TechneSurfaceHost} from "./TechneSurfaceHost";
import type {SurfaceBinding} from "../surface/types";
import type {HostedAppState} from "../expressions/hostedApp";
import type {TechneSubject} from "./techneReading";

export function TechneCentre({binding, subject, deepLink, onHostedState}: {
  binding: SurfaceBinding;
  subject?: TechneSubject;
  deepLink?: string;
  onHostedState?: (state: HostedAppState) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <div className="techne-centre">
      <div className="techne-centre-field" style={collapsed ? undefined : {display: "none"}}>
        <PointCloudHost mode="techne" bindingId={binding.id} deepLink={deepLink} onHostedState={onHostedState}/>
      </div>
      <TechneSurfaceHost binding={binding} subject={subject} collapsed={collapsed} onCollapsedChange={setCollapsed}/>
    </div>
  );
}
