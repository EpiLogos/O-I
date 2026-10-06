/**
 * The Epi-Logos essay adapter — a `FieldSource` bound to the real published essay edition.
 *
 * What it reads (all of it the edition's own, none of it invented here):
 *   static/fieldIndex.json     structure, links, tree, which pages have Expressions
 *   quartz-source.json         the source receipt: vault commit and per-file digests (the revisions)
 *   expressions/index.json     the Expression collection and what each member is about
 *   {page}                     the server-rendered page; its `#essay-pane > article` is the body
 *   static/contentIndex.json   full text, fetched only when the reader asks for more than titles
 *
 * Where the edition lives is configuration, not code: `resolveEssayEdition()`. Without one the
 * source is honestly *unavailable* and says why; nothing here falls back to a hard-coded host.
 */
import {CorpusIndex} from "../corpusIndex";
import {detectTransport, kernelOp} from "../../kernel/bridge";
import type {KernelOp, KernelTransportStatus} from "../../kernel/types";
import {
  FieldStaleRevision, parseSourceRef,
  type FieldExpression, type FieldExpressionIndex, type FieldReading, type FieldSource, type FieldStanding,
} from "../source";
import {buildEssayModel, DEFAULT_ADDRESSING, essayHead, essayPager, expressionId, type EssayAddressing, type EssayModel, type RawExpressionIndex, type RawFieldIndex, type RawSourceReceipt} from "./essayModel";

export interface EssayEdition {
  /** The edition's own root — the directory holding `static/fieldIndex.json` and the pages. */
  baseUrl: string;
  addressing?: EssayAddressing;
  fetchImpl?: typeof fetch;
  /** Pages are files named `<slug>.html` (`index.html` for the root). The packaged World's route serves only files its manifest lists,
   * so a directory-style address would be a refusal, not a page. */
  pageFiles?: boolean;
  /** Set when the edition came from the installed World package: which revision, so a reading can say what it read. */
  packaged?: { world_id: string; revision: string; manifest_sha256?: string; verified?: { level: string; files: number; bytes: number } };
}

const STORAGE_KEY = "oi-cradle.essay-edition";
/** Where a Cradle build finds the essay edition: a runtime override, the person's configured edition, or the
 * edition packaged beside the app. None is assumed; absence is reported, not papered over. */
