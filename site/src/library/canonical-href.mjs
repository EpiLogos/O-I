/** The outbound canonical-record link the Reader's provenance slot can carry.
 * Build-time Publish base, following the site's other VITE_ build variables.
 * Empty by default: without a configured Publish site no canonical link renders. */
import { canonicalPublishHref } from '../../../shared-field/canonical-locator.mjs';

export const PUBLISH_BASE = import.meta.env?.VITE_OI_PUBLISH_BASE || '';

/** The one canonicalPublishHref derivation with the build-time base.
 * Null when there is no locator or no base. */
export function canonicalHref(locator, base = PUBLISH_BASE) {
 return canonicalPublishHref(locator, base);
}
