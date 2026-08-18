# Agent instructions

Stack is fixed: React 19 + TypeScript + Vite + CesiumJS + vite-plugin-cesium +
@tanstack/react-query + zustand + plain CSS. Do not substitute or add to it.

Pinned: CesiumJS 1.144.0 · Node >= 22 · exact versions only, no `^` or `~`.

## Current CesiumJS API — the old synchronous forms were removed in 1.107

```ts
await Cesium.createWorldTerrainAsync();           // not createWorldTerrain()
await Cesium.createOsmBuildingsAsync();           // not createOsmBuildings()
await Cesium.Cesium3DTileset.fromUrl(url);        // not new Cesium3DTileset({url})
await Cesium.Cesium3DTileset.fromIonAssetId(id);
await Cesium.IonImageryProvider.fromAssetId(id);
await Cesium.GeoJsonDataSource.load(data, opts);
Cesium.createGooglePhotorealistic3DTileset();     // note: NO "Async" suffix
viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain());
// .ready and .readyPromise are gone from every provider — use await.
// Scene has setTerrain() but NO scene.terrain getter.
// Entity.id is READ-ONLY. Set a top-level "id" on the GeoJSON feature instead.
```

Verify anything not listed here against `node_modules/cesium/Source/Cesium.d.ts`.
Do not recall the Cesium API from memory — it changed, and most training data
predates the change.

## Do not edit

`vite.config.ts` · `src/cesium/createViewer.ts` · `src/components/Globe.tsx` ·
`index.html`

If a change seems to require editing one, stop and tell the user instead.

## Rules

- Never hardcode, log, or commit the ion token. Read it via `src/utils/tokenCheck.ts`.
- Never put a third-party API key in a `VITE_` variable — Vite inlines those
  into the public bundle. Prefer keyless APIs; otherwise proxy via `api/`.
- No `React.StrictMode`. Cesium's Viewer cannot survive the double-mount.
- Comment every file heavily. The owner is learning and must be able to read
  all of it. Explain why, not just what.
- Keep the accessible `DataTable` in sync with any new map layer.
- Give every GeoJSON feature a top-level `"id"`.
- Run `npm run build && npm test` before claiming a change works.

## Docs — read on demand

- `docs/cesium-api-current.md` — before writing any Cesium call.
- `docs/rendering-decisions.md` — before rendering more than ~1,000 features.
- `docs/gotchas.md` — heights, CRS, coordinate order, CORS, API keys, and
  everything that renders wrong or not at all. Organised by symptom.
- `spec/spec-template.md` — the questions a project spec must answer.
