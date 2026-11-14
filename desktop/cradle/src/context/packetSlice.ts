/**
 * The Packet as the World Model holds it (O-I ticket 1005; docs/architecture/world-shell.md §9.2; #1001: no device reads an owner at
 * the point of use): AIKit's prepared context of each register a conversation can stand in — your world's root register and each project
 * the World Model knows — and of each of their conversations (kernel world_model.rs `packet`). Every surface that shows or edits a packet
 * reads it here: a view holds the slice (`usePacket`), and the read before an edit or a Send is the slice read fresh (`packetNow`;
 * owners/model.ts `fresh`, past every reading the kernel holds). AIKit's context edit stays the owner's own write (nativeContext.ts). A
 * hosted world's packet is that world's, which no slice of this World Model holds: it is read from its host, here alone.
 */
import {useEffect, useMemo, useState} from "react";
import {modelSlice, partOf, projectPartOf, sliceValue, useModelSlice} from "../../../../packages/live-shell/ui/src/owners/model";
import type {ModelSliceReading} from "../../../../packages/live-shell/ui/src/owners/model";
import type {KernelTransportStatus} from "../kernel/types";
import {announceContext, assertPreparedContext, contextExpectation, nativeContext, PREPARED_CONTEXT_CHANGED, runContextProviders, validatePreparedItem} from "./nativeContext";
import type {ContextExpectation, PreparedContext} from "./nativeContext";
import {newerContext} from "./scopeGuard";

const message = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/** Why the World Model holds no packet of a conversation in a project's register: the project was not among those it knew (its worlds
 * slice's root) when the packet was read. */
export const PROJECT_PACKET = (project: string): string => `The World Model holds the packets of your world's root register and of each project it knows (AIKit's prepared context, world_model.rs \`packet\`); ${project} was not among them when the packet was read.`;

/** One register's packets as the packet slice holds them (world_model.rs `packet`): its own, and each of its sessions'. */
type RegisterPackets = {register?: unknown; sessions?: Record<string, unknown>};

/** A packet as a surface reads it: AIKit's prepared context, or why there is none, in the owner's words. */
export type PacketReading = {readonly context?: PreparedContext; readonly error?: string};

/** The packet the agent will read, from the World Model's packet slice: AIKit's prepared context of the conversation's session, or of its
 * register while no conversation stands — your world's root register (no project), or the project's it stands in; or why there is none,
 * in the owner's words. Null while the slice has not answered. Pure. */
