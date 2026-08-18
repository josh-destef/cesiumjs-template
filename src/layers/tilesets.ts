/**
 * tilesets.ts
 *
 * Ready-made helpers for the 3D Tiles that ship with Cesium ion — the ones
 * almost every project reaches for eventually: Google's Photorealistic 3D
 * Tiles, Cesium OSM Buildings, or any other tileset in your ion account.
 * Copy the pattern below for a tileset not covered here; every one of these
 * factory functions is async and none of them use the removed synchronous
 * constructors — check the `cesiumjs-skills` plugin (or
 * node_modules/cesium/Source/Cesium.d.ts) before writing your own.
 *
 * Each helper follows the same shape on purpose: an `add...` function that
 * loads the tileset and puts it in the scene, and a matching `remove...`
 * function that undoes exactly that. Call `add...` once you have a viewer
 * (after `onViewerReady`, the same place src/layers/ExampleGeoJsonLayer.ts's
 * layer gets attached), and call `remove...` in whatever cleanup path your
 * component already has — see the pattern in App.tsx's viewer-lifecycle
 * effects, or how `attachLayer` in that same layer file returns its own
 * cleanup function.
 *
 * None of these are wired into the app by default. A photorealistic mesh or
 * a full buildings layer is a real decision — it changes what your data
 * should clamp to, how much your token needs to be scoped for, and how much
 * a visitor's browser has to download. Import what you actually want.
 */

import {
  Cesium3DTileset,
  createGooglePhotorealistic3DTileset,
  createOsmBuildingsAsync,
  EllipsoidTerrainProvider,
  Terrain,
  type Viewer,
} from "cesium";

// ===========================================================================
// Google Photorealistic 3D Tiles
// ===========================================================================
//
// A textured mesh built from real aerial and satellite imagery, rather than
// flat imagery draped over a terrain heightmap. Two things your project needs
// before this will work:
//
//   1. Your ion token needs the "Google Photorealistic 3D Tiles" asset
//      enabled, in addition to whatever else it already has (World Terrain,
//      Bing Imagery). Add it at ion.cesium.com/tokens.
//
//   2. src/cesium/createViewer.ts already sets the Viewer's geocoder to
//      Cesium.IonGeocodeProviderType.GOOGLE whenever a token is present —
//      Cesium's own docs say this tileset "can only be used with the Google
//      geocoder". If you ever do need to change that file, keep this in
//      mind; that line is there on purpose, not left over from something
//      else.
//
// `createGooglePhotorealistic3DTileset` is the one factory in the whole
// Cesium API with NO "Async" suffix despite being asynchronous — a trap the
// `cesiumjs-skills` plugin's 3d-tiles skill calls out explicitly. It is still
// awaited like every other factory here.

/**
 * Loads the Google Photorealistic 3D Tiles tileset and adds it to the scene.
 *
 * Also hides the ordinary globe (`scene.globe.show = false`) and swaps World
 * Terrain out for a flat ellipsoid. Google's mesh has its own real-world
 * ground geometry; leaving the globe's terrain surface active as well makes
 * both try to draw the same ground at once — z-fighting, which shows up as
 * flickering where the two surfaces fight over which is in front.
 *
 * @throws If ion rejects the token for this asset, or the tileset otherwise
 *         fails to load — most often a token missing the asset above. Catch
 *         this the same way createViewer.ts reports a rejected terrain or
 *         imagery token, with an `onIonError`-style callback into your UI.
 */
export async function addGooglePhotorealisticTiles(
  viewer: Viewer,
): Promise<Cesium3DTileset> {
  const tileset = await createGooglePhotorealistic3DTileset({
    // Required by Cesium: confirms this tileset is only used alongside the
    // Google geocoder, which createViewer.ts enables whenever there is a
    // token. See the file-level comment above.
    onlyUsingWithGoogleGeocoder: true,
  });

  // The caller could have changed their mind, or torn the viewer down,
  // while this was loading. Discard rather than attach to a dead scene.
  if (viewer.isDestroyed()) {
    tileset.destroy();
    throw new Error("The viewer was destroyed while the tileset was loading.");
  }

  viewer.scene.primitives.add(tileset);
  viewer.scene.globe.show = false;
  viewer.scene.setTerrain(
    new Terrain(Promise.resolve(new EllipsoidTerrainProvider())),
  );

  return tileset;
}

/**
 * Reverses addGooglePhotorealisticTiles: removes the tileset, restores the
 * globe, and restores World Terrain.
 */
export function removeGooglePhotorealisticTiles(
  viewer: Viewer,
  tileset: Cesium3DTileset,
): void {
  if (viewer.isDestroyed()) {
    return;
  }

  // `true` frees the tileset's GPU memory rather than merely detaching it.
  viewer.scene.primitives.remove(tileset);
  viewer.scene.globe.show = true;
  viewer.scene.setTerrain(Terrain.fromWorldTerrain());
}

// ===========================================================================
// Cesium OSM Buildings
// ===========================================================================
//
// A global 3D buildings layer built from OpenStreetMap data, streamed from
// Cesium ion. Unlike the photorealistic mesh above, this sits ON TOP of your
// existing terrain and imagery rather than replacing them — no geocoder
// requirement, no globe.show change, and it needs only the same ion token
// scope (assets:read) this template already asks for. Attribution is baked
// into Cesium's credit line automatically.

/** Loads Cesium OSM Buildings and adds it to the scene. */
export async function addOsmBuildings(viewer: Viewer): Promise<Cesium3DTileset> {
  const tileset = await createOsmBuildingsAsync();

  if (viewer.isDestroyed()) {
    tileset.destroy();
    throw new Error("The viewer was destroyed while the tileset was loading.");
  }

  viewer.scene.primitives.add(tileset);

  return tileset;
}

/** Reverses addOsmBuildings. */
export function removeOsmBuildings(viewer: Viewer, tileset: Cesium3DTileset): void {
  if (viewer.isDestroyed()) {
    return;
  }

  viewer.scene.primitives.remove(tileset);
}

// ===========================================================================
// Any other Cesium ion 3D Tiles asset
// ===========================================================================
//
// For a tileset you uploaded to your own ion account, or any public ion
// asset by id — building data, photogrammetry, a point cloud. Find the
// asset's numeric id on its page at ion.cesium.com/assets.

/** Loads any Cesium ion 3D Tiles asset by id and adds it to the scene. */
export async function addIonTileset(
  viewer: Viewer,
  ionAssetId: number,
): Promise<Cesium3DTileset> {
  const tileset = await Cesium3DTileset.fromIonAssetId(ionAssetId);

  if (viewer.isDestroyed()) {
    tileset.destroy();
    throw new Error("The viewer was destroyed while the tileset was loading.");
  }

  viewer.scene.primitives.add(tileset);

  return tileset;
}

/** Reverses addIonTileset. */
export function removeIonTileset(viewer: Viewer, tileset: Cesium3DTileset): void {
  if (viewer.isDestroyed()) {
    return;
  }

  viewer.scene.primitives.remove(tileset);
}
