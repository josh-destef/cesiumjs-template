/**
 * ExampleGeoJsonLayer.ts
 *
 * THIS IS THE FILE YOU REPLACE.
 *
 * Everything else in this template is scaffolding that works for any project.
 * This is the one worked example: it loads a GeoJSON file, turns each feature
 * into something visible on the globe, and hands back a tidy list of the data
 * so the rest of the app can show it as text too.
 *
 * The example data is 51 national parks of the contiguous United States, from
 * the National Park Service, public domain. Visitor counts are 2023 visits.
 *
 * It is in two parts, and keeping them apart is not fussiness:
 *
 *   Part 1 — fetching and reading the data. No Cesium involved.
 *   Part 2 — turning that data into something drawable. Cesium lives here.
 *
 * React Query caches whatever Part 1 returns, and a cache is a bad place for a
 * live Cesium object: Cesium objects must be destroyed to free GPU memory, and
 * a destroyed object sitting in a cache gets handed back to you later, broken.
 * Data is safe to cache. Rendering objects are not.
 */

import {
  Cartesian2,
  Color,
  ConstantProperty,
  GeoJsonDataSource,
  HeightReference,
  LabelGraphics,
  LabelStyle,
  NearFarScalar,
  PointGraphics,
  VerticalOrigin,
  type Viewer,
} from "cesium";

/** Where the file lives. Anything in public/ is served from the site root. */
const DATA_URL = "/data/example.geojson";

/**
 * The shape of one park, as our own code wants to use it. Defining this means
 * the info panel and the table work with predictable objects instead of digging
 * through GeoJSON property bags and hoping the fields are there.
 */
export interface ParkFeature {
  /** A stable id, used as a React key and to match clicks back to data. */
  id: string;
  name: string;
  /** The four-letter National Park Service code, e.g. "YELL". */
  code: string;
  state: string;
  established: number;
  areaAcres: number;
  visitors2023: number;
  longitude: number;
  latitude: number;
}

/** What the loader returns: the parsed features, plus the raw file. */
export interface ExampleData {
  features: ParkFeature[];
  /** Kept so building the globe layer needs no second trip to the network. */
  geoJson: unknown;
}

// ===========================================================================
// Part 1 — fetching and reading the data
// ===========================================================================

/**
 * Downloads the example GeoJSON and converts it into plain ParkFeature objects.
 * This is the function React Query calls. It touches no Cesium at all.
 *
 * @param signal Lets React Query cancel the download if the component goes away
 *               before it finishes.
 */
export async function fetchExampleData(
  signal?: AbortSignal,
): Promise<ExampleData> {
  const response = await fetch(DATA_URL, { signal });

  // fetch() only rejects on network failure — a 404 is a perfectly successful
  // request that happens to have failed. So we check the status ourselves.
  if (!response.ok) {
    throw new Error(
      `Could not load ${DATA_URL} — the server replied ${response.status} ` +
        `${response.statusText}. Check that the file exists in public/data/.`,
    );
  }

  const geoJson = (await response.json()) as GeoJsonFile;

  if (!geoJson || !Array.isArray(geoJson.features)) {
    throw new Error(
      `${DATA_URL} loaded, but it does not look like GeoJSON — it has no ` +
        `"features" array.`,
    );
  }

  const features: ParkFeature[] = [];

  geoJson.features.forEach((feature, index) => {
    const properties = feature?.properties ?? {};
    const coordinates = feature?.geometry?.coordinates;

    // GeoJSON always stores coordinates LONGITUDE FIRST. This is the most
    // common source of "my points are in the wrong hemisphere" bugs, because
    // saying "lat, long" out loud is the normal human order. See
    // docs/gotchas.md.
    const longitude = Number(coordinates?.[0]);
    const latitude = Number(coordinates?.[1]);

    // Skip anything we cannot place. Real data always has a few bad rows, and
    // one of them should not take down the whole map.
    if (!isOnEarth(longitude, latitude)) {
      console.warn(
        `Skipping feature ${index} ("${properties.name ?? "unnamed"}") — ` +
          `its coordinates (${coordinates?.[0]}, ${coordinates?.[1]}) are ` +
          `not a valid longitude/latitude pair.`,
      );
      return;
    }

    const code = asString(properties.code) || `feature-${index}`;

    features.push({
      id: code,
      name: asString(properties.name) || "Unnamed",
      code,
      state: asString(properties.state),
      established: asNumber(properties.established),
      areaAcres: asNumber(properties.area_acres),
      visitors2023: asNumber(properties.visitors_2023),
      longitude,
      latitude,
    });
  });

  // Alphabetical, so the table has a sensible default order.
  features.sort((a, b) => a.name.localeCompare(b.name));

  return { features, geoJson };
}

// ===========================================================================
// Part 2 — turning the data into something you can see
// ===========================================================================

/** A warm green reads well against both terrain and OSM tiles. */
const POINT_COLOR = Color.fromCssColorString("#4ade80");
const POINT_OUTLINE = Color.fromCssColorString("#14532d");

