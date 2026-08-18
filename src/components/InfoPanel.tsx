/**
 * InfoPanel.tsx
 *
 * The card that appears when you select a park, showing its details.
 *
 * This replaces Cesium's built-in "info box". We use our own because Cesium
 * renders its version inside an iframe, which screen readers announce poorly
 * and which cannot be styled to match the rest of an app.
 *
 * Feel free to edit this file — change the fields, change the layout. The
 * accessibility notes marked "KEEP" are the parts worth preserving.
 */

import type { ParkFeature } from "../layers/ExampleGeoJsonLayer";

/**
 * Formats a position the way a person would read it, e.g.
 * "44.3386 N, 68.2103 W". For display only — never feed this back into Cesium.
 */
function formatLonLat(longitude: number, latitude: number): string {
  const ns = latitude >= 0 ? "N" : "S";
  const ew = longitude >= 0 ? "E" : "W";

  return `${Math.abs(latitude).toFixed(4)}° ${ns}, ${Math.abs(longitude).toFixed(4)}° ${ew}`;
}

interface InfoPanelProps {
  /** The park to describe, or null when nothing is selected. */
  feature: ParkFeature | null;
  /** Called when the user closes the panel. */
  onClose: () => void;
}

export function InfoPanel({ feature, onClose }: InfoPanelProps) {
  // KEEP: this element stays in the DOM even when empty.
  //
  // It is an aria-live region, which means screen readers announce changes to
  // its contents. That only works if the element already exists when the
  // content changes — if we returned null here, React would create a brand new
  // element each time and many screen readers would say nothing at all.
  return (
    <aside
      className="panel info-panel"
      aria-live="polite"
      aria-label="Selected park details"
    >
      {feature === null ? (
        <p className="info-panel__empty">
          Select a park on the globe to see its details.
        </p>
      ) : (
        <>
          <div className="panel__header">
            <h2 className="panel__title">{feature.name}</h2>

            <button
              type="button"
              className="panel__close"
              onClick={onClose}
              // KEEP: the visible label is "×", which a screen reader would
              // read as "times". aria-label gives it a real name.
              aria-label={`Close details for ${feature.name}`}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {/*
            A description list is the right element here: this is genuinely a
            set of term/value pairs, and screen readers can navigate it as one.
          */}
          <dl className="info-panel__list">
            <div className="info-panel__row">
              <dt>State</dt>
              <dd>{feature.state}</dd>
            </div>

            <div className="info-panel__row">
              <dt>Established</dt>
              <dd>{feature.established}</dd>
            </div>

            <div className="info-panel__row">
              <dt>Area</dt>
              {/* toLocaleString adds thousands separators: 2219791 -> 2,219,791 */}
              <dd>{feature.areaAcres.toLocaleString()} acres</dd>
            </div>

            <div className="info-panel__row">
              <dt>Visitors (2023)</dt>
              <dd>{feature.visitors2023.toLocaleString()}</dd>
            </div>

            <div className="info-panel__row">
              <dt>Location</dt>
              <dd>
                {formatLonLat(feature.longitude, feature.latitude)}
              </dd>
            </div>

            <div className="info-panel__row">
              <dt>Park code</dt>
              <dd>{feature.code}</dd>
            </div>
          </dl>
        </>
      )}
    </aside>
  );
}
