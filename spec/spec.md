Markdown
# Product Specification: US National Parks 3D Explorer & Random Discovery Wheel

## 1. Product Overview

The US National Parks 3D Explorer is an interactive web application built with React, TypeScript, and CesiumJS. The application serves as an engaging discovery tool for the 63 Congressionally-designated US National Parks.

Users interact with a custom random discovery wheel (or direct map markers) to pick a park. When a park is selected, the 3D globe performs a smooth cinematic camera flight (`flyTo`) right into the park's coordinates with 3D terrain and tilted pitch, highlighting mountain peaks, canyons, and valleys. An informational overlay panel presents park overview data, high-resolution imagery, activities, and a direct link to the official NPS webpage.

All park data is fetched live from the official US National Park Service (NPS) REST API, cached via React Query, and converted into interactive 3D billboard markers on the Cesium globe.

---

## 2. System Architecture & Tech Stack

The project follows a standard Vite-based React architecture optimized for CesiumJS asset handling and reliable 3D globe lifecycle management:

- **Framework & Build Tool:** React 18 + TypeScript + Vite (`vite-plugin-cesium`).
- **3D Engine:** CesiumJS with Cesium World Terrain enabled via Cesium Ion.
- **Data Management:** `@tanstack/react-query` for API fetching, caching, and state synchronization.
- **Global UI State:** `zustand` for tracking selected park, spinning state, and UI panel visibility.
- **Styling:** Plain modular CSS without heavy CSS framework dependencies.
- **Environment:** Cesium Ion Token and NPS API Key loaded through Vite environment variables (`import.meta.env`).

### Core Architectural Rules
1. **No React.StrictMode:** `main.tsx` mounts the application without `React.StrictMode` to prevent double-mount lifecycle bugs on the WebGL `Cesium.Viewer` instance.
2. **Viewer Lifecycle:** A shared `viewerRef` (`React.MutableRefObject<Cesium.Viewer | null>`) resides in `App.tsx`. The `<Globe />` component initializes the viewer on mount, configures terrain, and calls `viewer.destroy()` in its cleanup function.
3. **Cesium Configuration:** `vite.config.ts` uses `vite-plugin-cesium` to automatically handle Cesium static asset bundling (workers, assets, widgets).
4. **Ion Token Validation:** `Cesium.Ion.defaultAccessToken` is set on startup from `import.meta.env.VITE_CESIUM_ION_TOKEN`. If missing or set to placeholder text, the app outputs a descriptive console warning.

---

## 3. Directory & File Structure

