/**
 * The System surface — the world's census: what is installed, what is
 * working, what is running, what needs attention. The honesty laws are
 * unchanged (06-SYSTEM-SETTINGS §2): discovered ≠ ready, empty is proof,
 * writes stay with the owners — but the words on the page are now chosen
 * for the person reading them (vocabulary.ts), and the raw records live
 * behind one developer disclosure instead of scattered JSON dumps.
 *
 * Bootstrap is this same surface in an empty world, so the setup steps
 * stay here, opening wide when nothing is installed yet.
 */
import type {ActivityExtras, CompositionReading, OwnerMount} from "../types";
import {buildSections, frameFact} from "../world";
import {ProductSection} from "./ProductSectionV2";
import {NativeProductSection} from "./NativeProductSectionV2";
import {GroundChooser} from "../../GroundChooser";
import {formatRelativeTime} from "../../../shared/relativeTime";

const BOOTSTRAP_STEPS: {title: string; detail: string; native: string}[] = [
  {title: "Connect your Central", detail: "Central is where this world keeps its memory and its rules. Point the suite at it once and everything else keys off that choice.", native: "Settings → Ground & suite, or `oi install --personal-ground <path>` in a terminal"},
  {title: "Install the products", detail: "One command puts every product of the suite in place at pinned, verified versions — a stale pin refuses cleanly rather than installing a lie.", native: "`oi install` in a terminal"},
  {title: "Check the world", detail: "Each product reports in below as it is found — every discovery is a visible event, not a spinner.", native: "`oi verify --json` · `oi doctor` · `oi status --json` in a terminal"},
  {title: "Make it yours", detail: "Only the settings that matter on first run surface for attention; day-to-day life happens in Settings.", native: "Settings, in this same window"},
];

export function SystemHome({reading, nativeMounts, nativePending, ground, extras, pending, error, onRefresh}: {
  reading?: CompositionReading;
  nativeMounts?: Record<string, OwnerMount>;
  nativePending: boolean;
  ground?: string | null | undefined;
  extras: ActivityExtras;
  pending: boolean;
  error?: string;
  onRefresh: () => void;
}) {
  const sections = buildSections(reading, extras);
  const installed = sections.filter((section) => section.availability === "discovered").length;
  const unavailable = sections.filter((section) => section.availability === "unavailable").length;
  const missing = sections.length - installed - unavailable;
  const executable = reading?.suite_executable
    ? (reading.suite_executable.split("/").pop() ?? reading.suite_executable)
    : undefined;
  return <>
    <header className="settings-world-header">
      <div><h2>This world</h2><p>{reading ? `${installed} of ${sections.length} products installed${unavailable ? ` · ${unavailable} not answering` : ""}${missing ? ` · ${missing} not installed` : ""}` : "Not yet read"}</p></div>
      <dl className="settings-world-facts">
        <div><dt>Central</dt><dd>{ground === undefined ? "Can't be read" : ground ?? "Not chosen yet"}</dd></div>
        <div><dt>Arrangement</dt><dd>{reading ? frameFact(reading) : "Not yet read"}</dd></div>
        <div><dt>Suite</dt><dd>{executable ?? "Not yet read"}</dd></div>
        <div><dt>Read</dt><dd>{reading && Number.isFinite(reading.observed_at_unix_ms) ? formatRelativeTime(reading.observed_at_unix_ms) : "not yet"}</dd></div>
      </dl>
    </header>
    {(pending || nativePending) && <p className="settings-note" role="status">Reading the world…</p>}
    {error && <p role="alert">{error}</p>}
    {reading?.current_world.error && <p role="alert">{reading.current_world.error}</p>}
    {reading?.status.error && <p role="alert">{reading.status.error}</p>}
    {sections.map((section) => {
      const mount = nativeMounts?.[section.product_id];
      return mount?.descriptor
        ? <NativeProductSection key={section.product_id} mount={mount} name={section.name}/>
        : <ProductSection key={section.product_id} model={section}/>;
    })}
    <section className="settings-bootstrap" aria-label="Setting up a new world">
      <h3>Set up a new world</h3>
      <p className="settings-note">The same steps work whether nothing is installed yet or you are starting over — this page is that process, not a separate wizard.</p>
      <ol className="settings-bootstrap">{BOOTSTRAP_STEPS.map((step, index) => <li key={step.title}>
        <strong>{index + 1}. {step.title}</strong>
        <p>{step.detail}</p>
        <em className="product-native-path">{step.native}</em>
      </li>)}</ol>
      <GroundChooser/>
    </section>
    <div className="system-actions">
      <button disabled={pending || nativePending} onClick={onRefresh}>{pending || nativePending ? "Reading…" : "Read the world again"}</button>
    </div>
  </>;
}
