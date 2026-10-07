import {lazy} from "react";
import type {HostedMountProps} from "../contracts";

const FactoryCentre = lazy(() => import("./FactoryCentre").then(module => ({default: module.FactoryCentre})));

/** Host-owned wiring over the native Factory contribution. All actions still
 * enter the existing owner seams; the descriptor supplies no authority. */
export function FactoryHostedSurface({conversation, host}: HostedMountProps) {
  return <FactoryCentre chat={conversation} project={host?.project} accompanying={host?.accompanying} onOpenTask={host?.openEncounter} onNewTask={host?.newEncounter} onOpenActivity={host?.openActivity} onMessage={host?.onMessage}/>;
}
