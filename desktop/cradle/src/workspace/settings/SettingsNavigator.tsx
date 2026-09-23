/**
 * The left body in Settings mode (docs/cradle/12-SETTINGS.md §1, 10-SIDEBARS
 * law 1: one frame, changing body): the task sections first, then PRODUCTS —
 * one page per product. Counts are the owners' own numbers from the shared
 * settings snapshot; a count that could not be read is simply absent.
 */
import {useEffect, useState, type ReactNode} from "react";
import {ensureSettingsLoaded, useSettings, type SettingsSnapshot} from "./settingsData";
import {goTo, PRODUCTS, samePlace, SECTIONS, useSettingsNav, type SectionId} from "./settingsNav";
import {readyHarnesses, skillCounts, credentialCards} from "./sectionModel";
import {productName} from "./v2/vocabulary";
import "./settings-page.css";

const ICON: Record<SectionId | "product", ReactNode> = {
  status: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></>,
  harnesses: <><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7.5 10l3 2.5-3 2.5M13 15h3.5"/></>,
  models: <><path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z"/><path d="M4.8 7.9L12 12l7.2-4.1M12 12v8.3"/></>,
  credentials: <><circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5l8-8M15.5 7.5l2 2"/></>,
  skills: <><path d="M5 4.5v15M9 4.5v15M13.5 5l4.5 14"/></>,
  profiles: <><path d="M5 7h14M5 12h14M5 17h9"/></>,
  permissions: <><rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M8.5 11V8a3.5 3.5 0 017 0v3"/></>,
  appearance: <><circle cx="12" cy="12" r="8"/><path d="M14.8 9.2l-1.9 4.6-4.6 1.9 1.9-4.6z"/></>,
  product: <><path d="M3.5 7.5a1.5 1.5 0 011.5-1.5h4l2 2h8a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5H5a1.5 1.5 0 01-1.5-1.5z"/></>,
};

function Icon({name}: {name: SectionId | "product"}) {
  return <svg className="settings-nav-icon" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[name]}</svg>;
}

/** The count a section carries in the navigator, from the owners' reads. */
export function sectionCount(id: SectionId, data: SettingsSnapshot): number | null {
  if (id === "harnesses") return data.suite.state === "ok" ? readyHarnesses(data.suite.value).length : null;
  if (id === "credentials") return data.credentials.state === "ok" ? credentialCards(data).filter((card) => card.binding && !card.binding.revoked).length : null;
  if (id === "skills") {
    const counts = data.suite.state === "ok" ? skillCounts(data.suite.value) : null;
    return counts ? counts.active : null;
  }
  return null;
}

export function SettingsNavigator() {
  const data = useSettings();
  const nav = useSettingsNav();
  const [productsOpen, setProductsOpen] = useState(true);
  useEffect(() => ensureSettingsLoaded(), []);
  return <nav className="settings-nav" aria-label="Settings sections" data-settings-navigator>
    <ul className="settings-nav-list">
      {SECTIONS.map((section) => {
        const count = sectionCount(section.id, data);
        const current = samePlace(nav.place, {kind: "section", id: section.id});
        return <li key={section.id}>
          <button type="button" className="settings-nav-row" aria-current={current ? "page" : undefined} data-settings-section={section.id} onClick={() => goTo({kind: "section", id: section.id})}>
            <Icon name={section.id}/><span className="settings-nav-label">{section.label}</span>
            {count !== null && count > 0 && <span className="settings-nav-count" data-settings-count={section.id}>{count}</span>}
          </button>
        </li>;
      })}
    </ul>
    <button type="button" className="settings-nav-group" aria-expanded={productsOpen} onClick={() => setProductsOpen((open) => !open)}>
      <span className="settings-nav-caret" aria-hidden="true">›</span>Products
    </button>
    {productsOpen && <ul className="settings-nav-list" aria-label="Products">
      {[...PRODUCTS, ...(data.registry.state === "ok" ? data.registry.value.mounts.filter((mount) => !PRODUCTS.some((product) => product.id === mount.owner_ref)).map((mount) => ({id: mount.owner_ref, label: productName(mount.owner_ref)})) : [])].map((product) => {
        const current = samePlace(nav.place, {kind: "product", id: product.id});
        return <li key={product.id}>
          <button type="button" className="settings-nav-row" aria-current={current ? "page" : undefined} data-settings-product={product.id} onClick={() => goTo({kind: "product", id: product.id})}>
            <Icon name="product"/><span className="settings-nav-label">{product.label}</span>
          </button>
        </li>;
      })}
    </ul>}
  </nav>;
}
