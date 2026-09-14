import {useEffect, useRef} from "react";
import type {SurfaceBinding} from "../../surface/types";
import {RetainedRegionSurface} from "../../workspace/RetainedRegionSurface";
import {FactoryDevelopmentSurface} from "./FactoryDevelopmentSurface";
import {useExpressionStage} from "../../stage/ExpressionStage";
import {registerExpressionTarget} from "../../stage/targets";

/** Factory's concrete privileged composition. Its binding foregrounds existing
 * hosts; Factory's developmental reads and the accompanying encounter keep
 * their native owners. K9-specific source/state adapters do not enter here. */
export function FactoryComposition({binding, foreground}: {binding: SurfaceBinding; foreground: boolean}) {
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
    <header className="factory-composition-heading"><strong>Factory</strong><span>Developmental work</span></header>
    {foreground && <div className="factory-encounter-host" data-factory-encounter={binding.id}/>}
    <RetainedRegionSurface target={foreground ? "[data-shell-return-host]" : undefined}>
      <FactoryDevelopmentSurface/>
    </RetainedRegionSurface>
  </div>;
}
