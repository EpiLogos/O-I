/**
 * Reusable character material through its native owners.
 *
 *   listCharacters     world op `material_list {kind:"character"}` (contract
 *                      EXPRESSION-ACT-MATERIAL-V1 §1 "Discovery") through the
 *                      shared `materialList` helper of `src/expression/world.ts`.
 *   readCharacter      Central `file_resolve` + `file_read` of the material
 *                      document (refs only; nothing cached or copied here).
 *   openCharacterInExpressions
 *                      open the material file as its native Expression
 *                      (`open_file`, which admits the `reuse` block) and enter
 *                      Expressions mode on it (`oi:epi-open-expression`, the
 *                      composition root's cross-mode open route).
 */
import {useEffect, useState} from "react";
import {kernelOp} from "../../kernel/bridge";
import type {CentralLocation, KernelTransportStatus} from "../../kernel/types";
import {materialList, type MaterialListing, type MaterialListResult} from "../../expression/world";
import {readFile, resolveFileLocation} from "../../files/client";
import {readExpressionFile} from "../../knowledge/constructionProjection";
import {asCharacterDocument, type CharacterDocument, type CharacterListing} from "./characterModel";

/** One owner row → the creator's character choice. */
export function characterFromListing(row: MaterialListing): CharacterListing {
  return {
    file_ref: row.file_ref, revision: row.revision, title: row.title,
    states: Object.keys(row.states ?? {}), gestures: Object.keys(row.gestures ?? {}),
    preview_state: row.preview_state ?? null, location: row.location, expression_ref: row.expression_ref,
  };
}

/** Character rows of a `material_list` result; other kinds are left out. */
export function charactersOf(result: MaterialListResult): CharacterListing[] {
  if (result?.state !== "materials" || !Array.isArray(result.materials)) throw new Error("The material register returned no material listing.");
  return result.materials.filter(row => row.kind === "character" && !!row.file_ref).map(characterFromListing);
}

export async function listCharacters(transport: KernelTransportStatus): Promise<CharacterListing[]> {
  return charactersOf(await materialList(transport, {kind: "character"}));
}

export async function readCharacter(transport: KernelTransportStatus, fileRef: string): Promise<{document: CharacterDocument; revision: string}> {
  const reading = await readFile(transport, await resolveFileLocation(transport, fileRef));
  const parsed = await readExpressionFile(transport, reading);
  return {document: asCharacterDocument(parsed), revision: reading.revision};
}

export const OPEN_EXPRESSION_EVENT = "oi:epi-open-expression";

/** Open the character's material file as its native Expression and move the
 * workspace into Expressions mode on it, where the ordinary controls edit it. */
export async function openCharacterInExpressions(transport: KernelTransportStatus, fileRef: string, known?: CentralLocation): Promise<string> {
  // The listing already names the owner's location; otherwise resolve the ref.
  const location = known && known.ref === fileRef ? known : await resolveFileLocation(transport, fileRef);
  const reading = await readFile(transport, location);
  const reply = await kernelOp(transport, {op: "expression", request: {operation: "open_file", location, expected_file_revision: reading.revision, actor: "human:agent-creator"}});
  if (reply.error || reply.outcome?.result !== "expression") throw new Error(reply.error ?? "The Expression owner did not open the character material.");
  if (reply.outcome.data.state !== 'ready' || reply.outcome.data.file?.revision !== reading.revision || reply.outcome.data.file?.location.ref !== location.ref) throw new Error('The character material changed before opening. Read its current source and try again.');
  const expressionRef = reply.outcome.data.document?.expression_ref;
  if (!expressionRef) throw new Error(`The Expression owner opened ${fileRef} without an Expression identity (state ${String(reply.outcome.data.state)}).`);
  window.dispatchEvent(new CustomEvent(OPEN_EXPRESSION_EVENT, {detail: {expressionRef}}));
  return expressionRef;
}

export interface CharacterReading {state: "none" | "reading" | "ready" | "error"; document?: CharacterDocument; revision?: string; error?: string}

/** Read one character document for preview; `null` ref reads nothing. */
export function useCharacterDocument(transport: KernelTransportStatus, fileRef: string | null | undefined): CharacterReading {
  const [reading, setReading] = useState<CharacterReading>({state: fileRef ? "reading" : "none"});
  useEffect(() => {
    if (!fileRef) { setReading({state: "none"}); return; }
    let live = true;
    setReading({state: "reading"});
    readCharacter(transport, fileRef).then(
      value => { if (live) setReading({state: "ready", ...value}); },
      error => { if (live) setReading({state: "error", error: error instanceof Error ? error.message : String(error)}); });
    return () => { live = false; };
  }, [transport, fileRef]);
  return reading;
}

export interface CharacterCatalogue {state: "reading" | "ready" | "error"; characters: CharacterListing[]; error?: string; retry: () => void}

export function useCharacterCatalogue(transport: KernelTransportStatus, enabled = true): CharacterCatalogue {
  const [value, setValue] = useState<Omit<CharacterCatalogue, "retry">>({state: "reading", characters: []});
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setValue(current => ({...current, state: "reading"}));
    listCharacters(transport).then(
      characters => { if (live) setValue({state: "ready", characters}); },
      error => { if (live) setValue({state: "error", characters: [], error: error instanceof Error ? error.message : String(error)}); });
    return () => { live = false; };
  }, [transport, enabled, generation]);
  return {...value, retry: () => setGeneration(n => n + 1)};
}
