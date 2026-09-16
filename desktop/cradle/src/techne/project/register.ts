/**
 * M0′ Project instrument registration (L5 Technē, amended geometry).
 * Composition only; capability stays with the reading's disclosure. The
 * integration composition root calls `registerProjectSurface()` once.
 */
import { registerTechneSurface } from "../registry";
import { ProjectGround } from "./ProjectGround";

export function registerProjectSurface(): () => void {
  return registerTechneSurface("project", ProjectGround);
}
