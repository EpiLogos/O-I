/** Native collection manifests are memberships over sources, not new subjects.
 * Discovery reads metadata only. Every body is read on explicit selection.
 * No directory error is silently reinterpreted as an empty collection. */
import {listFiles} from "../files/client";
import {readCollection} from "../expressions/collectionReadings";
import type {KernelTransportStatus, NativeDirectory} from "../kernel/types";
import type {LibraryCoverage, LibraryItem, LibraryQuery} from "./scope";
import type {LibraryProvider} from "./providers";

export const COLLECTIONS_DIR = "ProjectCentral/user/collections";
const messageOf = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause);

export function collectionsProvider(transport: KernelTransportStatus): LibraryProvider {
  return {
    id: "collections", label: "Collections", kinds: ["composition"], scopes: ["local"],
    async list(query: LibraryQuery, signal): Promise<{items: LibraryItem[]; coverage: LibraryCoverage}> {
      // The shared Library consumes admitted native projections, never private
      // collection discovery merely relabelled "shared" by a renderer filter.
      if (query.scope === "shared") return {items: [], coverage: {provider: "collections", state: "complete"}};
      const items = new Map<string, LibraryItem>();
      const failures: string[] = [];
      const check = () => { if (signal.aborted) throw new Error("query cancelled"); };
      const directories = new Map<string, Promise<NativeDirectory>>();
      const list = (path: string) => {
        check();
        let value = directories.get(path);
        if (!value) { value = listFiles(transport, path, query.fresh === true); directories.set(path, value); }
        return value;
      };
      // Parent listings establish optional-directory absence. Read failures
      // and permission withdrawals remain named, rather than empty success.
      const optional = async (root: string, parts: string[]): Promise<{path: string; reading: NativeDirectory} | null> => {
        let path = root;
        let reading = await list(path);
        for (const name of parts) {
          check();
          const entry = reading.entries.find(candidate => candidate.name === name);
          if (!entry) return null;
          if (entry.kind !== "directory") throw new Error(`${path}/${name} is not a directory`);
          if (entry.retrieval_allowed === false) throw new Error(`Central withholds retrieval of ${path}/${name}`);
          path = path === "." ? name : `${path}/${name}`;
          reading = await list(path);
        }
        return {path, reading};
      };
      const gather = async (root: string, parts: string[], project?: string) => {
        try {
          const found = await optional(root, parts);
          if (!found) return;
          for (const entry of found.reading.entries) {
            check();
            if (entry.kind !== "file" || !entry.name.endsWith(".manifest.json")) continue;
            const path = `${found.path}/${entry.name}`;
            const reading = await readCollection(transport, path, {readContents: false, signal, fresh: query.fresh});
            check();
            if (reading.status !== "ready") { failures.push(reading.message); continue; }
            if (!reading.basis) { failures.push(`${path}: manifest source basis is missing`); continue; }
            for (const member of reading.members) {
              if (!member.location) { failures.push(`${path}: ${member.id} has no resolved source location`); continue; }
              const membership = {
                manifest_path: path, manifest_location: reading.basis.location,
                manifest_revision: reading.basis.revision, member_id: member.id,
                slot: member.slot, file: member.file, group: member.group, title: member.name,
              };
              const current = items.get(member.location.ref);
              if (current) {
                current.collectionMemberships!.push(membership);
                current.summary = `${current.collectionMemberships!.length} collection memberships — source body read on selection`;
              } else items.set(member.location.ref, {
                kind: "composition", ref: member.location.ref, title: member.name,
                summary: `${member.group} · ${entry.name} — source body read on selection`,
                owner: member.location.root, scope: "local", project,
                sourceLocation: member.location, provider: "collections", collectionMemberships: [membership],
              });
            }
            failures.push(...reading.errors.map(error => `${path} [${error.id}]: ${error.message}`));
          }
        } catch (cause) { failures.push(`${root}: ${messageOf(cause)}`); }
      };
      // Central root work is legitimate independently of Work projects.
      // Probe the existing native layout; never create or migrate directories.
      await gather(".", ["Control", "user", "collections"]);
      try {
        const work = await optional(".", ["Work"]);
        if (work) for (const project of work.reading.entries) {
          check();
          if (project.kind !== "directory") continue;
          if (project.retrieval_allowed === false) { failures.push(`Central withholds retrieval of Work/${project.name}`); continue; }
          await gather(`Work/${project.name}`, COLLECTIONS_DIR.split("/"), project.name);
        }
      } catch (cause) { failures.push(messageOf(cause)); }
      if (signal.aborted) return {items: [], coverage: {provider: "collections", state: "unavailable", reason: "query cancelled"}};
      const discovered = [...items.values()];
      const literal = query.text.trim().toLowerCase();
      const matching = literal ? discovered.filter(item => [item.title, item.ref, ...(item.collectionMemberships ?? []).flatMap(m => [m.title, m.member_id, m.group, m.manifest_path])].some(text => text.toLowerCase().includes(literal))) : discovered;
      return {items: matching, coverage: {provider: "collections", state: failures.length ? discovered.length ? "partial" : "unavailable" : "complete", reason: failures.length ? failures.join("; ") : undefined}};
    },
  };
}