export function packetFromModel(packet: ModelSliceReading, conversation: {readonly session: string | null; readonly project?: string | null}): PacketReading | null {
  if (packet.state === "reading") return null;
  const {session} = conversation, project = conversation.project || null;
  const held = sliceValue<RegisterPackets & {projects?: unknown}>(packet);
  if (!held.ok) return {error: held.reason};
  const register = project === null ? {ok: true as const, value: held.value} : projectPartOf<RegisterPackets>(held.value, project, PROJECT_PACKET);
  if (!register.ok) return {error: register.why};
  const read = partOf(session ? register.value.sessions?.[session] : register.value.register);
  if (!read) return {error: session ? `The World Model's packet holds no prepared context of ${session} yet: AIKit's agency had not listed it when the packet was read.` : `The World Model's packet holds no prepared context of ${project === null ? "your world's root register" : `${project}'s register`}.`};
  if (!read.ok) return {error: read.why};
  try {
    assertPreparedContext(read.value, session ?? undefined);
    return {context: read.value};
  } catch (cause) {
    return {error: message(cause)};
  }
}

/** The packet as its owner holds it now: the World Model's packet slice read fresh, past every reading the kernel holds — the read before
 * an edit or a Send — or, for a hosted world's conversation, that world's own from its host. Throws why there is none, in its words. */
export async function packetNow(transport: KernelTransportStatus, project: string, session: string | undefined, sourceWorldRef?: string): Promise<PreparedContext> {
  if (sourceWorldRef) return nativeContext(transport, project, session, {operation: "read"}, sourceWorldRef);
  const reading = packetFromModel(await modelSlice(transport, "packet", {fresh: true}), {session: session ?? null, project});
  if (!reading?.context) throw new Error(reading?.error ?? "The World Model has not answered yet.");
  return reading.context;
}

/** Read the packet again now — the person's Refresh, or after a write its readers do not hear of (a Send that took it): the World Model's
 * slice read fresh, which every view holding it hears; a hosted world's from its host, announced to the views that show it. */
export async function refreshPacket(transport: KernelTransportStatus, project: string, session: string | undefined, sourceWorldRef?: string): Promise<void> {
  if (sourceWorldRef) {
    announceContext(project, await packetNow(transport, project, session, sourceWorldRef), sourceWorldRef);
    return;
  }
  const reading = await modelSlice(transport, "packet", {fresh: true});
  if (reading.state === "unavailable") throw new Error(reading.reason);
}

/** The context a Send carries, reviewed: the providers that bring it up to date run first (nativeContext.ts registerContextProvider), then
 * the packet is read now (`packetNow`) and each of its items checked current, or taken as the captured snapshot the person approved. */
export async function reviewedContext(transport: KernelTransportStatus, project: string, session: string, sourceWorldRef?: string): Promise<ContextExpectation> {
  await runContextProviders({transport, project, session, sourceWorldRef});
  const value = await packetNow(transport, project, session, sourceWorldRef);
  for (const item of value.items) await validatePreparedItem(item, value, sourceWorldRef);
  return contextExpectation(value);
}

/** The packet a view shows of a conversation — its session's, or its register's while none stands (`session` undefined) — as the World
 * Model holds it: held by the view, and asked again on each newer `model_changed`. An edit's answer a surface announced (announceContext)
 * stands over it until the slice holds as new a revision. A hosted world's is read from its host when the view opens, and moves by its
 * announcements. Null with no project chosen. */
export function usePacket(transport: KernelTransportStatus, project: string | undefined, session: string | undefined, sourceWorldRef?: string): PacketReading | null {
  const slice = useModelSlice(sourceWorldRef ? null : transport, "packet");
  const key = JSON.stringify([sourceWorldRef ?? null, project ?? null, session ?? null]);
  const [heard, setHeard] = useState<{key: string; context: PreparedContext} | null>(null);
  const [hosted, setHosted] = useState<{key: string; reading: PacketReading} | null>(null);
  useEffect(() => {
    if (project === undefined) return;
    let active = true;
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{project: string; value: PreparedContext; sourceWorldRef?: string}>).detail;
      if (!detail?.value || detail.project !== project || detail.sourceWorldRef !== sourceWorldRef || detail.value.scope.agent_session !== (session ?? null)) return;
      setHeard(previous => ({key, context: previous?.key === key ? newerContext(previous.context, detail.value) : detail.value}));
    };
    window.addEventListener(PREPARED_CONTEXT_CHANGED, changed);
    if (sourceWorldRef) {
      void packetNow(transport, project, session, sourceWorldRef).then(
        context => { if (active) setHosted({key, reading: {context}}); },
        cause => { if (active) setHosted({key, reading: {error: message(cause)}}); });
    }
    return () => { active = false; window.removeEventListener(PREPARED_CONTEXT_CHANGED, changed); };
  }, [transport, project, session, sourceWorldRef, key]);
  return useMemo(() => {
    if (project === undefined) return null;
    const held = sourceWorldRef ? (hosted?.key === key ? hosted.reading : null) : packetFromModel(slice, {session: session ?? null, project});
    const announced = heard?.key === key ? heard.context : undefined;
    if (!announced) return held;
    if (!held?.context) return {context: announced};
    const newer = newerContext(announced, held.context);
    return newer === held.context ? held : {context: newer};
  }, [slice, heard, hosted, key, project, session, sourceWorldRef]);
}
