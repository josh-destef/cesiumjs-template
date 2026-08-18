// EDIT WITH CARE — this is known-good, tightly-coupled viewer configuration.
// Most "unrecoverable" build/blank-globe failures in a Cesium project trace
// back to a change here. If your spec genuinely needs something different,
// go ahead — just read the rest of this file first, and run `npm run build`
// afterwards.
//
// ONE DELIBERATE EXCEPTION: the `geocoder` option below is conditional rather
// than a flat `false`, so that Google Photorealistic 3D Tiles (see
// src/layers/tilesets.ts) work out of the box. That is a one-line, considered
// change, not an oversight — see the comment at that option before "fixing"
// it back.

/**
 * createViewer.ts
 *
 * Creates the Cesium Viewer — the object that owns the 3D globe, its camera,
 * and its render loop. Everything else in this app is built on top of the
 * object this file returns.
 *
 * Marked EDIT WITH CARE because getting viewer setup slightly wrong produces
 * failures that look like something else entirely: a black screen, a globe
 * with no imagery, or a crash on the second page load. Prefer changing how
 * the globe looks or behaves from your own code using the returned viewer;
 * change this file itself only when the behaviour has to come from here.
 *
 * VERIFIED AGAINST CesiumJS 1.144.0. Every API used here was checked against
 * the installed type definitions. See the `cesiumjs-skills` plugin (or
 * `node_modules/cesium/Source/Cesium.d.ts` directly) before changing any
 * Cesium call.
 */

import {
  EllipsoidTerrainProvider,
  Ion,
  IonGeocodeProviderType,
  Viewer,
  Terrain,
  ImageryLayer,
  OpenStreetMapImageryProvider,
  ScreenSpaceEventType,
} from "cesium";

// Cesium ships its own stylesheet for the on-screen widgets (the credit line,
// the zoom controls, and so on). Without this import those widgets render as
// unstyled HTML on top of the globe.
import "cesium/Build/Cesium/Widgets/widgets.css";

import { getToken } from "../utils/tokenCheck";

/** What createViewer hands back, so callers know what they can rely on. */
export interface CreatedViewer {
  /** The Cesium Viewer itself. */
  viewer: Viewer;
  /** True if we had a usable ion token and so loaded terrain + ion imagery. */
  usingIon: boolean;
}

export interface CreateViewerOptions {
  /**
   * Called if Cesium ion rejects the token at runtime.
   *
   * A token can look perfectly fine — present, not the placeholder — and still
   * be wrong: a typo, a revoked token, or one not authorised for the asset.
   * Cesium's only visible response is an empty black globe, which is exactly
   * the failure this template exists to prevent. So we detect it and tell the
   * app, which shows a banner explaining what happened.
   */
  onIonError?: (message: string) => void;
}

/**
 * Builds the Viewer inside the given container element.
 *
 * @param container A div that already has a real width and height. Cesium
 *                  measures this element to size its canvas; a container with
 *                  zero height produces a globe zero pixels tall.
 */
