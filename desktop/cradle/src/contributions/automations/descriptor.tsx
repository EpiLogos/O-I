import {lazy} from "react";
import type {HostedMountProps} from "../contracts";
const Automations = lazy(() => import("./Automations").then(module => ({default: module.Automations})));
export function AutomationsHostedSurface({binding}: HostedMountProps) {
  return <Automations project={binding.project}/>;
}
