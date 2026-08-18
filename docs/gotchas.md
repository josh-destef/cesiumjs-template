# Gotchas and troubleshooting

Find your symptom. Under each one, causes are ordered by how often they turn out
to be the answer.

**First, open the browser console** — `F12`, or `Ctrl+Shift+I` (`Cmd+Option+I`
on a Mac). Most of the answers below are already written there.

---

## Check your data before you build

Answer these by opening the file, or the API response, and looking. Each one
changes what you build, and all are cheaper to answer now than halfway through.

- **Geometry type** — `Point`, `LineString`, `Polygon`, or a mixture? Points are
  cheap; large polygons are not.
- **Feature count** — the length of the `features` array. This decides the
  rendering approach; see `docs/rendering-decisions.md`.
- **Coordinate order** — GeoJSON is **longitude first**: `[-110.5885, 44.4280]`.
  If the first number is within -90 to 90 and the second is not, they are
  probably swapped.
- **Bounding box** — min and max of each coordinate. If it does not cover the
  part of the world you expect, stop here; everything downstream is wrong.
- **CRS** — coordinates outside -180/180 and -90/90 mean a projected coordinate
  system, not `EPSG:4326`. Six- and seven-digit numbers are the giveaway.
- **Altitude** — a third coordinate value or a height field? If so, in what
  datum: ellipsoidal, or mean sea level? See "Points are underground".
- **Time fields** — timestamps mean a timeline rather than a static layer. Check
  they carry an explicit UTC offset.
- **Ids** — does each feature have a top-level `"id"`? Cesium uses it as the
  Entity id, which is what links a click on the globe back to your data.

For a remote URL, check a browser is allowed to fetch it at all:

```bash
curl -I -H "Origin: http://localhost:5173" <the real URL>
```

Look for `Access-Control-Allow-Origin`. If it is absent, see "Remote data will
not load" — that changes the plan, so find out now rather than later.

---

## The globe is blank, black, or plain blue

**1. No ion token, or still the placeholder.** A yellow banner across the app
and a warning in the console. Get a token at
[ion.cesium.com/tokens](https://ion.cesium.com/tokens) (**create a new one**,
not the "Default Token" — the README explains why), copy `.env.example` to
`.env.local`, paste it in, then **stop and restart the dev server**. Vite reads
`.env.local` only at startup, and this step is missed constantly.

The template still works without a token — it falls back to OpenStreetMap
imagery and a smooth globe. A map with no 3D terrain is that.

**2. The token exists but is not authorised.** An orange "Cesium ion problem"
banner, plus `401`/`403` on `api.cesium.com` or `assets.cesium.com`. The token
needs the `assets:read` scope and must cover the assets you use — Cesium World
Terrain is asset **1**, Bing imagery asset **2**. Restrict a token to a custom
asset only and the defaults fail.

**3. The container has no height.** Console clean, nothing on screen: inspect
`div.globe__canvas`. If its height is `0px`, Cesium has nowhere to draw. It
sizes its canvas from the container, and a container whose height depends on its
contents collapses to zero. `src/styles.css` gives `.app__main` an explicit
height for this reason.