export function resolveEssayEdition(): EssayEdition | undefined {
  try {
    const w = window as unknown as { __OI_ESSAY_EDITION__?: string };
    const pick = w.__OI_ESSAY_EDITION__ ?? window.localStorage.getItem(STORAGE_KEY) ?? (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ESSAY_EDITION;
    return pick ? { baseUrl: pick } : undefined;
  } catch { return undefined; }
}
/** The kernel's answer to `world_resolve` (desktop/cradle/kernel/src/world_resolve.rs). */
export interface WorldResolution {
  state: "available" | "absent" | "broken";
  world_id: string; root: string; reason?: string;
  revision?: string; manifest_sha256?: string;
  dir?: string; edition_dir?: string; praxis_dir?: string; manifest?: string;
  source_addressing?: { world: string; prefix: string };
  counts?: unknown;
  verified?: { level: string; files: number; bytes: number };
  /** `__world/<world id, one percent-encoded segment>/<revision>/`; the edition is under `edition/` beneath it. */
  route_path?: string;
}

/** Where the host serves the installed World's files: the Tauri host through its `oi-material:` protocol, the dev walk bridge at `/world/`. */
export function worldBase(transport: KernelTransportStatus, routePath: string): string | undefined {
  if (transport.kind === "tauri") return `oi-material://localhost/${routePath}`;
  if (transport.kind === "bridge") return `${transport.url}/world/${routePath.replace(/^__world\//, "")}`;
  return undefined;
}

export interface PackagedDeps {
  transport?: KernelTransportStatus;
  op?: typeof kernelOp;
  /** Waits between attempts to ask the kernel; default 400 ms then 1.2 s. */
  retryDelaysMs?: number[];
}

/** The installed World package, asked of the kernel and served by the host. An absent or damaged install, or no kernel to ask, is reported
 * with its reason; nothing falls back to a hard-coded host. */
export async function resolvePackagedEssayEdition(deps: PackagedDeps = {}): Promise<EssayEdition | { unavailable: string; state: "absent" | "broken" | "unreachable" }> {
  const transport = deps.transport ?? detectTransport();
  if (transport.kind === "unavailable") return { unavailable: `The installed Return-of-Zero World cannot be asked for: ${transport.reason}`, state: "unreachable" };
  // `world_resolve` is a pure read, so a transport that drops it (a keep-alive connection reset, a network change under a busy loopback bridge)
  // is asked again a couple of times before the World is called unreachable; a kernel that answers is believed at once.
  const ask = deps.op ?? kernelOp;
  const delays = deps.retryDelaysMs ?? [400, 1200];
  let call = await ask(transport, { op: "world_resolve" } as unknown as KernelOp);
  for (const delay of delays) {
    if (call.outcome) break;
    await new Promise(r => setTimeout(r, delay));
    call = await ask(transport, { op: "world_resolve" } as unknown as KernelOp);
  }
  if (!call.outcome) return { unavailable: `The kernel could not resolve the installed Return-of-Zero World: ${call.error ?? "no answer"}`, state: "unreachable" };
  const resolution = (call.outcome as unknown as { resolution?: WorldResolution }).resolution;
  if (!resolution) return { unavailable: "The kernel answered world_resolve without a resolution (the host predates the World seam)", state: "unreachable" };
  if (resolution.state !== "available" || !resolution.route_path || !resolution.source_addressing || !resolution.revision) {
    return { unavailable: `The Return-of-Zero World is ${resolution.state}${resolution.reason ? `: ${resolution.reason}` : ""}`, state: resolution.state === "broken" ? "broken" : "absent" };
  }
  const base = worldBase(transport, resolution.route_path);
  if (!base) return { unavailable: "No host serves the installed World's files", state: "unreachable" };
  return {
    baseUrl: `${base}edition/`, addressing: resolution.source_addressing, pageFiles: true,
    packaged: { world_id: resolution.world_id, revision: resolution.revision, manifest_sha256: resolution.manifest_sha256, verified: resolution.verified },
  };
}

/** The edition the Epi world reads: a runtime override or the person's configured edition when there is one (they keep winning, for development),
 * otherwise the installed World package. */
export async function resolveEssayEditionAsync(deps: PackagedDeps = {}): Promise<EssayEdition | { unavailable: string; state: "absent" | "broken" | "unreachable" }> {
  return resolveEssayEdition() ?? resolvePackagedEssayEdition(deps);
}

export function rememberEssayEdition(baseUrl: string | null) {
  try { baseUrl ? window.localStorage.setItem(STORAGE_KEY, baseUrl) : window.localStorage.removeItem(STORAGE_KEY); } catch { /* per-viewer convenience */ }
}

const withSlash = (u: string) => (u.endsWith("/") ? u : u + "/");

/** Tags and attributes that never belong in a reading, whatever the source says. */
const DROP = "script,iframe,object,embed,link,meta,base,form";
function clean(root: Element) {
  root.querySelectorAll(DROP).forEach(e => e.remove());
  for (const el of root.querySelectorAll("*")) for (const a of [...el.attributes]) if (/^on/i.test(a.name) || (/^(href|src|xlink:href)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
}

export function createEssayFieldSource(edition: EssayEdition): FieldSource & { model(): Promise<EssayModel>; edition: EssayEdition } {
  const base = new URL(withSlash(edition.baseUrl), typeof location !== "undefined" ? location.href : undefined);
  const addressing = edition.addressing ?? DEFAULT_ADDRESSING;
  const doFetch: typeof fetch = edition.fetchImpl ?? ((...a) => fetch(...a));
  const url = (rel: string) => new URL(rel, base).href;
  const json = async <T,>(rel: string, optional = false): Promise<T | null> => {
    const res = await doFetch(url(rel));
    if (!res.ok) { if (optional) return null; throw new Error(`${rel}: ${res.status} ${res.statusText}`.trim()); }
    return await res.json() as T;
  };

  let loading: Promise<{ model: EssayModel; index: CorpusIndex }> | null = null;
  let loadedModel: EssayModel | undefined;
  const ensure = () => (loading ??= (async () => {
    const [fi, receipt, xi] = await Promise.all([
      json<RawFieldIndex>("static/fieldIndex.json"),
      json<RawSourceReceipt>("quartz-source.json", true).catch(() => null),
      json<RawExpressionIndex>("expressions/index.json", true).catch(() => null),
    ]);
    const model = buildEssayModel(fi!, receipt, xi, addressing);
    loadedModel = model;
    return { model, index: new CorpusIndex(model.data) };
  })().catch(error => { loading = null; throw error; }));

  /** An absolute URL inside the edition → the page ref it names, if it is a page of the essay. */
  function refForUrl(model: EssayModel, u: URL): string | undefined {
    // A custom scheme (`oi-material:`) has an opaque origin: compare what makes an address the same place.
    if (u.protocol !== base.protocol || u.host !== base.host || !u.pathname.startsWith(base.pathname)) return undefined;
    let slug: string;
    try { slug = decodeURIComponent(u.pathname.slice(base.pathname.length)); } catch { return undefined; }
    slug = slug.replace(/\.html$/, "").replace(/\/+$/, "") || "index";
    return model.refOfSlug.get(slug) ?? model.refOfSlug.get(slug + "/index") ?? (slug.endsWith("/README") ? undefined : model.refOfSlug.get(slug + "/README"));
  }
  const pageUrl = (slug: string) => edition.pageFiles
    ? new URL(slug.split("/").map(encodeURIComponent).join("/") + ".html", base).href
    : slug === "index" ? base.href : new URL(slug.split("/").map(encodeURIComponent).join("/"), base).href;

  const source: FieldSource & { model(): Promise<EssayModel>; edition: EssayEdition } = {
    id: "epi-logos/essay",
    label: "The essay",
    world_ref: addressing.world,
    edition,
    model: async () => (await ensure()).model,

    async standing(): Promise<FieldStanding> {
      try {
        const {model, index} = await ensure();
        const commit = model.edition.commit ? ` · source ${model.edition.commit.slice(0, 9)}` : "";
        return { state: "available", reason: `${index.nodes.length.toLocaleString("en-US")} pages${commit}`, owner: "the published essay edition" };
      } catch (cause) {
        return { state: "unavailable", reason: `The essay edition at ${base.href} could not be read: ${cause instanceof Error ? cause.message : String(cause)}`, owner: "the published essay edition (EpiLogos/Antykathera-Essay-Work, built by site/build-essay-quartz.mjs)" };
      }
    },

    async load() { return (await ensure()).index; },

    async read(ref, opts): Promise<FieldReading> {
      const {model, index} = await ensure();
      const node = index.node(ref), raw = model.raw.get(ref), slug = model.slugOf.get(ref);
      if (!node || !raw || !slug) throw new Error(`${ref} is not a page of this edition`);
      // A stale revision is refused, never coerced into the current one.
      if (opts?.revision && node.revision && opts.revision !== node.revision) throw new FieldStaleRevision(ref, opts.revision, node.revision);
      let res = await doFetch(pageUrl(slug));
      if (!res.ok && res.status === 404 && !edition.pageFiles) res = await doFetch(pageUrl(slug) + ".html");
      if (!res.ok) throw new Error(`${node.path}: ${res.status} ${res.statusText}`.trim());
      const finalUrl = new URL(res.url || pageUrl(slug));
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const article = doc.querySelector("#essay-pane article") ?? doc.querySelector("article");
      if (!article) throw new Error(`${node.path} has no article in this edition`);
      const body = article.cloneNode(true) as Element;
      clean(body);
      for (const a of body.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        const href = a.getAttribute("href")!;
        if (a.hasAttribute("role") && a.getAttribute("role") === "anchor") { a.setAttribute("data-fjump", href.replace(/^#/, "")); a.setAttribute("href", "#" + href.replace(/^.*#/, "")); continue; }
        if (href.startsWith("#")) { a.setAttribute("data-fjump", decodeURIComponent(href.slice(1))); continue; }
        let target: URL; try { target = new URL(href, finalUrl); } catch { continue; }
        if (!/^https?:$/.test(target.protocol) && target.protocol !== base.protocol) { a.removeAttribute("href"); continue; }
        const dest = refForUrl(model, target);
        a.setAttribute("href", target.href);
        if (dest) {
          a.setAttribute("data-fref", dest);
          if (target.hash) a.setAttribute("data-fspan", decodeURIComponent(target.hash.slice(1)));
        } else { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); }
      }
      for (const el of body.querySelectorAll<HTMLElement>("img[src],source[src],video[src]")) el.setAttribute("src", new URL(el.getAttribute("src")!, finalUrl).href);
      for (const el of body.querySelectorAll<HTMLElement>("img[srcset],source[srcset]")) el.removeAttribute("srcset");
      const sheets = [...doc.querySelectorAll<HTMLLinkElement>("link[rel~=stylesheet]")]
        .map(l => new URL(l.getAttribute("href")!, finalUrl)).filter(u => !/\/index\.css$/.test(u.pathname)).map(u => u.href);
      const head = essayHead(model, index, ref)!;
      const sourceRef = ref;
      return {
        ref, revision: node.revision ?? model.edition.commit ?? "", sourceRef, sourceRevision: node.revision ?? model.edition.commit ?? "",
        title: head.title, head: { eyebrow: head.eyebrow, deck: head.deck, meta: head.meta },
        format: "html", body: body.outerHTML, stylesheets: sheets, pager: essayPager(model, index, ref),
      };
    },

    async expressions(): Promise<FieldExpressionIndex | null> { return (await ensure()).model.expressions; },

    expressionView(entry: FieldExpression, scene, theme) {
      // The site serves the renderer beside `essay/`; the World package carries it at `renderer/` beside `edition/` (and the page declares that
      // base), so the same renderer reads the same index and bodies, and checks each body's digest, through the same route.
      const u = new URL(edition.pageFiles ? "../renderer/expression.html" : "../expression.html", base);
      u.searchParams.set("x", expressionId(entry.ref));
      if (scene) u.searchParams.set("scene", scene);
      u.searchParams.set("embed", "1"); u.searchParams.set("theme", theme);
      return { kind: "frame", url: u.href };
    },

    shortTitle: t => t.replace(/^Return of Zero\s+[—·-]\s+/, "").replace(/^Return of Zero · Room \d of \d · /, ""),

    libraryNames: () => ({ essay: "The essay", rooms: "Section-rooms", symbolon: "Symbolon", arguments: "Arguments", matheme: "Matheme", mytheme: "Mytheme wholes", episteme: "Episteme", products: "The products" }),

    async searchText() {
      const raw = await json<Record<string, { content: string }>>("static/contentIndex.json");
      const {model} = await ensure();
      const out = new Map<string, string>();
      for (const [slug, v] of Object.entries(raw ?? {})) { const ref = model.refOfSlug.get(slug); if (ref) out.set(ref, v.content ?? ""); }
      return out;
    },

    coverUrl: entry => entry.cover ? new URL("expressions/" + entry.cover, base).href : undefined,

    resolveToken(token) { return loadedModel?.refOfSlug.get(token); },

    sourceOf(ref) {
      const parsed = parseSourceRef(ref);
      return parsed ? { location: ref } : undefined;
    },
  };
  return source;
}

/** The slug the edition names a ref's page by — display and fetch only; never an identity. */
export async function essayPathOf(source: { model(): Promise<EssayModel> }, ref: string): Promise<string | undefined> {
  return (await source.model()).slugOf.get(ref);
}
