# Rendering decisions — how to draw a lot of things

**Read this before rendering more than about a thousand features.**

The single most common way a project dies is this: the data has 250,000
features, the tutorial used the Entity API, so the code creates 250,000
Entities. The tab freezes and never recovers. Nothing about the code looks
wrong. It is the wrong tool at that scale.

Pick by feature count first. This decision is very expensive to reverse.

| Features | Approach | Why |
| --- | --- | --- |
| **< 1,000** | Entity API (`GeoJsonDataSource`, `viewer.entities.add`) | Easiest to write, individually clickable, trivially styled. Cost per entity is high but the total is small. This is what the example layer uses, at 51. |
| **1,000 – 10,000** | Entity API, styled carefully | Still workable. Use points, not billboards or models. Cut label count hard. |
| **10,000 – 100,000** | Primitives (`PointPrimitiveCollection`, `BufferPointCollection`) or clustering | One draw call for the whole collection instead of one per feature. You lose `zoomTo`, entity picking, and time-varying properties — handle selection yourself with `scene.pick`. |
| **100,000 – 1,000,000** | Clustering, or `GeoJsonPrimitive` | Aggregate before drawing. Nobody can read a million points anyway. |
| **> 1,000,000** | Tile it to 3D Tiles, via Cesium ion | Streams only what is in view, at the detail the view needs. The only approach that actually scales. |

Boundaries are soft and depend on geometry complexity. **Halve every number if
mobile matters.**

Two things worth knowing about the middle rows:

- **Clustering does not reduce the number of entities** — only what is drawn. It
  fixes visual clutter; it will not rescue you from having built 250,000
  entities in the first place.

  ```ts
  dataSource.clustering.enabled = true;
  dataSource.clustering.pixelRange = 40;
  dataSource.clustering.minimumClusterSize = 3;
  ```

- **Data that changes over time belongs in CZML**, not in a timer that rebuilds
  the scene. Cesium interpolates between samples and gives you the timeline
  scrubber for free.

For a finished, static scene, `requestRenderMode: true` in
`src/cesium/createViewer.ts` is usually the single largest performance win —
Cesium then redraws only when something changes. The catch: call
`viewer.scene.requestRender()` after any change you make in code, or nothing
visibly happens. The template ships with it **off** so that a first attempt at
animating something is not silently ignored.
