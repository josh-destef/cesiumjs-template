// EDIT WITH CARE — this is known-good, tightly-coupled configuration.
// Most "unrecoverable" build failures in a Cesium project trace back to a
// change here. If the spec genuinely needs a change, read the three rules
// below first, make the change, and re-run `npm run build`.

/**
 * Globe.tsx
 *
 * The bridge between React and Cesium.
 *
 * These two libraries have opposite ideas about who owns the screen. React
 * wants to re-render whenever state changes. Cesium wants to create one WebGL
 * canvas, keep it, and manage it itself for the lifetime of the page. This
 * component is the small, careful piece of code that lets them coexist, and it
 * is the most fragile file in the project. Edit it carefully.
 *
 * Notice what this component does NOT do: it knows nothing about national
 * parks, or GeoJSON, or any particular dataset. It creates a viewer, tells you
 * when it is ready, and tells you when someone clicks something. All the
 * project-specific work happens in App.tsx, which you are very welcome to
 * edit.
 *
 * THE THREE RULES THIS FILE FOLLOWS:
 *
 *  1. Create the viewer exactly once. The effect below has an empty dependency
 *     array and must keep it. Re-creating a Cesium Viewer leaks GPU memory and
 *     eventually crashes the tab.
 *
 *  2. Always destroy the viewer on unmount. Cesium holds WebGL resources that
 *     the garbage collector cannot reclaim on its own.
 *
 *  3. Never let a changing prop re-run the setup effect. Callback props are
 *     kept in refs for exactly this reason — see the comment on `callbacks`.
 *
 * This is also why main.tsx does not use React.StrictMode. In development,
 * StrictMode deliberately mounts every component twice to help you find bugs.
 * A Cesium Viewer cannot survive that: the second mount attaches to a canvas
 * the first one already destroyed.
 */

import { useEffect, useRef, type ReactNode } from "react";
import {
  Entity,
  ScreenSpaceEventType,
  defined,
  type ScreenSpaceEventHandler,
  type Viewer,
} from "cesium";

import { createViewer } from "../cesium/createViewer";
import { installKeyboardControls, setHomeViewImmediately } from "../cesium/camera";

export interface GlobeProps {
  /**
   * Called once, as soon as the viewer exists. This is how the rest of the app
   * gets hold of the viewer so it can add layers to it.
   */
  onViewerReady: (viewer: Viewer, usingIon: boolean) => void;

  /** Called just before the viewer is destroyed, so you can clean up. */
  onViewerDestroy?: () => void;

  /**
   * Called when the user clicks the globe.
   *
   * Receives the id of the entity they clicked, or null if they clicked empty
   * space or the ocean. Deselecting by clicking away is behaviour people
   * expect, so we report the null rather than ignoring it.
   */
  onFeaturePick: (entityId: string | null) => void;

  /**
   * Called if Cesium ion rejects the token at runtime — a typo'd, revoked, or
   * under-scoped token. The globe falls back to OpenStreetMap imagery on its
   * own; this is so the app can explain why the map looks different.
   */
  onIonError?: (message: string) => void;

  /** Overlay UI drawn on top of the globe (panels, buttons, and so on). */
  children?: ReactNode;
}

export function Globe({
  onViewerReady,
  onViewerDestroy,
  onFeaturePick,
  onIonError,
  children,
}: GlobeProps) {
  /** The div Cesium will fill with its canvas. */
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Callback props, held in a ref.
   *
   * This looks odd, so it is worth explaining. The setup effect below must run
   * exactly once. If we listed the callbacks in its dependency array, then any
   * parent re-render that produced a new function identity would tear down and
   * rebuild the entire Cesium viewer. Storing them in a ref, and updating that
   * ref on every render, lets the effect always reach the LATEST callback while
   * still depending on nothing.
   */
  const callbacks = useRef({
    onViewerReady,
    onViewerDestroy,
    onFeaturePick,
    onIonError,
  });

  // Keep that ref pointing at the newest callbacks.
  //
  // This effect has NO dependency array, so it runs after every render. It is
  // also declared BEFORE the setup effect below, and React runs effects in the
  // order they are written — so on the very first mount this one has already
  // filled the ref by the time the viewer is created.
  //
  // (Assigning to a ref directly during render would be simpler to read, but
  // React does not allow it: renders are supposed to be side-effect free.)
  useEffect(() => {
    callbacks.current = {
      onViewerReady,
      onViewerDestroy,
      onFeaturePick,
      onIonError,
    };
  });

  useEffect(() => {
    const container = containerRef.current;

    // Should never happen — the ref is attached to a div rendered below — but
    // TypeScript cannot know that, and an early return is cheaper than a `!`.
    if (!container) {
      return;
    }

    // ---------------------------------------------------------------------
    // Create the viewer.
    // ---------------------------------------------------------------------
    const { viewer, usingIon } = createViewer(container, {
      // Forwarded through the ref so this effect still depends on nothing.
      onIonError: (message) => callbacks.current.onIonError?.(message),
    });

    // Start looking at the right part of the world immediately, with no
    // animation. Flying in from space on every page load gets old fast.
    setHomeViewImmediately(viewer);

    // Arrow keys, +/- and Home. See src/cesium/camera.ts.
    const removeKeyboardControls = installKeyboardControls(viewer);

    // ---------------------------------------------------------------------
    // Click handling.
    // ---------------------------------------------------------------------
    // Cesium has its own event system for the canvas, separate from React's.
    // `screenSpaceEventHandler` is the viewer's built-in one; using it means
    // we do not have to work out which pixel of the canvas was clicked.
    viewer.screenSpaceEventHandler.setInputAction(
      (movement: ScreenSpaceEventHandler.PositionedEvent) => {
        // scene.pick asks "what is drawn at this pixel?". It returns undefined
        // when the answer is "nothing" — for example the ocean or the sky.
        const picked = viewer.scene.pick(movement.position);

        // `defined` is Cesium's null-and-undefined check. When something was
        // picked, `picked.id` is the Entity it belongs to, and that Entity's
        // own `id` is the string we set in the layer file.
        if (defined(picked) && picked.id instanceof Entity) {
          callbacks.current.onFeaturePick(String(picked.id.id));
        } else {
          callbacks.current.onFeaturePick(null);
        }
      },
      ScreenSpaceEventType.LEFT_CLICK,
    );

    // Hand the viewer to the rest of the app.
    callbacks.current.onViewerReady(viewer, usingIon);

    // ---------------------------------------------------------------------
    // Cleanup. This runs when the component unmounts.
    // ---------------------------------------------------------------------
    return () => {
      callbacks.current.onViewerDestroy?.();
      removeKeyboardControls();

      // `isDestroyed()` guards against double cleanup. Destroying a viewer
      // twice throws, and that error would mask whatever actually went wrong.
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
    };

    // The empty dependency array is load-bearing. See rule 1 at the top.
  }, []);

  return (
    <div className="globe">
      {/*
        Cesium replaces the contents of this div with its own canvas and
        widgets. Do not render React children inside it — React and Cesium
        would fight over the same DOM nodes. Overlays go in the sibling below.
      */}
      <div ref={containerRef} className="globe__canvas" />

      {/*
        Overlay UI sits on top of the canvas, outside the div Cesium owns.
        This is a plain div rather than a <section> because the panels inside
        bring their own landmarks.
      */}
      <div className="globe__overlay">{children}</div>
    </div>
  );
}
