// The sky provider slot — [C2-a6, C2-b13].
//
// Port decision, recorded against BOTH contracts (CONTEXT-PACK §1.7 names the
// stale design sentence and orders lanes to take this decision explicitly):
//
// 1. The shell projection's DATED-SKY OWNER is the QL kerykeion contract —
//    Work/Quaternal-Logic `providers/sky/kerykeion_snapshot.py`, accepting
//    `ql.sky-request/v1` (closed field set: schema, epoch, timezone, mode,
//    perspective, zodiac, ayanamsha, observer, max_age_seconds,
//    backend_policy) and returning `ql.sky-snapshot/v1` (ten bodies with
//    longitude/latitude/distance/speed/retrograde, `reference_frame:
//    'ecliptic-of-date'`, `snapshot_ref` content digest; Earth the grounding
//    anchor OUTSIDE the planet array; `scope` shared-geocentric |
//    observer-private; `standing: 'calculated-ephemeris-not-observed-sky'`).
//
// 2. The atlas's own sky scale (generated `sky.json` grids + its local
//    Kerykeion/libephemeris birth-sky sidecar, span 2015–2040) is
//    PRESENTATION SCOPE ONLY: one more bundle a provider may publish. It is
//    never the native M2 field, and the two contracts are not merged here.
//
// 3. NO EPHEMERIS IS INVENTED. The ported `sky/ephemeris.ts` only interpolates
//    provider-supplied grids and labels absence; the birth sidecar stays a
//    disclosed presentation client at the address below.
//
// Unverified (honest boundary): no live QL provider was reachable from this
// lane, and projecting a `ql.sky-snapshot/v1` (one epoch) into the atlas's
// grid shape (a sampled span) is the QL family's projection adapter — NOT
// written here, because writing it here would silently merge the two
// contracts. What binds now: the request/snapshot envelope types below and
// `requestQlSkySnapshot`, which speaks the declared shapes and returns the
// snapshot untouched for the owning adapter.

/** Field names verified against the K8 contract reading (CONTEXT-PACK §2.1);
 * the `speed` component key is the contract's "full three-component speed"
 * and is typed widely until the adapter is exercised against a live
 * snapshot. No domain is invented: anything not verified stays `unknown`. */
export interface QlSkyRequestBody {
  key: string;
  native_planet_id: number;
  swiss_body_id: number;
  longitude_degrees: number;
  latitude_degrees: number;
  distance_au: number;
  speed: unknown; // full three-component speed; exact JSON key unverified — read, never assumed
  retrograde: boolean;
  backend: 'swiss-files' | 'moshier'; // the RETURNED flags decide, never the request
}

/** The declared, closed request shape (`ql.sky-request/v1`). Field set per the
 * K8 contract; value domains kept honest where this lane did not verify them. */
export interface QlSkyRequest {
  schema: 'ql.sky-request/v1';
  epoch: string;
  timezone: string;
  mode: 'current' | 'retained-occasion';
  perspective: 'shared-geocentric' | 'observer-private';
  zodiac: unknown; // 'Tropical' | sidereal named frames — domain unverified here
  ayanamsha?: unknown; // required with sidereal, forbidden with Tropical (adapter refuses)
  observer?: unknown; // complete bounded observer when perspective is observer-private
  max_age_seconds: number;
  backend_policy: unknown; // explicit backend policy is mandatory (adapter refuses without it)
}

/** The snapshot envelope, as far as the contract names it. `bodies` carries the
 * ten astronomical bodies; `source_binding` records nine non-Sun voices, seven
 * receiving centres, and the Earth grounding anchor outside the planet array. */
export interface QlSkySnapshot {
  schema: 'ql.sky-snapshot/v1';
  epoch_utc: string;
  epoch_unix_ms: number;
  receipt_utc: string;
  receipt_unix_ms: number;
  julian_day_ut_argument: number;
  time_scale_policy: string; // 'UTC-as-UT argument; UT1 correction not supplied'
  reference_frame: 'ecliptic-of-date';
  ayanamsha_degrees?: number; // sidereal Lahiri only
  scope: 'shared-geocentric' | 'observer-private';
  standing: 'calculated-ephemeris-not-observed-sky';
  snapshot_ref: `sha256:${string}`;
  source_binding: unknown;
  bodies: QlSkyRequestBody[];
}

/** Speak the declared request shape; return the snapshot untouched. Refusals
 * surface as the provider's `ql.sky-error/v1` — never retried blindly, never
 * filled with a substitute. */
export async function requestQlSkySnapshot(endpoint: string, request: QlSkyRequest): Promise<QlSkySnapshot | { schema: 'ql.sky-error/v1'; error: string }> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) return { schema: 'ql.sky-error/v1', error: `HTTP ${res.status}` };
  return await res.json();
}

/** One sky slot. `skyUrl`/`tiesUrl` are the provider bundle's generated grid +
 * body↔field ties ([C2-a6]); absent means the sky layers label their absence —
 * nothing is synthesised. `sidecarBase` is the birth-sky sidecar's address
 * ([C2-b13]; env-overridable, presentation scope, localhost-only by the
 * controller's own guard). `kerykeion` is the shell's dated-sky owner binding
 * (see the port decision above); unset until a host adapter supplies it. */
export interface SkyProvider {
  id: string;
  skyUrl?: string;
  tiesUrl?: string;
  sidecarBase?: string;
  kerykeion?: { endpoint: string; request: QlSkyRequest };
}

const envSidecar = (): string | undefined => {
  try {
    return (import.meta.env.VITE_EPHEMERIS_URL as string | undefined) ?? 'http://127.0.0.1:5187';
  } catch {
    return 'http://127.0.0.1:5187';
  }
};

/** The port's default sky slot: no grid ships with the port (the atlas's own
 * generated sky stays corpus-side with its provider); the sidecar address is
 * the presentation-scope default the controller already guarded. */
export const DEFAULT_SKY_PROVIDER: SkyProvider = {
  id: 'default',
  sidecarBase: envSidecar(),
};

/** The active sky slot; the host (mount.ts) may set it before boot. */
let active: SkyProvider = DEFAULT_SKY_PROVIDER;
export function setSkyProvider(p: SkyProvider): void {
  active = p;
  SIDECAR_BASE = p.sidecarBase ?? SIDECAR_BASE;
}
export function skyProvider(): SkyProvider {
  return active;
}

/** [C2-b13] The sidecar address the controller imports — hoisted here from the
 * controller body into the sky slot's descriptor. A live ESM binding: a host
 * that sets a different slot before boot re-points it. */
export let SIDECAR_BASE = DEFAULT_SKY_PROVIDER.sidecarBase ?? 'http://127.0.0.1:5187';
