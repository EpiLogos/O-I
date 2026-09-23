/** Factory's object pages open IN PLACE with ← back (10-SIDEBARS §4.1a, §4.7;
 * 11-FACTORY §6): a small stack of registry ObjectRefs over the Desk / Run
 * page. Opening a run page starts a fresh stack; ← back pops one page. The
 * page itself is the shared ObjectPage (src/agent/objects). */
import {useSyncExternalStore} from "react";
import type {ObjectRef} from "../../../agent/objects/registry";

let stack: ObjectRef[] = [];
const listeners = new Set<() => void>();
const emit = () => { for (const listener of [...listeners]) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const top = () => stack[stack.length - 1];
const same = (a: ObjectRef | undefined, b: ObjectRef) => !!a && a.kind === b.kind && a.ref === b.ref && (a.project ?? "") === (b.project ?? "");

export function openObjectPage(object: ObjectRef) { if (same(top(), object)) return; stack = [...stack, object]; emit(); }
export function closeObjectPage() { if (!stack.length) return; stack = stack.slice(0, -1); emit(); }
export function clearObjectPages() { if (!stack.length) return; stack = []; emit(); }
export function useObjectPage(): ObjectRef | undefined { return useSyncExternalStore(subscribe, top, top); }
/** What ← back returns to: the page under the top one, if any. */
export function objectUnder(): ObjectRef | undefined { return stack[stack.length - 2]; }
