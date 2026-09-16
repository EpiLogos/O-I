/**
 * Techne open requests (L5 Technē integration) — the K9 open-request
 * pattern generalised to the DisclosureSession: a lane or affordance
 * requests that the current session be disclosed as a Technē surface, and
 * the shell's one consumer (workspace/store.ts) opens or re-activates the
 * kind-"techne" binding. Requests carry a session that already exists;
 * nothing here mints subjects or sessions.
 */
import type { DisclosureSession } from "./contract.ts";
import { techneSurfaceBinding } from "./session.ts";

export interface TechneOpenRequest {
  session: DisclosureSession;
  title?: string;
}

const openListeners = new Set<(request: TechneOpenRequest) => void>();

export function requestTechneOpen(session: DisclosureSession, title?: string): void {
  const request: TechneOpenRequest = { session, title };
  for (const listener of openListeners) listener(request);
}

export function subscribeTechneOpen(listener: (request: TechneOpenRequest) => void): () => void {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

export { techneSurfaceBinding };