**4. WebGL is unavailable.** Check [get.webgl.org](https://get.webgl.org/). If
it is off, the problem is the browser or the machine, not your code.

---

## It works with `npm run dev`, but breaks after `npm run build`

A static asset is missing from the built output. Cesium needs a folder of
runtime files — workers, shaders, fonts — that are not part of the JS bundle.

```bash
npm run build
ls dist/cesium        # should list Assets, Widgets, Workers, ThirdParty
```

Empty or missing means `vite-plugin-cesium` did not run, and **almost always
that `vite.config.ts` was edited**. Adding `vite-plugin-static-copy`, a manual
`define` for `CESIUM_BASE_URL`, or copy targets *conflicts* with the plugin.
That file is marked EDIT WITH CARE because of this exact failure.

Run `npm run build && npm run preview` before every deploy. Twenty seconds here
catches the whole class of bug that only appears in production.

---

## My data is in the wrong place entirely

- **In the ocean off West Africa** (near 0°, 0°) — coordinates are missing,
  zero, or `NaN`. Something failed to parse.
- **Mirrored, or in the wrong hemisphere** — longitude and latitude are swapped.
  GeoJSON and every Cesium function taking degrees are **longitude first**:
  `Cartesian3.fromDegrees(longitude, latitude, height)`. Google Maps, spoken
  English and most spreadsheets are the other way round, which is why this is
  the most common geospatial bug there is. Validate on load: every valid
  latitude is within -90 to 90, so `Math.abs(latitude) > 90` means swapped.
  `src/layers/ExampleGeoJsonLayer.ts` does this and skips bad rows with a
  warning rather than failing the whole load.
- **Millions of kilometres away, or nowhere visible** — the data is in a
  projected CRS. CesiumJS speaks only `EPSG:4326` and has no transformation
  engine. Usual culprits: Web Mercator `EPSG:3857` (`-12300000, 4200000`),
  State Plane `EPSG:2263` (`985000, 210000`), UTM, British National Grid.

[RFC 7946](https://datatracker.ietf.org/doc/html/rfc7946) says GeoJSON is
*always* `EPSG:4326` and deprecates the old `"crs"` member — so a file can be
projected, declare it, and every reader will still treat it as degrees. Convert
once, before it reaches your app:

```bash
ogr2ogr -f GeoJSON -t_srs EPSG:4326 out.geojson in.geojson
ogr2ogr -f GeoJSON -s_srs EPSG:2263 -t_srs EPSG:4326 out.geojson in.shp
```

```python
from pyproj import Transformer
t = Transformer.from_crs("EPSG:2263", "EPSG:4326", always_xy=True)
lon, lat = t.transform(985000, 210000)   # always_xy forces longitude first
```

---

## Points are underground, floating, or ~30 m off

Two different answers to "how high is this?":

- **Ellipsoid height (HAE)** — above a smooth mathematical model of the Earth.
  What **GPS receivers and CesiumJS** use.
- **Orthometric height (MSL)** — above the **geoid**, a model of mean sea level.
  What **survey data, LiDAR, government elevation data and aviation charts** use.

They differ by the geoid separation: **-105 m to +85 m** worldwide, typically
**-20 m to -35 m** across the continental US. Plot survey data without
converting and everything sits consistently ~30 m underground. It looks like a
code bug; it is a datum mismatch. Convert with a geoid model (`EGM96`,
`EGM2008`, `GEOID18`) using `pyproj` or `gdalwarp` — or sidestep it by clamping.

```ts
const dataSource = await GeoJsonDataSource.load(url, { clampToGround: true });
entity.point = new PointGraphics({ heightReference: HeightReference.CLAMP_TO_GROUND });
```

| Value | Meaning |
| --- | --- |
| `NONE` | Use the height in the data, measured from the ellipsoid. |
| `CLAMP_TO_GROUND` | Ignore the data's height; sit on the terrain surface. |
| `RELATIVE_TO_GROUND` | The data's height means metres **above the terrain**. |
| `CLAMP_TO_TERRAIN` / `RELATIVE_TO_TERRAIN` | As above, ignoring 3D Tiles surfaces. |
| `CLAMP_TO_3D_TILE` / `RELATIVE_TO_3D_TILE` | Clamp to a tileset, e.g. a roof. |

Clamp when the data has no height, has heights in an unknown datum, or sits on
the ground anyway. Use `RELATIVE_TO_GROUND` for drone altitudes and building
heights, `NONE` for genuine ellipsoidal heights and for aircraft or satellites.

Clamping costs performance — Cesium samples terrain per feature, which is fine
for hundreds and noticeable for tens of thousands. Clamped things can also hide
behind terrain between them and the camera; fix that with
`disableDepthTestDistance: Number.POSITIVE_INFINITY`, as the example layer does.

To read terrain heights yourself:

```ts
const updated = await sampleTerrainMostDetailed(viewer.terrainProvider, [
  Cartographic.fromDegrees(-110.58, 44.42),
]);
console.log(updated[0].height); // metres above the WGS84 ellipsoid
```

---

## Remote data will not load (CORS)

```
Access to fetch at 'https://api.example.com/data' from origin
'http://localhost:5173' has been blocked by CORS policy
```

The browser is protecting the user and **you cannot fix this from your own
code**. No fetch option, no header you add, no Vite setting changes what the
other server sends. The request often shows `200` in the Network tab while your
code still gets an error.

Options, best first:

1. **Use an API that sets CORS headers.** Test before designing around one:
   `curl -I -H "Origin: http://localhost:5173" <url>`
2. **Proxy through a serverless function** — server-to-server requests are not
   subject to CORS. See the next section.
3. **Download the data once** into `public/data/` if it changes rarely. Faster
   and more reliable for anything static.

A dev-only Vite proxy works locally and breaks the moment you deploy, so do not
build on it. **Never** use a public "CORS proxy" service for anything real — you
hand your traffic, and any credentials in it, to a stranger.

---

## An API key that must stay secret

Vite writes every `VITE_` variable **directly into the JavaScript bundle** every
visitor downloads. It is readable in DevTools in ten seconds. `.gitignore` keeps
a key out of your repository; it does nothing about your deployed site.

- **Public but scoped** — a Cesium ion `assets:read` token is *designed* to be
  sent to the browser, and is safe because it is restricted to specific assets
  and URLs. `VITE_` is the right place for it.
- **Secret** — weather, geocoding, traffic and satellite keys are billed to you
  and usually cannot be restricted by referrer. Publishing one lets anyone spend
  your quota. These must never reach the browser.

Prefer keyless public APIs (USGS, NOAA, Open-Meteo, OpenStreetMap Nominatim).
Where a secret key is unavoidable, put it in a serverless function: on Vercel a
file in an `api/` directory becomes an endpoint, reads the key from a normal
(non-`VITE_`) environment variable set in the project dashboard, calls the
upstream service, and returns the result. The key stays on the server — and the
CORS problem above disappears with it.

---

## Deprecation warnings, or a `TypeError` on a function you are sure exists

CesiumJS removed its synchronous constructors in **1.107** and most tutorials
predate that. Use the **`cesiumjs-skills`** plugin (14 domain skills covering
the current API — see the "Docs" section of `AGENTS.md`) instead of recalling
it from memory.

```ts
await createWorldTerrainAsync();            // not createWorldTerrain()
await Cesium3DTileset.fromUrl(url);         // not new Cesium3DTileset({url})
await createOsmBuildingsAsync();            // not createOsmBuildings()
// .ready and .readyPromise are gone — use await.
```

---

## `Cannot set property id of #<Entity> which has only a getter`

`Entity.id` is read-only. Put a top-level `"id"` on each GeoJSON **feature**
instead — Cesium uses it automatically:

```json
{ "type": "Feature", "id": "YELL", "properties": { "name": "Yellowstone" },
  "geometry": { "type": "Point", "coordinates": [-110.5885, 44.4280] } }
```

---

## The globe flickers, or the app crashes on reload

Usually `React.StrictMode`, which mounts every component twice in development. A
Cesium Viewer cannot survive that — the second mount attaches to a canvas the
first already destroyed. There must be **no** `<React.StrictMode>` in
`src/main.tsx`; the reasoning is commented there.

Also check `src/components/Globe.tsx` still has an **empty dependency array** on
its setup effect. A dependency creeping in rebuilds the viewer every render.

---

## Everything is slow, or the tab freezes

Almost certainly too many entities — see `docs/rendering-decisions.md`.

```ts
console.log(viewer.dataSources.get(0).entities.values.length);
```

Over ~10,000 the Entity API is the wrong tool; over ~100,000 the tab will not
recover. For a finished static scene, `requestRenderMode: true` in
`src/cesium/createViewer.ts` is the largest easy win — but then call
`viewer.scene.requestRender()` after any change you make in code.

---

## `npm install` fails

- **`EBADENGINE`** — Node is too old. CesiumJS 1.141+ needs **Node 22+**.
- **Permission errors on Mac/Linux** — never `sudo npm install`; it creates
  root-owned files that break later installs. Use [nvm](https://github.com/nvm-sh/nvm).
- **Lockfile conflicts** — `rm -rf node_modules package-lock.json && npm install`,
  deliberately only: the lockfile is committed so everyone gets identical
  versions.

---

## The deployed site is broken but localhost is fine

1. **The environment variable is not set on Vercel.** `VITE_CESIUM_ION_TOKEN`
   must be added in project settings *before* the build — `.env.local` is
   gitignored and never reaches Vercel. Vite bakes the value in at build time,
   so after adding it you must **redeploy**.
2. **Token URL restrictions.** Restricted to `localhost`? Add your
   `*.vercel.app` domain too.
3. **The build did not actually succeed.** Read the full Vercel build log — a
   failed build often still serves an older deployment.

---

## Smaller things worth knowing

- **Antimeridian crossing.** A polygon spanning ±180° may render as a band the
  wrong way round the planet. Split it in two at the antimeridian.
- **Polygon winding.** Outer rings counter-clockwise, holes clockwise. Inverted
  winding can cover everything *except* the intended area.
- **Degrees are not a distance.** One degree of latitude is ~111 km everywhere;
  one degree of longitude is ~111 km at the equator and ~0 at the poles. Use
  `Cartesian3.distance`, or `EllipsoidGeodesic` for surface distance.
- **Precision.** Six decimals is ~0.1 m. Beyond that you are storing noise, and
  trimming can shrink a large file substantially.
- **Time zones.** Cesium's clock is UTC. Local timestamps with no offset are
  wrong by hours — convert to ISO 8601 with an explicit offset first.

---

## Still stuck

Bring the exact console error (copied, not paraphrased), what you expected,
whether it happens in `dev` / `preview` / deployed, and your `node --version`.

**Never paste your ion token** into an issue, a chat, or a screenshot. If you
have exposed one, revoke it at
[ion.cesium.com/tokens](https://ion.cesium.com/tokens) and create a new one.