export const SELECTED_COLOR = Color.fromCssColorString("#facc15");
const SELECTED_OUTLINE = Color.fromCssColorString("#713f12");

/**
 * Builds the Cesium layer from GeoJSON that has already been downloaded.
 *
 * Async because Cesium parses the GeoJSON and builds an entity per feature.
 * Older tutorials construct an object and wait on a `.readyPromise` property —
 * that pattern was REMOVED in Cesium 1.107 and will not work.
 */
export async function createExampleDataSource(
  geoJson: unknown,
): Promise<GeoJsonDataSource> {
  const dataSource = await GeoJsonDataSource.load(geoJson, {
    // Drapes features onto the terrain instead of using whatever height the
    // file gives. Our file has no heights, so without this every park sits at
    // sea level — which puts several underground once real terrain loads.
    // See docs/gotchas.md.
    clampToGround: true,

    // We replace the marker entirely below, but setting it here avoids a brief
    // flash of Cesium's default blue pin.
    markerColor: POINT_COLOR,

    // Shown in the credit line at the bottom of the globe. If your data's
    // licence requires attribution, this is where it goes.
    credit: "National Park Service (public domain)",
  });

  styleEntities(dataSource);

  return dataSource;
}

/** Replaces Cesium's default pin graphics with points and labels. */
function styleEntities(dataSource: GeoJsonDataSource): void {
  for (const entity of dataSource.entities.values) {
    // Cesium wraps every GeoJSON property so it could change over time.
    // getValue() unwraps it.
    const name = asString(entity.properties?.name?.getValue?.());

    // Note what is NOT happening here: we are not setting entity.id, which is
    // read-only and throws. Each feature in example.geojson carries a top-level
    // "id" instead, which Cesium uses automatically — that is what lets a click
    // on the globe match a row in the table. Give your own data one too.

    // Drop the default billboard (a pin image) for a plain point. Points are
    // much cheaper to draw. At 51 features that does not matter — it will the
    // moment you swap in a bigger dataset.
    entity.billboard = undefined;

    entity.point = new PointGraphics({
      pixelSize: 11,
      color: POINT_COLOR,
      outlineColor: POINT_OUTLINE,
      outlineWidth: 2,
      // Sticks to the terrain surface as finer terrain tiles stream in.
      heightReference: HeightReference.CLAMP_TO_GROUND,
      // Stops the point hiding inside a hill between it and the camera.
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });

    // A label that only appears once you are close enough to read it. Without
    // the distance rule, 51 labels smear together at continental zoom.
    entity.label = new LabelGraphics({
      text: name,
      font: "500 14px system-ui, sans-serif",
      fillColor: Color.WHITE,
      outlineColor: Color.BLACK,
      outlineWidth: 3,
      style: LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: VerticalOrigin.BOTTOM,
      pixelOffset: new Cartesian2(0, -14),
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      // (nearDistance, nearValue, farDistance, farValue): opaque within 600 km,
      // faded out completely by 2,000 km.
      translucencyByDistance: new NearFarScalar(600_000, 1.0, 2_000_000, 0.0),
    });
  }
}

/**
 * Recolours entities so the selected one stands out. Changing colour beats
 * adding a highlight object: one property write per entity, and no cleanup.
 */
export function applySelectionHighlight(
  dataSource: GeoJsonDataSource,
  selectedId: string | null,
): void {
  for (const entity of dataSource.entities.values) {
    if (!entity.point) {
      continue;
    }

    const isSelected = entity.id === selectedId;

    // Every Cesium graphics property is a Property object so it could vary over
    // time. Ours never does, so each plain value is wrapped in a
    // ConstantProperty — "this value, always".
    entity.point.color = new ConstantProperty(
      isSelected ? SELECTED_COLOR : POINT_COLOR,
    );
    entity.point.outlineColor = new ConstantProperty(
      isSelected ? SELECTED_OUTLINE : POINT_OUTLINE,
    );
    entity.point.pixelSize = new ConstantProperty(isSelected ? 16 : 11);
  }
}

/**
 * Adds the layer to a viewer and returns a function that removes it again.
 * Returning the cleanup from the same place that does the setup makes it hard
 * to add something and forget to tidy it up.
 */
export function attachLayer(
  viewer: Viewer,
  dataSource: GeoJsonDataSource,
): () => void {
  viewer.dataSources.add(dataSource);

  return () => {
    // `true` destroys the data source rather than merely detaching it, which
    // frees the GPU memory it was holding.
    viewer.dataSources.remove(dataSource, true);
  };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** The bits of GeoJSON we actually read, so TypeScript can check our access. */
interface GeoJsonFile {
  features?: Array<{
    properties?: Record<string, unknown>;
    geometry?: { coordinates?: unknown[] };
  }>;
}

function asString(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Is this a real place on Earth? Catches genuinely bad values, and latitude and
 * longitude swapped round — which shows up as a "latitude" beyond 90 whenever
 * the real longitude was outside -90 to 90.
 */
function isOnEarth(longitude: number, latitude: number): boolean {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}
