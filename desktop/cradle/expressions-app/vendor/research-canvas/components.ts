/// <reference types="vite/client" />
/** O:I host exports. Implementations are Research Canvas sources; explicit capability patch is recorded in PROVENANCE.json. */
export {CanvasView} from "./packages/canvas/src/CanvasView";
export {TimelineSurface, type TimelineSurfaceProps} from "./packages/canvas/src/timeline/TimelineSurface";
export type {TimelineDataSource} from "./packages/canvas/src/timeline/TimelineLens";
export type {TimelineRepository, TimelineViewState} from "./packages/desktop-api/src/index";
export {bundleFromTechneReadings, techneCanvasId, TECHNE_WORKSPACE_ID} from "./packages/desktop-api/src/techneBundle";
export {createTechneTransport} from "./packages/desktop-api/src/techneTransport";
export type {TechneFieldBundle, TechneReadingLite} from "./packages/desktop-api/src/techneBundle";
