// The image-ref resolver — an occurrence's plate is owner material, served by the host's material route
// [T-ATLAS-ASSETS; PORT-AUDIT §D M4; DEVICE-SEMANTICS-LOCK §8.4].
//
// An `ImageRef` names a file the owner holds by a site-relative path (`img/families/serpent.jpg`). The Earth's base
// textures ship with the instrument (public/textures); a plate does not — it resolves, at use, through the route the host
// already serves for Central material: `oi-material://localhost/<url-encoded Location JSON>/<relative path>` under the
// native host, its dev mirror `<bridge>/material/<same path>` under a walk bridge (`desktop/cradle/kernel/src/bin/
// walk-bridge.rs:15`). The route resolves the path as a sibling of the base Location's directory, one owner-verified
// listing per component, and refuses `..` (`material_protocol.rs`, URL grammar in its header).
//
// No new URL grammar: the segments and the encoded Location come from `materialUrl` (`desktop/cradle/src/expressions/
// hostedApp.ts:63-67`), the exported twin of `materialPath` (`desktop/cradle/src/material/MaterialSurface.tsx:34-38`);
// the bridge form takes that same path behind the bridge's `/material/` — `MaterialSurface.tsx:45-49`.
//
// A plate that cannot be served is absent, never a broken image: no base Location, no transport that serves material, or
// a path that climbs out of the base all leave the `image` off its entity, and the reveal shows its tonal plate.

import {materialUrl} from '../../../../../../../desktop/cradle/src/expressions/hostedApp';
import type {CentralLocation, KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types';
import type {Field, ImageRef} from '../src/types/field';

/** What `src/data/load.ts resolveSrc` already passes through untouched; every other scheme is not a plate. */
const PASSES_THROUGH = /^(data:|https?:|blob:)/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const MATERIAL_ORIGIN = 'oi-material://localhost/';

/** Where relative ImageRef paths resolve: the live transport, and a Central Location in the folder they are relative to
 * (the way an HTML document's own location is the base of its relative assets). */
export interface ImageBase {
  transport: KernelTransportStatus;
  base?: CentralLocation;
}

/** The path segments of a site-relative ImageRef path, or undefined for a path the route would refuse (empty, a scheme,
 * a backslash or control character, `.` or `..`). A leading slash is read as site-relative, as `resolveSrc` reads it. */
function relativeSegments(relative: string): string[] | undefined {
  const trimmed = relative.replace(/^\/+/, '');
  if (!trimmed || SCHEME.test(trimmed) || /[\\\u0000-\u001f]/.test(trimmed)) return undefined;
  const segments = trimmed.split('/').filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === '.' || segment === '..')) return undefined;
  return segments;
}

/** The material URL of `relative` beside `base`, under the live transport; undefined when nothing can serve it. */
export function materialImageUrl(transport: KernelTransportStatus, base: CentralLocation | undefined, relative: string): string | undefined {
  if (!base) return undefined;
  const segments = relativeSegments(relative);
  if (!segments) return undefined;
  if (transport.kind === 'unavailable') return undefined;
  const native = materialUrl(base, segments.join('/'));
  if (transport.kind === 'tauri') return native;
  if (!native.startsWith(MATERIAL_ORIGIN)) return undefined;
  return `${transport.url}/material/${native.slice(MATERIAL_ORIGIN.length)}`;
}

function resolvePath(path: string, images: ImageBase | undefined): string | undefined {
  if (PASSES_THROUGH.test(path)) return path;
  return images ? materialImageUrl(images.transport, images.base, path) : undefined;
}

/** One ImageRef with its `src` and `thumb` served: absolute refs (data:, http(s):, blob:) are returned as they are, a relative
 * one becomes its material URL, and a ref whose `src` cannot be served is undefined. A `thumb` that cannot be served falls
 * back to the `src` (the type's "may equal src"). */
export function resolveImageRef(ref: ImageRef, images?: ImageBase): ImageRef | undefined {
  const src = resolvePath(ref.src, images);
  if (src === undefined) return undefined;
  const thumb = ref.thumb ? resolvePath(ref.thumb, images) ?? src : src;
  return src === ref.src && thumb === ref.thumb ? ref : {...ref, src, thumb};
}

/** True when the ref names a path to be served by the host (rather than carrying its own bytes or URL). */
export function isRelativeImage(ref: ImageRef | undefined): boolean {
  return !!ref && (!PASSES_THROUGH.test(ref.src) || (!!ref.thumb && !PASSES_THROUGH.test(ref.thumb)));
}

type Tiers = Pick<Field, 'archetypes' | 'theoretics' | 'families' | 'occurrences'>;

/** True when any entity of the four image-bearing tiers carries a relative ImageRef. */
export function hasRelativeImage(field: Tiers): boolean {
  return [field.archetypes, field.theoretics, field.families, field.occurrences].some((tier) => tier?.some((item) => isRelativeImage(item.image)));
}

/** The field with every entity's image served. An entity whose image cannot be served keeps no image — the entity's own
 * fallbacks (an occurrence's family, a family's archetype) and then the tonal plate stand in. Entities whose images need
 * no change are returned as they are. */
export function resolveFieldImages<F extends Tiers>(field: F, images?: ImageBase): F {
  const tier = <T extends {image?: ImageRef}>(items: T[]): T[] =>
    items?.map((item) => {
      if (!item.image) return item;
      const resolved = resolveImageRef(item.image, images);
      if (resolved === item.image) return item;
      const {image: _unserved, ...rest} = item;
      return (resolved ? {...rest, image: resolved} : rest) as T;
    });
  return {
    ...field,
    archetypes: tier(field.archetypes),
    theoretics: tier(field.theoretics),
    families: tier(field.families),
    occurrences: tier(field.occurrences),
  };
}
