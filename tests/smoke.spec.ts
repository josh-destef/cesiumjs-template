/**
 * smoke.spec.ts
 *
 * One test that answers one question: does this app actually work?
 *
 * It is called a "smoke test" after the hardware practice of switching a new
 * board on and seeing whether smoke comes out. It does not check every detail.
 * It checks that the thing runs at all.
 *
 * The assertion that matters most is the one about pixels. A Cesium app that
 * is completely broken — no token, missing assets, a bad build — usually still
 * loads its HTML, still creates a canvas, and still reports no errors. It just
 * renders nothing. Every other check here would pass. So we look at the actual
 * rendered image and demand that it not be uniformly one colour, which is the
 * only reliable way to catch the blank-globe failure automatically.
 */

import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";
import { PNG } from "pngjs";

/** How many features public/data/example.geojson contains. */
const EXPECTED_FEATURE_COUNT = 51;

/**
 * The area the camera should be looking at when the app opens, with a generous
 * margin. This catches a camera left pointing at the default view over the
 * Pacific, which is what you get when the home view is not applied.
 */
const EXPECTED_CAMERA_BOUNDS = {
  west: -140,
  east: -55,
  south: 10,
  north: 60,
};

/**
 * A minimal description of the bits of the Cesium viewer this test reads.
 *
 * The real Viewer type is enormous, and importing Cesium into the test would
 * mean bundling it for Node. Describing just what we touch is simpler and
 * makes the test's dependencies obvious.
 */
interface TestViewerWindow extends Window {
  cesiumViewer?: {
    scene: {
      globe: { tilesLoaded: boolean };
    };
    camera: {
      positionCartographic: { longitude: number; latitude: number; height: number };
    };
    dataSources: {
      length: number;
      get(index: number): { entities: { values: unknown[] } };
    };
    isDestroyed(): boolean;
  };
}