export function createViewer(
  container: HTMLDivElement,
  options: CreateViewerOptions = {},
): CreatedViewer {
  // -------------------------------------------------------------------------
  // 1. Register the ion token, if we have one.
  // -------------------------------------------------------------------------
  // Cesium reads this single global whenever it requests anything from Cesium
  // ion (terrain, imagery, 3D Tiles). Setting it must happen BEFORE the Viewer
  // is constructed, because the Viewer starts requesting imagery immediately.
  const token = getToken();
  const usingIon = token !== undefined;

  if (usingIon) {
    Ion.defaultAccessToken = token;
  }

  // -------------------------------------------------------------------------
  // 2. Set up terrain (the 3D shape of the ground).
  // -------------------------------------------------------------------------
  // Terrain.fromWorldTerrain() returns a small helper object immediately and
  // loads the real terrain provider in the background. It is NOT a promise, so
  // there is nothing to await here.
  //
  // We build it before constructing the Viewer so we can attach an error
  // listener first. Scene has a setTerrain() method but no matching `terrain`
  // getter, so keeping hold of the object here is the only way to reach it.
  const terrain = usingIon ? Terrain.fromWorldTerrain() : undefined;

  if (terrain) {
    // The most likely cause of failure is a token that is valid but not
    // authorised for the Cesium World Terrain asset. The globe still works
    // without terrain, so we report the problem rather than letting it become
    // an unhandled promise rejection.
    terrain.errorEvent.addEventListener((error: unknown) => {
      console.warn(
        "Cesium World Terrain failed to load. The globe will be smooth " +
          "instead of mountainous. This usually means your ion token is not " +
          "authorised for the terrain asset (Cesium World Terrain is asset 1).",
        error,
      );

      options.onIonError?.(
        "Cesium World Terrain could not be loaded, so the globe is smooth " +
          "rather than 3D. Check that your ion token includes asset 1.",
      );
    });
  }

  // -------------------------------------------------------------------------
  // 3. Choose a base imagery layer (the pictures painted on the globe).
  // -------------------------------------------------------------------------
  // Without a token we fall back to OpenStreetMap, which needs no key. This is
  // deliberate: the template shows a real, working globe the very first time
  // you run it, before you have signed up for anything. The on-screen banner
  // and the console warning still tell you to add a token, because you need
  // one for terrain and for any Cesium ion asset.
  //
  // The baseLayer option expects an ImageryLayer (or false), not a provider.
  // With a token we pass undefined so the Viewer uses its own ion default.
  const baseLayer = usingIon ? undefined : createOpenStreetMapLayer();

  // -------------------------------------------------------------------------
  // 4. Construct the Viewer.
  // -------------------------------------------------------------------------
  // Most of these options switch OFF a piece of built-in Cesium UI. They are
  // turned off because this template provides its own accessible controls, and
  // because several of the built-in widgets are not keyboard reachable.
  const viewer = new Viewer(container, {
    // --- Terrain -----------------------------------------------------------
    // Built just above. The old synchronous createWorldTerrain() was REMOVED
    // in CesiumJS 1.107 — if you have seen it in a tutorial, that tutorial is
    // out of date. Terrain needs an ion token, so this is undefined without one.
    terrain,

    // --- Imagery -----------------------------------------------------------
    baseLayer,

    // --- UI we replace with our own accessible versions ---------------------
    baseLayerPicker: false, // needs a token to populate; not keyboard friendly
    //
    // The geocoder (search box) is off with no token — it is an ion-billed
    // service, and this template does not otherwise need a place-search UI.
    // With a token, we point it at Google specifically: Cesium's Google
    // Photorealistic 3D Tiles (src/layers/tilesets.ts) may ONLY be used
    // together with the Google geocoder — see createGooglePhotorealistic3DTileset
    // in the `cesiumjs-skills` plugin's 3d-tiles skill. Enabling it costs nothing for projects
    // that never call that helper, and it is a plain <input> + <button>, so
    // it stays keyboard reachable without extra work — unlike the widgets
    // disabled below, which are not.
    geocoder: usingIon ? IonGeocodeProviderType.GOOGLE : false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    vrButton: false,
    projectionPicker: false,

    // --- UI we do not need for a map with no time dimension -----------------
    animation: false,
    timeline: false,

    // --- Feature selection --------------------------------------------------
    // Cesium's own info box is an iframe, which screen readers handle poorly
    // and which we cannot style consistently. We render our own InfoPanel
    // instead. selectionIndicator is the green targeting reticle.
    infoBox: false,
    selectionIndicator: false,

    // --- Render loop --------------------------------------------------------
    // requestRenderMode is OFF by default in this template, on purpose.
    //
    // Setting it to true makes Cesium redraw only when something changes,
    // which saves a lot of battery and GPU on a map that just sits there. It
    // is genuinely the right setting for a finished static map, and you should
    // turn it on — see docs/rendering-decisions.md.
    //
    // It is off HERE because when it is on, anything you animate yourself will
    // silently not appear until you call viewer.scene.requestRender(). That is
    // a confusing first bug to hit. Ship with it off; turn it on once your
    // scene is finished and static.
    requestRenderMode: false,
  });

  // -------------------------------------------------------------------------
  // 5. Catch an ion token that is present but not accepted.
  // -------------------------------------------------------------------------
  // This is the failure that costs people an afternoon. A typo'd, revoked, or
  // under-scoped token passes every check we can do up front, then fails with
  // a 401 when Cesium requests imagery — and Cesium's only visible response is
  // a black globe.
  //
  // So we watch the base imagery layer, and if it errors we swap in the
  // keyless OpenStreetMap layer and tell the app to explain itself.
  if (usingIon) {
    // Put a plain smooth-ellipsoid terrain provider back if world terrain
    // failed.
    //
    // This matters more than it looks. A Terrain object that failed to load
    // leaves the globe with no usable surface, and a globe with no surface
    // draws NO IMAGERY EITHER — the whole planet stays black even when the
    // imagery layer is perfectly healthy. Restoring a working terrain provider
    // is what makes the imagery fallback below actually visible.
    terrain?.errorEvent.addEventListener(() => {
      if (!viewer.isDestroyed()) {
        viewer.terrainProvider = new EllipsoidTerrainProvider();
      }
    });

    const ionLayer = viewer.imageryLayers.get(0);

    // A single layer can raise many errors (one per failed tile), so this flag
    // makes sure we only swap and report once.
    let alreadyHandled = false;

    ionLayer?.errorEvent.addEventListener((error: unknown) => {
      if (alreadyHandled || viewer.isDestroyed()) {
        return;
      }
      alreadyHandled = true;

      console.warn(
        "Cesium ion imagery failed to load — falling back to OpenStreetMap. " +
          "Your token is set but was not accepted. Check it is correct, is " +
          "not revoked, and includes the assets you use.",
        error,
      );

      // Swap in a layer that needs no token, so the user still gets a map.
      //
      // This is deferred with setTimeout for a real reason: this callback runs
      // from inside Cesium's own imagery update loop, and adding or removing
      // layers while Cesium is iterating over them leaves the new layer
      // half-initialised — the symptom is a globe that stays black even though
      // the fallback "worked". Waiting for the next tick lets Cesium finish
      // first.
      setTimeout(() => {
        if (viewer.isDestroyed()) {
          return;
        }

        // Hide rather than destroy. Removing the layer Cesium just raised an
        // error about invites the same mid-iteration problem.
        ionLayer.show = false;
        viewer.imageryLayers.add(createOpenStreetMapLayer());
      }, 0);

      options.onIonError?.(
        "Your Cesium ion token was rejected, so the map fell back to " +
          "OpenStreetMap imagery. Check the token in .env.local is correct " +
          "and has the assets:read scope.",
      );
    });
  }

  // -------------------------------------------------------------------------
  // 6. Turn off double-click-to-track.
  // -------------------------------------------------------------------------
  // By default, double-clicking an entity locks the camera onto it, and there
  // is no obvious way for a user to escape. We remove that behaviour so that
  // clicks only ever do what our own code says they do.
  viewer.screenSpaceEventHandler.removeInputAction(
    ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
  );

  // -------------------------------------------------------------------------
  // 7. Accessibility: make the canvas focusable.
  // -------------------------------------------------------------------------
  // A canvas element is not keyboard reachable on its own. Giving it
  // tabindex 0 puts it in the tab order so keyboard users can reach the map
  // and drive the camera. See src/cesium/camera.ts for the key handling.
  const canvas = viewer.canvas;
  canvas.setAttribute("tabindex", "0");
  canvas.setAttribute("role", "application");
  canvas.setAttribute(
    "aria-label",
    "Interactive 3D globe. Use arrow keys to pan, plus and minus to zoom. " +
      "A table view of the same data is available below the map.",
  );

  // -------------------------------------------------------------------------
  // 8. Expose the viewer on `window`, for debugging and for the smoke test.
  // -------------------------------------------------------------------------
  // This is genuinely useful while you are learning: open the browser console
  // and type `cesiumViewer.camera.positionCartographic` to see where you are,
  // or `cesiumViewer.scene.globe.show = false` to hide the globe.
  //
  // There is nothing secret on this object — everything it exposes is already
  // running in the visitor's browser.
  (window as unknown as { cesiumViewer?: Viewer }).cesiumViewer = viewer;

  return { viewer, usingIon };
}

/**
 * Builds an OpenStreetMap imagery layer.
 *
 * Used both as the default when there is no token, and as the fallback when a
 * token turns out not to work. OpenStreetMap needs no key, which is what makes
 * it a dependable safety net.
 *
 * Note that OpenStreetMap's tile usage policy asks that heavy applications run
 * their own tile server. This is fine for learning and for small projects; if
 * your app gets real traffic, move to Cesium ion imagery or another provider.
 */
function createOpenStreetMapLayer(): ImageryLayer {
  return new ImageryLayer(
    new OpenStreetMapImageryProvider({
      url: "https://tile.openstreetmap.org/",
    }),
  );
}
