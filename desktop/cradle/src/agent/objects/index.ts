/** Object pages (10-SIDEBARS §4.7). Importing this module registers the
 *  right panel's own kinds; see ./registry.ts for the API lane 3 reuses. */
import "./kinds";
export * from "./registry";
export {ObjectPage} from "./ObjectPage";
export {ObjectSurface} from "./ObjectSurface";
export {tapeEventObject} from "./kinds";
export {ObjectCentreLayer} from "./ObjectCentreLayer";
