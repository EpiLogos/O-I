/**
 * The optional canonical locator: the one outward deep-link from a published
 * Expression back to the canonical record it expresses.
 *
 * The locator is the receiving pipeline's single canonical subject identity —
 * the {record_id, vault_path, source_revision} triple the collection envelope's
 * pinned source bindings already carry, normalised. It is an OPTIONAL field:
 * `projection.source.canonical` on an Expression publication and
 * `props.canonical` on a presentation binding. Publications without it are
 * unchanged; nothing here invents a second subject identity.
 *
 * This module is pure (no node built-ins) so the same helpers serve the
 * build-side admission, the standalone world edition and the browser receiver.
 */

export const CANONICAL_LOCATOR_KEYS = ['record_id', 'vault_path', 'source_revision'];

/** A well-formed locator: exactly the three non-empty string fields, with a
 * repo-relative Markdown vault path (no leading separator, no traversal). */
export function isCanonicalLocator(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== CANONICAL_LOCATOR_KEYS.length || keys.some((key) => !CANONICAL_LOCATOR_KEYS.includes(key))) return false;
  if (keys.some((key) => typeof value[key] !== 'string' || !value[key].trim())) return false;
  return isCanonicalVaultPath(value.vault_path);
}

function isCanonicalVaultPath(path) {
  return /^[\w][\w./-]*\.md$/.test(path) && !path.includes('..') && !path.includes('//');
}

/**
 * THE canonical Publish URL derivation, in one place.
 *
 * The essay's Obsidian Publish site addresses a vault path as the
 * essay-repo-relative path without its leading essay root
 * (`submission-package/essay/`) and without the trailing `.md`, joined onto
 * the Publish base. The base must be a build-time https URL (e.g.
 * VITE_OI_PUBLISH_BASE); an empty, unset or non-https base yields null so a
 * locator never renders as a dead or unsafe link.
 */
export function canonicalPublishHref(locator, publishBase) {
  const base = typeof publishBase === 'string' ? publishBase.replace(/\/+$/, '') : '';
  const path = isCanonicalLocator(locator)
    ? locator.vault_path.replace(/^submission-package\/essay\//, '').replace(/\.md$/, '')
    : '';
  if (!/^https:\/\//.test(base) || !path) return null;
  return `${base}/${path}`;
}
