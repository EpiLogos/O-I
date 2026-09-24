import type {SettingsSnapshot} from "./settingsData";
import {productName} from "./vocabulary";

/** L6: the native composition/catalogue determines membership and order.
 * Friendly names are presentation only; an unknown seventh owner uses the
 * same page, search, drift and routing paths without a new desktop branch. */
export function settingsProducts(data: SettingsSnapshot): {id:string;label:string}[] {
  const ids = new Set<string>();
  if (data.census?.state === "ok") for (const position of data.census.value.positions) ids.add(position.product_id);
  if (data.registry?.state === "ok") for (const mount of data.registry.value.mounts ?? []) ids.add(mount.owner_ref);
  if (data.owners?.state === "ok") for (const id of Object.keys(data.owners.value)) ids.add(id);
  return [...ids].filter(id => id.trim().length > 0).map(id => ({id,label:productName(id)}));
}
