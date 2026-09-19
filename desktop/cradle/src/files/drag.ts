/**
 * The desktop's drag payload types, in one place so a file row in the World
 * navigator, a Material row in Technè and a Workbench tab all speak the same
 * grammar to any drop target (the agent chat's composer, the Technè scene).
 *
 *   application/x-oi-location   a JSON `CentralLocation` (techne/material.ts
 *                               declares the same string for its own rows)
 *   application/x-oi-surface    a Workbench surface id (surface/Workbench.tsx)
 */
export const LOCATION_DRAG_TYPE = "application/x-oi-location";
export const SURFACE_DRAG_TYPE = "application/x-oi-surface";
