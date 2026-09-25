import {lazy} from "react";
import type {HostedMountProps} from "../contracts";

const PointCloudHost = lazy(() => import("../../expressions/PointCloudHost").then(module => ({default: module.PointCloudHost})));
const TechneCentre = lazy(() => import("../../techne/TechneCentre").then(module => ({default: module.TechneCentre})));
const EpiLogosSurface = lazy(() => import("../../epilogos/EpiLogosSurface").then(module => ({default: module.EpiLogosSurface})));
const SystemPanel = lazy(() => import("../../workspace/SystemPanel").then(module => ({default: module.SystemPanel})));

export function ExpressionsHostedSurface({binding, onHostedState}: HostedMountProps) {
  return <PointCloudHost mode="expressions" bindingId={binding.id} deepLink={binding.engine?.expressionRef} onHostedState={onHostedState}/>;
}
export function TechneHostedSurface({binding, subject, onHostedState}: HostedMountProps) {
  return <TechneCentre binding={binding} subject={subject} deepLink={binding.engine?.expressionRef} onHostedState={onHostedState}/>;
}
export function EpiLogosHostedSurface({binding}: HostedMountProps) { return <EpiLogosSurface binding={binding}/>; }
export function SystemHostedSurface({binding}: HostedMountProps) { return <SystemPanel binding={binding}/>; }
