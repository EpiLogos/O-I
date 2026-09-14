import "./factory.css";
import {FactoryActivityHorizon,FactoryExecutionDetails,type FactoryExecutionReading} from "./FactoryActivityHorizon";
import {useEffect, useRef, useState} from "react";
import type {SurfaceBinding} from "../../surface/types";
import {RetainedRegionSurface} from "../../workspace/RetainedRegionSurface";
import {FactoryDevelopmentSurface} from "./FactoryDevelopmentSurface";
import {useExpressionStage} from "../../stage/ExpressionStage";
import {registerExpressionTarget} from "../../stage/targets";

/** Factory's concrete privileged composition. Its binding foregrounds existing
 * hosts; Factory's developmental reads and the accompanying encounter keep
 * their native owners. K9-specific source/state adapters do not enter here. */
export function FactoryComposition({binding, foreground, onView}: {binding: SurfaceBinding; foreground: boolean; onView:(view:NonNullable<SurfaceBinding["view"]>)=>void}) {
  const [selected,setSelected]=useState<FactoryExecutionReading>();
  const root = useRef<HTMLDivElement>(null);
  const stage = useExpressionStage();
  const stageRef = useRef(stage); stageRef.current = stage;
  useEffect(() => {
    if (!foreground) return;
    const target = `factory-composition:${binding.id}`;
    const releaseTarget = registerExpressionTarget(target, () => root.current?.getBoundingClientRect() ?? null);
    stageRef.current.emit({kind: "surface.opened", target, label: "Factory"});
    stageRef.current.emit({kind: "surface.ready", target, label: "Factory"});
    return () => {
      stageRef.current.emit({kind: "surface.closed", target, label: "Factory"});
      releaseTarget();
    };
  }, [binding.id, foreground]);
  useEffect(() => {
    if (!foreground || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const presentation = stage.present({id: `factory-entry:${binding.id}`, plane: "ambient", recipe: "factory.gather"});
    if (!presentation) return;
    presentation.play("factory.enter");
    const timer = setTimeout(() => presentation.release(), 420);
    return () => { clearTimeout(timer); presentation.release(); };
  }, [binding.id, foreground, stage.present]);
  return <div ref={root} className="factory-composition" data-factory-binding={binding.id}>
    <RetainedRegionSurface target={foreground ? "[data-shell-activity-host]" : undefined}><FactoryActivityHorizon locator={binding.view?.factory} onLocator={factory=>onView({...binding.view,factory})} onSelect={setSelected} enabled={foreground}/></RetainedRegionSurface>
    {foreground && <div className="factory-encounter-host" data-factory-encounter={binding.id}/>}
    <RetainedRegionSurface target={foreground ? "[data-shell-return-host]" : undefined}>
      <section className="factory-return-region" aria-label="Factory returned material">
        <header><strong>Returns</strong><span>Evidence and material</span></header>
        {selected ? <FactoryExecutionDetails reading={selected}/> : <p className="factory-return-empty">Select an execution to see its returned material and evidence.</p>}
        <details className="factory-source-inspection"><summary>Inspect Factory source</summary><FactoryDevelopmentSurface/></details>
      </section>
    </RetainedRegionSurface>
  </div>;
}
