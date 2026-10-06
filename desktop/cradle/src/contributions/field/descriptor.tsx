import {lazy} from "react";
import type {HostedMountProps} from "../contracts";

const FieldSurface = lazy(() => import("../../field/FieldSurface").then(module => ({default: module.FieldSurface})));

/** Base's default centre: the graph–pages–Expressions field. The surface reads a FieldSource adapter and holds one
 * FieldEncounter (persisted as the binding's `view.field`); it carries no product or corpus semantics of its own. */
export function FieldHostedSurface({binding, onView}: HostedMountProps) { return <FieldSurface binding={binding} onView={onView}/>; }
