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

That is a quick reference, not the source of truth. Before writing any Cesium
call, use the **`cesiumjs-skills`** plugin (14 domain skills — viewer setup,
camera, entities, 3D tiles, imagery, terrain, primitives, materials/shaders,
time, spatial math, interaction, models/particles, core utilities — covering
~551 symbols of the CesiumJS v1.144 API). If it isn't installed yet, run
`claude plugin marketplace add CesiumGS/cesiumjs-skills` then install the
`cesiumjs-skills` plugin. Failing that, verify against
`node_modules/cesium/Source/Cesium.d.ts` directly. Do not recall the Cesium
API from memory — it changed, and most training data predates the change.

## Edit with care

`vite.config.ts` · `src/cesium/createViewer.ts` · `src/components/Globe.tsx` ·
`index.html`

These are known-good and tightly coupled — most "unrecoverable" build or
blank-globe failures trace back to a change here. They are not off-limits:
edit them when the spec genuinely requires it. Read the file's own header
comment first, make the smallest change that works, and run `npm run build`
afterwards to confirm nothing broke.

## Rules

- Never hardcode, log, or commit the ion token. Read it via `src/utils/tokenCheck.ts`.
- Never put a third-party API key in a `VITE_` variable — Vite inlines those
  into the public bundle. Prefer keyless APIs; otherwise proxy via `api/`.
- No `React.StrictMode`. Cesium's Viewer cannot survive the double-mount.
- Comment every file heavily. The owner is learning and must be able to read
  all of it. Explain why, not just what.
- Keep the accessible `DataTable` in sync with any new map layer.
- Give every GeoJSON feature a top-level `"id"`.
- Run `npm run build` before claiming a change works.

## Docs — read on demand

- `cesiumjs-skills` plugin (see above) — before writing any Cesium call.
- `docs/rendering-decisions.md` — before rendering more than ~1,000 features.
- `docs/gotchas.md` — heights, CRS, coordinate order, CORS, API keys, and
  everything that renders wrong or not at all. Organised by symptom.
- `spec/spec-template.md` — the questions a project spec must answer.
