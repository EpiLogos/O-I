/** Test-only aperture: actual M0 body and app providers, deliberately without
 * a Wiki subject, QL provider, kernel transport or Agent session. */
import React, {useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
import {KernelProvider} from "../src/kernel/KernelProvider";
import {VisualsProvider} from "../src/visuals/ParticleExpression";
import {ExpressionStageProvider} from "../src/stage/ExpressionStage";
import {ProjectLensBody} from "../src/techne/m0m5/ProjectLens";
import type {TechneDisclosureState} from "../src/techne/techneReading";
import "@epilogos/oi-design-system/tokens.css";

function Probe() {
  const [disclosure, setDisclosure] = useState<TechneDisclosureState>({standing:"no-subject"});
  const [mounted, setMounted] = useState(true);
  const [studioBody, setBody] = useState<React.ReactNode>(null);
  const [tools, setTools] = useState<React.ReactNode>(null);
  const studio = useMemo(() => ({setBody, setTools}), []);
  (window as any).entryTest = {setDisclosure, setMounted};
  return <><main style={{height:600}}>{mounted && <ProjectLensBody
    binding={{id:"techne:entry-proof",kind:"techne",title:"Technē"}}
    disclosure={disclosure} sceneId="entry-proof" studio={studio}/>}</main>
    <aside aria-label="Actual Lens Studio">{tools}{studioBody}</aside></>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode>
  <KernelProvider><VisualsProvider><ExpressionStageProvider><Probe/>
  </ExpressionStageProvider></VisualsProvider></KernelProvider>
</React.StrictMode>);
