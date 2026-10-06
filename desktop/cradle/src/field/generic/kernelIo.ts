/** The generic adapter's io over Central's own file reads (`files_list`, `file_read`, `file_bytes`). */
import {listFiles, readFile, readFileBytes} from "../../files/client";
import type {CentralLocation, KernelTransportStatus} from "../../kernel/types";
import type {GenericIo} from "./genericSource";

export function kernelIo(transport: KernelTransportStatus): GenericIo {
  const locations = new Map<string, CentralLocation>();   // path → the owner's own location, as disclosed by its listing
  return {
    async list(path) {
      const dir = await listFiles(transport, path);
      locations.set(path, dir.location);
      return dir.entries.filter(e => e.kind === "file" || e.kind === "directory").map(e => {
        locations.set(e.location.path, e.location);
        return {name: e.name, path: e.location.path, kind: e.kind as "file" | "directory"};
      });
    },
    async read(path) {
      const location = locations.get(path); if (!location) throw new Error(`${path} was not disclosed by a listing`);
      const r = await readFile(transport, location);
      return {content: r.content, revision: r.revision};
    },
    async bytes(path) {
      const location = locations.get(path); if (!location) throw new Error(`${path} was not disclosed by a listing`);
      const b = await readFileBytes(transport, location);
      return {base64: b.content_base64, mime: b.mime_hint};
    },
  };
}
