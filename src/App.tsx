/**
 * App.tsx
 *
 * The top of the application, where the pieces are wired together. A good
 * place to start reading, and a good place to make your first change.
 *
 * What happens here, in order:
 *
 *   1. React Query downloads the data.
 *   2. <Globe /> creates the Cesium viewer and hands it back to us.
 *   3. Once we have both, we build the map layer and add it to the viewer.
 *   4. Selecting a park — by clicking the globe or a table row — highlights it
 *      and flies the camera to it.
 *
 * The viewer is held in a ref rather than in state: a ref is the right tool
 * when you need to remember an object across renders but changing it should not
 * itself cause a re-render. The parallel `viewer` state exists purely so that
 * effects can wait for it to exist.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GeoJsonDataSource, Viewer } from "cesium";

import { Globe } from "./components/Globe";
import { InfoPanel } from "./components/InfoPanel";
import { DataTable } from "./components/DataTable";
import { flyToLonLat } from "./cesium/camera";
import {
  applySelectionHighlight,
  attachLayer,
  createExampleDataSource,
  fetchExampleData,
} from "./layers/ExampleGeoJsonLayer";
import { getTokenStatus } from "./utils/tokenCheck";

export function App() {
  const viewerRef = useRef<Viewer | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);

  /** The layer we added, kept so we can restyle it later. */
  const dataSourceRef = useRef<GeoJsonDataSource | null>(null);

  /** Forces a re-render once the layer is on the globe. */
  const [isLayerAttached, setIsLayerAttached] = useState(false);

  /** The id of the selected park, or null when nothing is selected. */
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);

  /**
   * Set if Cesium ion rejects our token while the app is running.
   *
   * Separate from the up-front token check below: a token can be present and
   * well-formed but still wrong — a typo, revoked, missing an asset. That only
   * shows up when Cesium actually asks ion for something.
   */
  const [ionErrors, setIonErrors] = useState<string[]>([]);

  // -------------------------------------------------------------------------
  // 1. Load the data
  // -------------------------------------------------------------------------
  // useQuery handles the whole lifecycle of a network request: loading, error,
  // success, caching, retrying. `queryKey` is the cache key — two components
  // asking for it would share one request rather than making two.
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["example-parks"],
    // React Query passes an AbortSignal so the download can be cancelled if
    // this component disappears before it finishes.
    queryFn: ({ signal }) => fetchExampleData(signal),
  });

  const features = data?.features ?? [];

  // -------------------------------------------------------------------------
  // 2. Receive the viewer from <Globe />
  // -------------------------------------------------------------------------
  const handleViewerReady = useCallback((created: Viewer) => {
    viewerRef.current = created;
    setViewer(created);
  }, []);

  const handleIonError = useCallback((message: string) => {
    // Terrain and imagery can fail from the same bad token and each reports
    // separately. Collect them rather than letting the second overwrite the
    // first — together they tell the whole story.
    setIonErrors((previous) =>
      previous.includes(message) ? previous : [...previous, message],
    );
  }, []);

  const handleViewerDestroy = useCallback(() => {
    viewerRef.current = null;
    setViewer(null);
  }, []);

  // -------------------------------------------------------------------------
  // 3. Put the layer on the globe, once both halves are ready
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!viewer || !data) {
      return;
    }

    // Building the data source is asynchronous, so this component could unmount
    // while we wait. `cancelled` lets the cleanup below tell the in-flight work
    // to throw its result away rather than attaching to a dead viewer.
    let cancelled = false;
    let detach: (() => void) | null = null;

    createExampleDataSource(data.geoJson)
      .then((dataSource) => {
        if (cancelled || viewer.isDestroyed()) {
          return;
        }

        detach = attachLayer(viewer, dataSource);
        dataSourceRef.current = dataSource;
        setIsLayerAttached(true);
      })
      .catch((cause: unknown) => {
        // A failure here is a Cesium problem rather than a network one, so it
        // does not belong in the React Query error state above.
        console.error("Could not build the map layer:", cause);
      });

    return () => {
      cancelled = true;
      detach?.();
      dataSourceRef.current = null;
      setIsLayerAttached(false);
    };
  }, [viewer, data]);

  // -------------------------------------------------------------------------
  // 4. Highlight the selected park, and fly to it
  // -------------------------------------------------------------------------
  useEffect(() => {
    const dataSource = dataSourceRef.current;

    if (!dataSource) {
      return;
    }

    applySelectionHighlight(dataSource, selectedFeatureId);

    // Move the camera only when something is selected — flying away on deselect
    // is disorienting.
    if (viewer && selectedFeatureId) {
      const feature = features.find((item) => item.id === selectedFeatureId);

      if (feature) {
        flyToLonLat(viewer, {
          longitude: feature.longitude,
          latitude: feature.latitude,
        });
      }
    }
    // `features` is intentionally left out: it is a new array on every render,
    // and including it would re-run this effect (and re-fly the camera)
    // constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeatureId, viewer, isLayerAttached]);

  const handleFeaturePick = useCallback((entityId: string | null) => {
    setSelectedFeatureId(entityId);
  }, []);

  /** The full record for whichever park is selected, or null. */
  const selectedFeature =
    features.find((item) => item.id === selectedFeatureId) ?? null;

  /** Shown as a banner when there is no usable ion token. */
  const tokenStatus = getTokenStatus();

  return (
    <div className="app">
      {/*
        A skip link, and the first thing in the tab order. A keyboard user
        landing here would otherwise have to tab through the map controls
        before reaching the readable content.
      */}
      <a className="skip-link" href="#data-table-title">
        Skip to the data table
      </a>

      <header className="app__header">
        <h1 className="app__title">National Parks of the United States</h1>
        <p className="app__subtitle">
          Built with CesiumJS · a CreateAccess project
        </p>
      </header>

      {ionErrors.length > 0 && (
        <div className="banner banner--warning" role="status">
          <strong>Cesium ion problem.</strong>{" "}
          {ionErrors.length === 1 ? (
            ionErrors[0]
          ) : (
            <ul className="banner__list">
              {ionErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}{" "}
          See <code>docs/gotchas.md</code>.
        </div>
      )}

      {tokenStatus !== "ok" && (
        <div className="banner banner--warning" role="status">
          <strong>No Cesium ion token.</strong> The globe is using OpenStreetMap
          imagery and flat terrain. To get 3D terrain, copy{" "}
          <code>.env.example</code> to <code>.env.local</code>, add your token
          from <code>ion.cesium.com/tokens</code>, and restart the dev server.
        </div>
      )}

      {isError && (
        <div className="banner banner--error" role="alert">
          <strong>Could not load the park data.</strong>{" "}
          {error instanceof Error ? error.message : "Unknown error."}{" "}
          <button
            type="button"
            className="button button--inline"
            onClick={() => void refetch()}
          >
            Try again
          </button>
        </div>
      )}

      <main className="app__main">
        <Globe
          onViewerReady={handleViewerReady}
          onViewerDestroy={handleViewerDestroy}
          onFeaturePick={handleFeaturePick}
          onIonError={handleIonError}
        >
          <InfoPanel
            feature={selectedFeature}
            onClose={() => setSelectedFeatureId(null)}
          />

          {/*
            Keyboard controls that nobody knows about are not much better than
            no keyboard controls, so the hint is always visible rather than
            hidden behind a help button.
          */}
          <p className="panel globe__hint">
            Click the globe, then use the arrow keys to pan, <kbd>+</kbd> and{" "}
            <kbd>−</kbd> to zoom, and <kbd>Home</kbd> to reset.
          </p>

          {/*
            The loading badge sits over the globe rather than replacing it, so
            the map is usable while the points are still arriving.
          */}
          {isPending && (
            <p className="badge" role="status">
              Loading park data…
            </p>
          )}
        </Globe>
      </main>

      {/*
        The table is outside <Globe>, in normal page flow — a real part of the
        document, not an overlay. It is always rendered: it is the accessible
        equivalent of the map, and an accessibility feature behind a toggle is
        one most people never discover.
      */}
      <DataTable
        features={features}
        selectedFeatureId={selectedFeatureId}
        onSelectFeature={setSelectedFeatureId}
      />
    </div>
  );
}
