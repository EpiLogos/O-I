import {useSyncExternalStore} from "react";

/** THE ONE SCOPE (10-SIDEBARS §3.6, ruling D6): what you are working on —
 * Central (the root; valid without a child project), one Work project, or, in
 * Factory only, All projects (which only the Desk honours).
 *
 * The scope is chosen in exactly one place: the scope menu at the top of the
 * left sidebar. Everything else READS it — the left body, the Desk, where a
 * new chat or document is created, the right panel's agents and context, the
 * new-tab form picker, Technè's first wiki, project-scoped settings.
 *
 * The workspace remains its owner (a workspace restores its arrangement and
 * its scope together): the frame binds `bindScopeWriter` to the workspace and
 * publishes the effective scope with `publishScope`. Surfaces never write the
 * workspace directly, and focusing a tab never changes the scope. */
export type Scope =
  | {kind: "central"}
  | {kind: "project"; project: string}
  | {kind: "all"};

export const CENTRAL_SCOPE: Scope = Object.freeze({kind: "central"});

let current: Scope = CENTRAL_SCOPE;
let writer: ((scope: Scope) => void) | null = null;
const listeners = new Set<() => void>();

export function sameScope(a: Scope, b: Scope): boolean {
  return a.kind === b.kind && (a.kind !== "project" || (b.kind === "project" && a.project === b.project));
}

/** The project a scope names, or undefined for Central and All projects. */
export function scopeProject(scope: Scope): string | undefined {
  return scope.kind === "project" ? scope.project : undefined;
}

/** Plain words for the scope ("Central", "O-I", "All projects"). */
export function scopeLabel(scope: Scope): string {
  return scope.kind === "project" ? scope.project : scope.kind === "all" ? "All projects" : "Central";
}

/** The workspace's stored project → the scope it means. */
export function scopeFromWorkspace(project: string | undefined, allProjects?: boolean): Scope {
  if (allProjects) return {kind: "all"};
  return project ? {kind: "project", project} : CENTRAL_SCOPE;
}

export function readScope(): Scope {
  return current;
}

/** The frame publishes the effective scope (from the active workspace). */
export function publishScope(next: Scope): void {
  if (sameScope(current, next)) return;
  current = next;
  for (const listener of [...listeners]) listener();
}

/** The frame binds the one writer (the workspace). Returns an unbind. */
export function bindScopeWriter(next: (scope: Scope) => void): () => void {
  writer = next;
  return () => {
    if (writer === next) writer = null;
  };
}

/** The scope menu's only verb. Without a bound writer (tests, detached
 * previews) it publishes directly so the choice is still observable. */
export function chooseScope(next: Scope): void {
  if (writer) writer(next);
  else publishScope(next);
}

export function subscribeScope(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useScope(): Scope {
  return useSyncExternalStore(subscribeScope, readScope, readScope);
}
