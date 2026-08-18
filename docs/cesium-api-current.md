# CesiumJS API — what is current, and what is gone

**Read this before writing any Cesium code.** Pinned version: **1.144.0**.
Checked against `node_modules/cesium/Source/Cesium.d.ts` in this repository.

CesiumJS replaced its synchronous constructors with async factory functions and
removed the old forms in **1.107**. Most Cesium code on the internet — and
inside AI models — predates that. Do not recall this API; look it up.

---

## Deprecated → current

Everything in the left column was **removed**. It does not warn; it throws, or
the property is simply `undefined`.

| Old (removed) | Current |
| --- | --- |
| `createWorldTerrain()` | `await createWorldTerrainAsync()` |
| `createOsmBuildings()` | `await createOsmBuildingsAsync()` |
| `new Cesium3DTileset({ url })` | `await Cesium3DTileset.fromUrl(url)` |
| `new Cesium3DTileset({ url: IonResource.fromAssetId(id) })` | `await Cesium3DTileset.fromIonAssetId(id)` |
| `new IonImageryProvider({ assetId })` | `await IonImageryProvider.fromAssetId(id)` |
| `new CesiumTerrainProvider({ url })` | `await CesiumTerrainProvider.fromUrl(url)` |
| `new CesiumTerrainProvider({ url: IonResource.fromAssetId(id) })` | `await CesiumTerrainProvider.fromIonAssetId(id)` |
| `new SingleTileImageryProvider({ url })` | `await SingleTileImageryProvider.fromUrl(url)` |
| `new ArcGisMapServerImageryProvider({ url })` | `await ArcGisMapServerImageryProvider.fromUrl(url)` |
| `new BingMapsImageryProvider({ url })` | `await BingMapsImageryProvider.fromUrl(url)` |
| `new TileMapServiceImageryProvider({ url })` | `await TileMapServiceImageryProvider.fromUrl(url)` |
| `Model.fromGltf()` | `await Model.fromGltfAsync()` |
| `I3SDataProvider` with `options.url` | `await I3SDataProvider.fromUrl(url)` |
| `provider.readyPromise` | `await` the factory function |
| `provider.ready` | gone — if the `await` returned, it is ready |
| `viewer.imageryProvider` option | `baseLayer: ImageryLayer` (or `false`) |
| `Model.readyPromise` | `Model.readyEvent` / `Model.errorEvent` |

### Traps that are not in the changelog

- **`createGooglePhotorealistic3DTileset()` has no `Async` suffix**, unlike
  every other factory of its generation. It is still awaited. It also needs
  `viewer.scene.globe.show = false` and no world terrain, or you get z-fighting.
- **`Scene` has `setTerrain()` but no `scene.terrain` getter.** Keep your own
  reference if you need the `Terrain` object later.
- **`Entity.id` is read-only.** Assigning to it throws. Put a top-level `"id"`
  on each GeoJSON feature instead; Cesium uses it automatically.
- **`Terrain.fromWorldTerrain()` is not a promise.** It returns a helper object
  immediately and loads in the background. Do not `await` it.
- **`OpenStreetMapImageryProvider` still has a plain constructor** and no
  `readyPromise`, which makes it the easy fallback when there is no token.
- **Node 22 or newer is required** as of CesiumJS 1.141.

---

## A known-good viewer bootstrap

Copy this rather than reconstructing it. It is what `src/cesium/createViewer.ts`
is built from.

```ts
import { Ion, Viewer, Terrain } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css"; // required, or widgets are unstyled

// Set the token BEFORE constructing the Viewer — it requests imagery immediately.
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

// Build terrain first so you can catch its errors.
const terrain = Terrain.fromWorldTerrain();
terrain.errorEvent.addEventListener((e) => console.warn("terrain failed", e));

const viewer = new Viewer("cesiumContainer", {
  terrain,
  infoBox: false,           // an iframe; poor for screen readers
  selectionIndicator: false,
  timeline: false,
  animation: false,
  requestRenderMode: false, // see docs/rendering-decisions.md
});
```

The container needs a real height. Cesium measures the element, and a `div` that
collapses to zero gives you a globe zero pixels tall — indistinguishable from a
broken build.

---

## Checking anything else

```bash
grep -n "createWorldTerrainAsync" node_modules/cesium/Source/Cesium.d.ts
less node_modules/cesium/CHANGES.md
```

The type definitions are generated from the source that builds the library, so
they cannot be out of date relative to what you are running. Trust them over
anything else, including this file.
