/**
 * The sources index surface (U0.4, kind 'sources') — the participating
 * sources of the project, exactly as the owner disclosed them through the
 * change horizon (ground inspection as the degraded fallback). Every row
 * is a real ref in Central's canonical grammar; opening one opens a real
 * source surface. No fixtures, no fabricated rows (law 4, law 7):
 * unavailability renders as its honest observation.
 */

import { useEffect } from "react";
import { useKernel } from "../kernel/KernelProvider";
import type { ListedSource } from "../kernel/types";
import type { SurfaceBinding } from "./types";

export interface SourcesIndexProps {
  binding: SurfaceBinding;
  onOpenSource: (source: ListedSource) => void;
}

function availabilityNote(kernel: ReturnType<typeof useKernel>): string | null {
  const listing = kernel.listing;
  if (!listing) return kernel.listingError ?? null;
  const availability = listing.availability;
  if (availability === "horizon") return null;
  if (typeof availability === "object") {
    if ("ground_only" in availability) {
      return `change horizon unavailable (${availability.ground_only.reason}); listed from the ground inspection without live revisions`;
    }
    return `sources unavailable: ${availability.unavailable.reason}`;
  }
  return null;
}

export function SourcesIndex(props: SourcesIndexProps) {
  const kernel = useKernel();
  const listing = kernel.listing;
  const note = availabilityNote(kernel);

  useEffect(() => {
    if (!listing) void kernel.refreshListing();
  }, [listing, kernel]);

  const rows = listing?.sources ?? [];

  return (
    <div className="sources-index" data-kind="sources" data-surface-id={props.binding.id}>
      <div className="sources-head">
        <p className="sources-title">participating sources</p>
        <p className="sources-project" data-project={listing?.project ?? ""}>
          {listing ? `${listing.project} — ${rows.length} source${rows.length === 1 ? "" : "s"}` : "…"}
        </p>
      </div>
      {kernel.transport.kind === "unavailable" ? (
        <p className="sources-unavailable" data-unavailable="transport">
          kernel transport unavailable — {kernel.transport.reason}. the app runs; source
          surfaces disclose their absence rather than fabricating content.
        </p>
      ) : note ? (
        <p className="sources-unavailable" data-unavailable="owner">
          {note}
        </p>
      ) : null}
      {rows.length === 0 && !note && kernel.transport.kind !== "unavailable" ? (
        <p className="sources-unavailable">the owner disclosed no participating sources</p>
      ) : null}
      <ul className="sources-list" role="listbox" aria-label="Participating sources">
        {rows.map((source) => (
          <li key={source.ref} role="option" aria-selected={false} className="source-row">
            <button
              type="button"
              className="source-row-open"
              data-ref={source.ref}
              data-revision={source.revision ?? ""}
              data-treatment={source.treatment}
              onClick={() => props.onOpenSource(source)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  props.onOpenSource(source);
                }
              }}
            >
              <span className="source-row-path">{source.path}</span>
              <span className="source-row-treatment">{source.treatment}</span>
              {source.revision ? (
                <span className="source-row-revision">
                  …{(source.revision.split(":").pop() ?? "").slice(-10)}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
