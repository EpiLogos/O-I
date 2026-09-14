import {useEffect, useRef} from "react";
import type {SurfaceBinding} from "../../surface/types";
import {useExpressionStage} from "../../stage/ExpressionStage";
import {registerExpressionTarget} from "../../stage/targets";
import {FactoryRunsSurface, type FactoryLocator} from "./FactoryRunsSurface";
import "./factory.css";
import type {WorkingSurfaceSelection} from "../../encounter/working-surface";

/** Factory's concrete privileged composition. Its binding foregrounds existing
 * hosts; Factory's developmental reads retain their native owner. */
export function FactoryComposition({binding, foreground, onView, onOpenWorkingSurface, onOpenBinding}: {onOpenBinding:(binding:SurfaceBinding)=>Promise<void>; binding: SurfaceBinding; foreground: boolean; onView:(view:NonNullable<SurfaceBinding["view"]>)=>void; onOpenWorkingSurface:(selection:WorkingSurfaceSelection)=>Promise<void>}) {
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
  const updateLocator = (factory: FactoryLocator) => onView({...binding.view, factory});
  return <div ref={root} className="factory-composition" data-factory-binding={binding.id}>
    <FactoryRunsSurface onOpenHandoff={async(statePath,runRef)=>onOpenBinding({id:crypto.randomUUID(),kind:"factory-handoff",title:"Run handoff",project:binding.project,ref:runRef,view:{factory:{statePath,runRef}}})} locator={binding.view?.factory} boundProjectRef={binding.ref} project={binding.project} onOpenWorkingSurface={onOpenWorkingSurface} onLocator={updateLocator}/>
  </div>;
}
