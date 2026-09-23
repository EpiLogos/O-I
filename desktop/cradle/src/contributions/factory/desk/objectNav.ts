/** Factory's object pages open IN PLACE with ← back (10-SIDEBARS §4.1a, §4.7;
 * 11-FACTORY §6): a small stack over the Desk / Run page. Opening a run page
 * from the Desk starts a fresh stack; ← back pops one page. */
import {useSyncExternalStore} from "react";
import type {FactoryObjectRef} from "./RunPage";

let stack: FactoryObjectRef[] = [];
const listeners = new Set<() => void>();
const emit = () => { for (const listener of [...listeners]) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const top = () => stack[stack.length - 1];

export function openObjectPage(object: FactoryObjectRef) { stack = [...stack, object]; emit(); }
export function closeObjectPage() { if (!stack.length) return; stack = stack.slice(0, -1); emit(); }
export function clearObjectPages() { if (!stack.length) return; stack = []; emit(); }
export function useObjectPage(): FactoryObjectRef | undefined { return useSyncExternalStore(subscribe, top, top); }
/** What ← back returns to: the page under the top one, if any. */
export function objectUnder(): FactoryObjectRef | undefined { return stack[stack.length - 2]; }
