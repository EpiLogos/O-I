import {lazy} from "react";
import type {HostedMountProps} from "../contracts";

const FactoryCentre = lazy(() => import("./FactoryCentre").then(module => ({default: module.FactoryCentre})));

/** Host-owned wiring over the native Factory contribution. All actions still
 * enter the existing owner seams; the descriptor supplies no authority. */
export function FactoryHostedSurface({factoryCentre, factoryTasks}: HostedMountProps) {
  return <FactoryCentre chat={factoryCentre} project={factoryTasks?.project} accompanying={factoryTasks?.accompanying} onOpenTask={factoryTasks?.onOpenTask} onNewTask={factoryTasks?.onNewTask} onOpenActivity={factoryTasks?.onOpenActivity} onMessage={factoryTasks?.onMessage}/>;
}
