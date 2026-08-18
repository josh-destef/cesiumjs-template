/**
 * camera.ts
 *
 * Everything about where the camera is and how it moves.
 *
 * Two things here are worth understanding before you change anything:
 *
 * 1. Camera flights are ANIMATIONS. Some people get motion sick from them,
 *    and some people have asked their operating system to reduce animation
 *    for exactly that reason. We check for that and jump instantly instead.
 *
 * 2. A 3D globe is normally unusable without a mouse. The keyboard controls
 *    at the bottom of this file are what make the map reachable for people
 *    who do not use one. Please do not remove them.
 */

import {
  Cartesian3,
  Math as CesiumMath,
  Rectangle,
  type Viewer,
} from "cesium";

/**
 * A plain longitude/latitude pair, in degrees.
 *
 * LONGITUDE comes first — in GeoJSON, and in every Cesium function that takes
 * degrees. Latitude first is what Google Maps shows and what people say out
 * loud, which is exactly why it trips people up. See docs/gotchas.md.
 */
export interface LonLat {
  /** East-west. Range -180 to 180. Negative is west of Greenwich. */
  longitude: number;
  /** North-south. Range -90 to 90. Negative is south of the equator. */
  latitude: number;
}

/**
 * Where the map starts.
 *
 * The example data is the national parks of the contiguous United States, so
 * we open on a view that contains all of them. Rectangle.fromDegrees takes
 * (west, south, east, north) — longitudes first, then latitudes.
 *
 * When you replace the example data, change this to match. A map that opens
 * looking at the wrong continent is the fastest way to make a good project
 * feel broken.
 */
export const HOME_VIEW = Rectangle.fromDegrees(-128.0, 22.0, -64.0, 51.0);

/**
 * How long a camera flight lasts, in seconds. Cesium's own default is a bit
 * slow once you are clicking through several features in a row.
 */
const FLIGHT_DURATION_SECONDS = 1.5;

/**
 * Has the person using this asked their operating system to reduce motion?
 *
 * This is a real accessibility setting (macOS: Reduce Motion, Windows: Show
 * animations in Windows). Browsers expose it through this media query. If it
 * is on, we still take the user where they asked to go — we just do not
 * animate the journey.
 *
 * We check this at call time rather than caching it, because someone can
 * change the setting while the page is open.
 */
export function prefersReducedMotion(): boolean {
  // matchMedia does not exist in some non-browser test environments, so we
  // guard against it rather than crashing.
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The flight duration to actually use: zero (an instant jump) when reduced
 * motion is requested, otherwise our normal duration.
 *
 * Cesium treats a duration of 0 as "go there immediately", which is exactly
 * the behaviour we want.
 */
function flightDuration(): number {
  return prefersReducedMotion() ? 0 : FLIGHT_DURATION_SECONDS;
}

/**
 * Sends the camera back to the starting view.
 */
export function flyHome(viewer: Viewer): void {
  viewer.camera.flyTo({
    destination: HOME_VIEW,
    duration: flightDuration(),
  });
}

/**
 * Puts the camera at the home view instantly, with no animation at all.
 *
 * Used once when the app first loads. Flying in from space on startup looks
 * impressive in a demo and is irritating every single time after that.
 */
export function setHomeViewImmediately(viewer: Viewer): void {
  viewer.camera.setView({ destination: HOME_VIEW });
}

/**
 * Flies the camera to a specific longitude/latitude and looks down at it.
 *
 * @param heightMetres How far above the point to stop. 150 km is a good
 *                     "one region" distance; drop to ~2 km for a building.
 */
export function flyToLonLat(
  viewer: Viewer,
  position: LonLat,
  heightMetres = 150_000,
): void {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(
      position.longitude,
      position.latitude,
      heightMetres,
    ),
    orientation: {
      // Heading is the compass direction the camera faces. 0 is north.
      heading: CesiumMath.toRadians(0),
      // Pitch is up/down. -90 degrees is looking straight down at the ground.
      // Note that Cesium wants RADIANS here, which is why we convert.
      pitch: CesiumMath.toRadians(-90),
      roll: 0,
    },
    duration: flightDuration(),
  });
}

// ---------------------------------------------------------------------------
// Keyboard controls
// ---------------------------------------------------------------------------

/**
 * How far one key press moves the camera, as a fraction of its current height
 * above the ground.
 *
 * Making this relative to height is what makes the controls feel right at
 * every zoom level: a fixed step in metres would crawl when you are looking at
 * a continent and fling you across the county when you are looking at a park.
 */
const PAN_FRACTION = 0.08;
const ZOOM_FRACTION = 0.25;

/**
 * Adds arrow-key panning and +/- zooming to the globe.
 *
 * Returns a cleanup function that removes the listener again. React effects
 * need that so we do not stack up duplicate handlers.
 *
 * The keys only do anything while the canvas itself has keyboard focus, which
 * is why createViewer.ts gives the canvas a tabindex. That restriction is
 * deliberate: if we listened on the whole window, arrow keys would hijack the
 * page while someone was trying to read the data table.
 */
export function installKeyboardControls(viewer: Viewer): () => void {
  const canvas = viewer.canvas;

  function onKeyDown(event: KeyboardEvent): void {
    const camera = viewer.camera;

    // How high are we? Used to scale every movement below.
    const height = camera.positionCartographic.height;
    const panStep = Math.max(height * PAN_FRACTION, 1);
    const zoomStep = Math.max(height * ZOOM_FRACTION, 1);

    // `handled` lets us call preventDefault only for keys we actually used,
    // so unrelated keys (Tab especially) keep working normally.
    let handled = true;

    switch (event.key) {
      case "ArrowUp":
        camera.moveUp(panStep);
        break;
      case "ArrowDown":
        camera.moveDown(panStep);
        break;
      case "ArrowLeft":
        camera.moveLeft(panStep);
        break;
      case "ArrowRight":
        camera.moveRight(panStep);
        break;

      // Both the main-row and numpad plus/minus, plus "=" because that is the
      // unshifted key where "+" lives on most keyboards.
      case "+":
      case "=":
        camera.zoomIn(zoomStep);
        break;
      case "-":
      case "_":
        camera.zoomOut(zoomStep);
        break;

      // Rotate the view without moving.
      case "[":
        camera.rotateLeft(CesiumMath.toRadians(5));
        break;
      case "]":
        camera.rotateRight(CesiumMath.toRadians(5));
        break;

      // A reliable way back when you have flown off somewhere confusing.
      case "Home":
        flyHome(viewer);
        break;

      default:
        handled = false;
    }

    if (handled) {
      // Stops the browser scrolling the page with the arrow keys as well as
      // moving our camera.
      event.preventDefault();
    }
  }

  canvas.addEventListener("keydown", onKeyDown);

  return () => {
    canvas.removeEventListener("keydown", onKeyDown);
  };
}
