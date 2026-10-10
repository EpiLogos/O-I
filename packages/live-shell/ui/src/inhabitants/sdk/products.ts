/** The product organisation law — the six carvings, checkable.
 *
 * WORLD-SHELL-DESIGN §12: the six products each contribute a device family;
 * the shell's door is neutral, the keys are held by owners. This module
 * carries the product registry (drift-gated against the suite catalogue by
 * tests/device-sdk.test.mjs — the catalogue stays the source of truth, this
 * is its SDK-side view) and the binding law the gate enforces:
 *
 * - a family MAY bind to a product (`FamilyDeclaration.product`);
 * - a binding must name a REGISTERED product, or declare its authority for
 *   a NEW product (the seventh-product test: admitted, never special-cased
 *   — but the claim is recorded, not implicit);
 * - one product family per product: a second family wanting the same
 *   product composes through the declared-extension path instead;
 * - a family whose id names a product (`central/...`) must bind or rename —
 *   no product name squatting.
 *
 * Capability families that serve no single product (atlas-earth) simply do
 * not bind — the optionality is the law's honesty.
 *
 * Pure: no view, no store, no I/O. */

export interface ProductRecord {
  readonly id: string
  readonly name: string
}

/** The six products (§12), drift-gated against
 * `suite/product-capabilities.json` (`products[].id` / `public_name`). */
export const PRODUCTS: readonly ProductRecord[] = [
  {id: 'central', name: 'Central'},
  {id: 'actuation', name: 'Actuation'},
  {id: 'ai-kit', name: 'AIKit'},
  {id: 'software-factory', name: 'Software Factory'},
  {id: 'workcell', name: 'Workcell'},
  {id: 'quaternal-logic', name: 'Quaternal Logic'},
]

export function product(id: string): ProductRecord | undefined {
  return PRODUCTS.find(candidate => candidate.id === id)
}

export const PRODUCT_IDS: readonly string[] = PRODUCTS.map(record => record.id)

export function isKnownProduct(id: string): boolean {
  return product(id) !== undefined
}

/** A new-product claim: the family binds a product the registry does not
 * carry yet. The authority names WHO commissions the carving and WHERE that
 * commission stands (a programme doc, an owner ruling) — recorded at the
 * gate, not guessed. */
export interface NewProductAuthority {
  /** The new product's id (lowercase kebab; must not collide with the registry). */
  readonly id: string
  /** The commissioning authority (e.g. "owner ruling 2026-10-09, PROGRAMME.md"). */
  readonly authority: string
}