```text
us-national-parks-explorer/
├── .env.example                # Template for environment variables (CESIUM & NPS tokens)
├── index.html                  # HTML entry point
├── package.json                # Project dependencies and build scripts
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite config using react() and vite-plugin-cesium
└── src/
    ├── main.tsx                # Mounts QueryClientProvider and App (No StrictMode)
    ├── App.tsx                 # Root layout, holds viewerRef and mounts Globe + Overlays
    ├── index.css               # Base resets, typography, and theme variables
    ├── api/
    │   └── nps.ts              # NPS API fetch client, TypeScript types, and response adapters
    ├── store/
    │   └── useParkStore.ts     # Zustand store for selected park, wheel state, and modal open states
    ├── hooks/
    │   └── useParksQuery.ts    # React Query hook for caching the full 63 parks dataset
    ├── components/
    │   ├── globe/
    │   │   ├── Globe.tsx       # Cesium Viewer container, terrain setup, and entity click listeners
    │   │   ├── Globe.css       # Globe container positioning
    │   │   └── ParkMarkers.tsx # Declarative/imperative entity manager rendering pins for all parks
    │   └── ui/
    │       ├── Header.tsx      # App branding and status banner
    │       ├── SpinWheel.tsx   # Visual interactive spinning wheel & "Surprise Me" trigger
    │       ├── SpinWheel.css   # Keyframe wheel spin animations and pointer styling
    │       ├── ParkPanel.tsx   # Slide-in / modal card with photos, description, activities, official link
    │       └── ParkPanel.css   # Overlay styling, glassmorphism backdrop, and typography
4. Live Data Story & NPS API Integration
4.1. Endpoint Specification
The application queries the National Park Service API v1 parks endpoint:

URL: https://developer.nps.gov/api/v1/parks

Method: GET

Required Query Parameters:

limit=70 (Sufficient to fetch all 63 Congressionally-designated National Parks in a single page)

api_key: import.meta.env.VITE_NPS_API_KEY (Fallback supported using the public demo key DEMO_KEY if not configured)

Headers: Accept: application/json

4.2. Response Shape & Field Mapping
The API returns a JSON structure containing a data array of park objects.

Target Data Shape (Per Park):

TypeScript
interface NPSImage {
  url: string;
  altText: string;
  title: string;
  caption: string;
}

interface NPSActivity {
  id: string;
  name: string;
}

interface NPSParkItem {
  id: string;
  parkCode: string;
  fullName: string;
  description: string;
  latitude: string;
  longitude: string;
  designation: string;
  states: string;
  url: string;
  images: NPSImage[];
  activities: NPSActivity[];
}

export interface Park {
  id: string;
  parkCode: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  states: string;
  url: string;
  imageUrl: string;
  imageCaption: string;
  activities: string[];
}
4.3. Data Normalization & Filtering
Filtering: The response is filtered client-side to ensure strict inclusion of National Parks:
park.designation === "National Park" || park.fullName.includes("National Park")

Coordinate Parsing: latitude and longitude fields are cast from string to parseFloat(). Items without valid numeric coordinates are filtered out.

Caching: Stored with React Query under key ['nps-parks'] with staleTime: 1000 * 60 * 60 * 24 (24 hours), since park designations, coordinates, and core details are static.

5. CesiumJS 3D Globe Implementation
5.1. Viewer Configuration
The Cesium Viewer is configured with standard navigational controls stripped down for a modern web-app feel:

const viewer = new Cesium.Viewer(containerRef.current, {
  terrainProvider: await Cesium.createWorldTerrainAsync({
    requestWaterMask: true,
    requestVertexNormals: true
  }),
  animation: false,
  timeline: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  fullscreenButton: false,
  infoBox: false,
  selectionIndicator: false,
});
5.2. Park Billboard Markers
Every parsed park generates a Cesium.Entity in a dedicated CustomDataSource or the viewer's entities collection.

Marker Visuals: SVG pin canvas or circular pin with Cesium.Color.fromCssColorString('#2D6A4F').

Entity Properties: Each entity stores the raw Park data object in its properties field.

Interaction Handler: A Cesium.ScreenSpaceEventHandler captures LEFT_CLICK on the globe:

Runs viewer.scene.pick(movement.position).

If a park entity is clicked, updates the Zustand store's selectedPark and initiates camera flight.

5.3. Cinematic Camera Flight (flyTo)
When a park is selected (via wheel spin or entity click), the camera navigates using a tilted perspective that showcases topography:

viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(
    park.longitude,
    park.latitude - 0.04, // Offset south to frame the park looking north
    3500 // 3.5km elevation above ground for high-relief terrain
  ),
  orientation: {
    heading: Cesium.Math.toRadians(0), // Facing North
    pitch: Cesium.Math.toRadians(-25), // Tilted down toward the terrain
    roll: 0.0
  },
  duration: 3.0,
  easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
});
6. UI & Interaction Design
6.1. Discovery Wheel Component (SpinWheel.tsx)
Visuals: A circular overlay or bottom-docked roulette dial displaying names of loaded parks.

Spin Trigger: Clicking the "Spin the Wheel" or "Surprise Me" button selects a random index from the loaded parks array.

Animation: Uses CSS rotational transitions (transform: rotate(Ndeg)) with cubic-bezier(0.15, 0.9, 0.2, 1) over 3–4 seconds to produce deceleration.

Synchronization: Once rotation completes, the resulting park becomes selectedPark, the camera flies to the park coordinates, and the details panel opens.

6.2. Park Information Overlay (ParkPanel.tsx)
Position: Right-side sliding panel (desktop) or bottom sheet (mobile).

Contents:

Park full title and state badges (e.g., Yosemite National Park • CA).

Featured high-resolution landscape photo with attribution caption.

Descriptive paragraph from the NPS API.

Interactive chip list of designated activities (e.g., Hiking, Wildlife Watching, Camping).

External link button: "Visit Official NPS Website" opening park.url in a new tab with rel="noopener noreferrer".

Close button resetting selectedPark or dismissing the modal.

7. Configuration & Environment Variables
Create a .env file in the root directory:

Code snippet
# Cesium Ion Access Token (Required for 3D World Terrain and Imagery)
VITE_CESIUM_ION_TOKEN=your_cesium_ion_token_here

# National Park Service API Key (Register at [https://www.nps.gov/subjects/developer/api-documentation.htm](https://www.nps.gov/subjects/developer/api-documentation.htm))
VITE_NPS_API_KEY=your_nps_api_key_here
8. Code Implementation Guidelines for Coding Agent
Heavy Comments: All files must contain detailed inline comments explaining the CesiumJS Cartesian conversions, React Query caching configuration, and Zustand store updates.

Error Handling & Fallbacks: If the NPS API fails or hits a rate limit, provide a fallback JSON dataset containing the 63 National Parks so the globe and wheel remain functional.

Cleanup: Always destroy ScreenSpaceEventHandler and Cesium.Viewer on unmount to avoid WebGL context leaks.