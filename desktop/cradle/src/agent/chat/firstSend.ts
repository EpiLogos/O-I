/**
 * The fresh chat's project scope (owner commission 2026-09-20: the chat face
 * is usable by default — a new chat is ready to send with no chooser and no
 * gating, and old conversations are chosen from the sidebar only).
 *
 * A new chat provisions into the project the face stands in; with none bound
 * (no project selected in the sidebar, no conversation carried) it defaults
 * to Central — the meta-project every cradle session stands in. The default
 * is a placement choice the owner made, not a guess: provisioning asks the
 * owner's own project-context reading for the canonical ProjectRef spelling.
 */
export const chatProvisionTarget=(project?:string):string=>{
  const trimmed=project?.trim();
  // The native encounter seam uses an empty scope for Central root. The
  // display label "Central" must never be sent as a child-project name.
  return trimmed ?? "";
};