test.describe("CreateAccess Cesium template", () => {
  /** Console errors collected during the run, asserted at the end. */
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];

    page.on("console", (message: ConsoleMessage) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    // An uncaught exception is always a failure, even if nothing logged it.
    page.on("pageerror", (error: Error) => {
      consoleErrors.push(`Uncaught exception: ${error.message}`);
    });
  });

  test("loads, renders a globe, and shows the example layer", async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // 1. The page loads and the canvas exists
    // -----------------------------------------------------------------------
    await page.goto("/");

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();

    // A canvas with no size renders nothing, and is a common CSS mistake.
    const box = await canvas.boundingBox();
    expect(box, "the canvas should have a bounding box").not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.height).toBeGreaterThan(200);

    // -----------------------------------------------------------------------
    // 2. The globe finishes loading its tiles
    // -----------------------------------------------------------------------
    // tilesLoaded goes true once Cesium has everything it needs for the
    // current view. Waiting for it means the screenshot below is of a finished
    // globe rather than a half-drawn one.
    await waitForGlobeReady(page);

    // -----------------------------------------------------------------------
    // 3. The rendered image is not blank
    // -----------------------------------------------------------------------
    // THIS IS THE IMPORTANT ONE. See the note at the top of the file.
    const screenshot = await canvas.screenshot();
    const image = PNG.sync.read(screenshot);
    const stats = describePixels(image);

    expect(
      stats.distinctColors,
      "the globe rendered as a flat, single-coloured image, which almost " +
        "always means it did not render at all — check the ion token and " +
        "that the Cesium static assets were copied into dist/",
    ).toBeGreaterThan(20);

    expect(
      stats.nonBlackFraction,
      "almost every pixel was black, so nothing appears to have been drawn",
    ).toBeGreaterThan(0.05);

    // -----------------------------------------------------------------------
    // 4. The example layer loaded the expected number of features
    // -----------------------------------------------------------------------
    const entityCount = await page.evaluate(() => {
      const viewer = (window as TestViewerWindow).cesiumViewer;

      if (!viewer || viewer.dataSources.length === 0) {
        return -1;
      }

      return viewer.dataSources.get(0).entities.values.length;
    });

    expect(
      entityCount,
      "the example GeoJSON layer should be on the globe",
    ).toBe(EXPECTED_FEATURE_COUNT);

    // The same count should be visible to a human, in the table.
    await expect(
      page.getByText(`The same ${EXPECTED_FEATURE_COUNT} parks`),
    ).toBeVisible();

    // -----------------------------------------------------------------------
    // 5. The camera is looking at the right part of the world
    // -----------------------------------------------------------------------
    const camera = await page.evaluate(() => {
      const viewer = (window as TestViewerWindow).cesiumViewer;

      if (!viewer) {
        return null;
      }

      const position = viewer.camera.positionCartographic;
      const degrees = 180 / Math.PI;

      return {
        longitude: position.longitude * degrees,
        latitude: position.latitude * degrees,
        height: position.height,
      };
    });

    expect(camera, "the viewer should be reachable on window").not.toBeNull();
    expect(camera!.longitude).toBeGreaterThan(EXPECTED_CAMERA_BOUNDS.west);
    expect(camera!.longitude).toBeLessThan(EXPECTED_CAMERA_BOUNDS.east);
    expect(camera!.latitude).toBeGreaterThan(EXPECTED_CAMERA_BOUNDS.south);
    expect(camera!.latitude).toBeLessThan(EXPECTED_CAMERA_BOUNDS.north);
    // Somewhere above the ground, and not out past the moon.
    expect(camera!.height).toBeGreaterThan(1_000);
    expect(camera!.height).toBeLessThan(50_000_000);

    // -----------------------------------------------------------------------
    // 6. Save a screenshot as a build artifact
    // -----------------------------------------------------------------------
    // Reviewing this by eye after a CI run is the fastest way to notice that
    // something looks wrong but still technically passes.
    await page.screenshot({
      path: "test-results/artifacts/globe.png",
      fullPage: false,
    });

    // -----------------------------------------------------------------------
    // 7. Nothing logged an error
    // -----------------------------------------------------------------------
    // Checked last so that a genuine rendering failure above is reported as
    // the rendering failure it is, rather than as a wall of console noise.
    expect(consoleErrors, "the console should be clean").toEqual([]);
  });

  test("selecting a park from the table updates the info panel", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForGlobeReady(page);

    // The table is the accessible path through the app, so it is the one worth
    // testing: if this works, the app is usable without a mouse.
    await page.getByRole("button", { name: "Yellowstone" }).click();

    const infoPanel = page.getByRole("complementary", {
      name: "Selected park details",
    });

    await expect(infoPanel).toContainText("Yellowstone");
    await expect(infoPanel).toContainText("Wyoming");
    await expect(infoPanel).toContainText("1872");

    expect(consoleErrors).toEqual([]);
  });

  test("the globe canvas is reachable with the keyboard", async ({ page }) => {
    await page.goto("/");
    await waitForGlobeReady(page);

    // Focus the canvas the way a keyboard user would reach it, then confirm it
    // actually took focus. A canvas without tabindex silently cannot.
    await page.locator("canvas").first().focus();

    const focusedTag = await page.evaluate(
      () => document.activeElement?.tagName,
    );

    expect(focusedTag).toBe("CANVAS");
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Waits until Cesium reports that it has everything it needs for the current
 * view, then waits one more beat for the final frame to be presented.
 */
async function waitForGlobeReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const viewer = (window as TestViewerWindow).cesiumViewer;
      return Boolean(viewer && !viewer.isDestroyed() && viewer.scene.globe.tilesLoaded);
    },
    undefined,
    { timeout: 60_000 },
  );

  // tilesLoaded flips true when the data is ready, which can be a frame before
  // it is actually drawn. This gives the compositor time to catch up so the
  // screenshot is of the finished image.
  await page.waitForTimeout(1_500);
}

/**
 * Summarises a rendered image so we can tell "a picture of a globe" from "a
 * flat rectangle of nothing".
 *
 * Colours are bucketed into 32-value steps before counting. Without that,
 * anti-aliasing and sky gradients alone would produce thousands of technically
 * distinct colours and the check would pass on an almost-blank image.
 */
function describePixels(image: PNG): {
  distinctColors: number;
  nonBlackFraction: number;
} {
  const colors = new Set<number>();
  let nonBlack = 0;
  let total = 0;

  // Sample every 4th pixel in each direction. Looking at every pixel of a
  // 1280x800 image is a million iterations for no extra confidence.
  for (let y = 0; y < image.height; y += 4) {
    for (let x = 0; x < image.width; x += 4) {
      const index = (image.width * y + x) << 2;

      const red = image.data[index];
      const green = image.data[index + 1];
      const blue = image.data[index + 2];

      total++;

      // "Not black" allows for a very dark but non-zero background.
      if (red > 12 || green > 12 || blue > 12) {
        nonBlack++;
      }

      const bucket =
        ((red >> 5) << 10) | ((green >> 5) << 5) | (blue >> 5);
      colors.add(bucket);
    }
  }

  return {
    distinctColors: colors.size,
    nonBlackFraction: total === 0 ? 0 : nonBlack / total,
  };
}
