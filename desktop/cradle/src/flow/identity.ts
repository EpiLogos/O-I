import {useSyncExternalStore} from "react";
import type {QlDocParticipant} from "./instance";
/** The person's declared writing identity for documents: the initial their
 * entries carry and the name it stands for. F/H were Frank and Hermes — the
 * two voices the 0/1 form was first drawn between — so F remains the
 * default, and the initial is settable because it names the person, not the
 * form. Agent initials are never configured here: they are declared from
 * the live agent that actually answered. */
const KEY = "oi-writing-identity.v1";
export interface WritingIdentity {initial: string;name?: string}
const listeners = new Set<() => void>();
let identity: WritingIdentity = {initial: "F"};
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof (parsed as {initial?: unknown}).initial === "string"
      && /^[A-Z]$/.test((parsed as {initial: string}).initial)) {
      identity = {initial: (parsed as {initial: string}).initial, ...(typeof (parsed as {name?: unknown}).name === "string" && (parsed as {name: string}).name.trim() ? {name: (parsed as {name: string}).name.trim()} : {})};
    }
  }
} catch {/* Missing or malformed preferences leave the received convention. */}
export function writingIdentity(): WritingIdentity {return identity;}
export function setWritingIdentity(next: WritingIdentity): void {
  const initial = next.initial.toUpperCase();
  if (!/^[A-Z]$/.test(initial)) throw new Error("A writing initial is one letter A-Z");
  identity = {initial, ...(next.name?.trim() ? {name: next.name.trim()} : {})};
  try {localStorage.setItem(KEY, JSON.stringify(identity));} catch {/* In-window identity still applies. */}
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void): (() => void) => {listeners.add(listener); return () => {listeners.delete(listener);};};
export function useWritingIdentity(): [WritingIdentity, (next: WritingIdentity) => void] {
  const value = useSyncExternalStore(subscribe, writingIdentity);
  return [value, setWritingIdentity];
}
/** The person's declared participant for a new document's meta. */
export function personParticipant(): QlDocParticipant {
  const {initial, name} = writingIdentity();
  return {initial, kind: "person", ...(name ? {name} : {})};
}
