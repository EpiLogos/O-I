/**
 * Live readings of a scene's material, each fetched through the item's own
 * owner: Central's file route (`file_read`, falling back to the binary-safe
 * `file_bytes` for material that is not UTF-8) or AIKit's knowledge `read`.
 * A reading is never stored with the scene — only the revision it stood on
 * when the item was added, so "changed since added" is a comparison between
 * two owner facts and never a guess.
 */
import {useCallback, useEffect, useRef, useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {readFile, readFileBytes} from "../files/client";
import {knowledge} from "../knowledge/client";
import {detectFormat, type MaterialFormat} from "../material/detect";
import type {KnowledgeReading, NativeFileReading} from "../kernel/types";
import {recordMaterialRevision, type MaterialItem} from "./material";

export type MaterialReading =
  | {state: "reading"}
  | {state: "available"; revision?: string; byteLen?: number; mime?: string | null; format?: MaterialFormat; file?: NativeFileReading; knowledge?: KnowledgeReading}
  | {state: "unavailable"; error: string};

export type MaterialStanding = "reading" | "available" | "stale" | "unavailable";
/** What a row says about its item: the reading state, with "stale" when the
 * owner's current revision differs from the one recorded at add time. */
export function materialStanding(item: MaterialItem, reading: MaterialReading | undefined): MaterialStanding {
  if (!reading || reading.state === "reading") return "reading";
  if (reading.state === "unavailable") return "unavailable";
  return item.addedRevision !== undefined && reading.revision !== undefined && reading.revision !== item.addedRevision ? "stale" : "available";
}

const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

export function useMaterialReadings(sceneId: string, items: MaterialItem[], project: string | undefined): {readings: Record<string, MaterialReading>; reread: () => void} {
  const {transport} = useKernel();
  const [readings, setReadings] = useState<Record<string, MaterialReading>>({});
  const [tick, setTick] = useState(0);
  const done = useRef(new Map<string, number>());
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const ids = items.map(item => item.id).join("\n");
  useEffect(() => {
    for (const item of items) {
      if (done.current.get(item.id) === tick) continue;
      done.current.set(item.id, tick);
      const settle = (reading: MaterialReading) => {
        if (!live.current || done.current.get(item.id) !== tick) return;
        setReadings(current => ({...current, [item.id]: reading}));
        if (reading.state === "available" && reading.revision !== undefined) recordMaterialRevision(sceneId, item.id, reading.revision);
      };
      setReadings(current => current[item.id] ? current : {...current, [item.id]: {state: "reading"}});
      if (item.ref.kind === "file") {
        const location = item.ref.location, byExtension = detectFormat({path: location.path});
        const bytes = () => readFileBytes(transport, location).then(material => settle({state: "available", revision: material.revision, byteLen: material.byte_len, mime: material.mime_hint, format: detectFormat({path: location.path, mimeHint: material.mime_hint})}));
        if (byExtension === "image" || byExtension === "pdf" || byExtension === "unsupported") void bytes().catch(cause => settle({state: "unavailable", error: text(cause)}));
        else void readFile(transport, location).then(
          file => settle({state: "available", revision: file.revision, byteLen: file.byte_len, format: byExtension, file}),
          // Not every file is UTF-8 text: ask the binary-safe route before calling it unavailable.
          textFailure => bytes().catch(() => settle({state: "unavailable", error: text(textFailure)})),
        );
      } else {
        void knowledge<KnowledgeReading>(transport, item.ref.project ?? project, {action: "read", address: item.ref.address}).then(
          reading => settle({state: "available", revision: reading.revision, knowledge: reading}),
          cause => settle({state: "unavailable", error: text(cause)}),
        );
      }
    }
    // Readings of removed items are dropped with their refs.
    const present = new Set(items.map(item => item.id));
    for (const id of [...done.current.keys()]) if (!present.has(id)) done.current.delete(id);
    setReadings(current => Object.keys(current).every(id => present.has(id)) ? current : Object.fromEntries(Object.entries(current).filter(([id]) => present.has(id))));
  // `ids` stands for `items`: a new array of the same refs must not re-read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, tick, transport, project, sceneId]);
  const reread = useCallback(() => setTick(value => value + 1), []);
  // Material can change outside this window: look again when it is shown again.
  useEffect(() => {
    const shown = () => { if (!document.hidden) reread(); };
    document.addEventListener("visibilitychange", shown);
    return () => document.removeEventListener("visibilitychange", shown);
  }, [reread]);
  return {readings, reread};
}
