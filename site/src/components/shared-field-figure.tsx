/**
 * Local world -> shared field -> other world -> attributable return.
 * Two independently grounded worlds selectively project into a mediated
 * field, encounter one another, and return difference without the source
 * authority of either world moving.
 */
export function SharedFieldFigure() {
  return (
    <div className="shared-map" role="img" aria-label="Your world and another world each selectively project into a shared field, encounter one another there, and each receives an attributable return. Both worlds remain independently grounded.">
      <div className="shared-map__row">
        <div className="shared-map__world">
          <span className="shared-map__world-name">Your world</span>
          <span className="shared-map__world-note">grounded, authored, authoritative locally</span>
        </div>
        <div className="shared-map__edge" aria-hidden="true">
          <span className="shared-map__edge-label">selective projection</span>
          <span className="shared-map__arrow">⟶</span>
        </div>
        <div className="shared-map__field">
          <span className="shared-map__field-name"><span className="meta-signal" aria-hidden="true" />Shared field</span>
          <span className="shared-map__field-note">mediated encounter · presentations, not ownership</span>
        </div>
        <div className="shared-map__edge" aria-hidden="true">
          <span className="shared-map__arrow">⟵</span>
          <span className="shared-map__edge-label">selective projection</span>
        </div>
        <div className="shared-map__world">
          <span className="shared-map__world-name">Another world</span>
          <span className="shared-map__world-note">independently grounded, never absorbed</span>
        </div>
      </div>
      <div className="shared-map__return" aria-hidden="true">
        <span className="shared-map__return-arrow">⟵</span>
        <span className="shared-map__return-label">an attributable difference returns to each ground</span>
        <span className="shared-map__return-arrow">⟶</span>
      </div>
    </div>
  );
}
