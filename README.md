# CreateAccess — 3D Map Template

A ready-to-run starting point for building 3D geospatial web apps with
[CesiumJS](https://cesium.com/platform/cesiumjs/). Clone it, run two commands,
and you have a working globe with real data on it before writing a line of code.
Then you replace the example data with your own.

**You do not need to understand any of this yet.** Follow the steps below.

You get a 3D globe with 51 national parks on it, click-to-select with a details
panel, a keyboard-accessible data table showing the same features as text,
loading and error states, and every file heavily commented for someone who has
not seen React or Cesium before.

---

## Getting started

You need **Node.js 22 or newer** ([nodejs.org](https://nodejs.org), take the LTS
version) and **Git** ([git-scm.com](https://git-scm.com)). Check by opening a
terminal and running `node --version` and `git --version`. Node 22 is a hard
requirement — CesiumJS will not install on older versions.

1. **Make your own copy.** Click the green **"Use this template"** button at the
   top of this repository's GitHub page, then **"Create a new repository"**.
   Not Fork, and not Download: a template gives you a fresh repository that
   belongs to you, with no shared history, ready to connect to Vercel.

2. **Get it onto your computer.** On *your new repository's* page, click the
   green **Code** button and copy the URL, then:

   ```bash
   git clone <paste the URL here>
   cd <your-repository-name>
   ```

3. **Install and run.**

   ```bash
   npm install
   npm run dev
   ```

   `npm install` takes a minute or two the first time. `npm run dev` prints a
   web address — usually `http://localhost:5173`. Open it, and **you should see
   a globe with green dots across the United States.** If you do not, go to
   [docs/gotchas.md](docs/gotchas.md).

4. **Add a Cesium ion token.** The app works without one, using OpenStreetMap
   imagery. For 3D terrain — real mountains — sign up free at
   [ion.cesium.com](https://ion.cesium.com), go to **Access Tokens**, and click
   **Create token**. Tick the **`assets:read`** scope only, and under asset
   restrictions select **Cesium World Terrain (asset 1)** and **Bing Maps Aerial
   (asset 2)**. Then:

   ```bash
   cp .env.example .env.local        # Windows: copy .env.example .env.local
   ```

   Paste the token after the `=` sign, then **stop the dev server (`Ctrl+C`) and
   run `npm run dev` again.** That last step catches people out every time —
   Vite only reads `.env.local` when it starts.

5. **Write your spec.** Answer the questions in
   [spec/spec-template.md](spec/spec-template.md) — as prose, in your own
   words — and save your answers as `spec/spec.md`. This is *your* job, not
   your AI agent's: data sources, coordinate systems, and feature counts are
   project decisions, and a spec written by the agent is the agent guessing at
   your own requirements. Once `spec/spec.md` exists, hand it to your AI agent
   (Claude Code, Cursor, or similar) and ask it to build your project from it.

---

## The core commands

```bash
npm install     # Install dependencies. Run once, and after any git pull.
npm run dev     # Start the development server. The one you use daily.
npm run build   # Build the production version into dist/.
npm run preview # Serve that build locally, to check it before deploying.
```

**Always run `npm run build && npm run preview` before you deploy.** A handful
of problems only appear in the production build, and twenty seconds here saves a
confusing afternoon later.

---

## About that token — please read this properly

Putting your token in a gitignored `.env.local` does **not** keep it off the
web, and believing it does is how tokens get abused.

Vite takes every variable starting with `VITE_` and **writes its value directly
into the JavaScript file** it builds. Every visitor downloads that file. Anyone
can open DevTools and read your token in about ten seconds. `.gitignore` keeps
it out of your *source repository*. It does nothing about your *deployed site*.

So the useful distinction is not hidden versus visible:

```
SECRET             → Server-side only. The browser must never receive it.
                     Weather API keys, database passwords, payment keys.

PUBLIC BUT SCOPED  → The browser DOES receive it, and that is fine, because it
                     can only do a small, harmless set of things.
                     A Cesium ion assets:read token is this kind.
```

An ion token is designed to be public. It is safe **only** because you restrict
it, so restrict it: `assets:read` scope only, limited to the specific assets you
use, and limited by URL to `http://localhost:5173` plus your
`https://your-project.vercel.app` domain.

**Do not use the Default Token.** Every ion account has one and it is tempting,
but it cannot be edited, restricted, or deleted, and it grants read access to
every asset on your account — including anything you upload later. Creating a
new token takes thirty seconds.

If your project needs a *third-party* key (weather, geocoding, traffic), that
one is almost certainly secret and must never go in a `VITE_` variable. Prefer
keyless public APIs; otherwise proxy it. See
[docs/gotchas.md](docs/gotchas.md#an-api-key-that-must-stay-secret).

---

## What to edit, and what to leave alone

Edit freely: `src/layers/ExampleGeoJsonLayer.ts` (**start here** — the one
example, replace it with your data), `src/App.tsx` (wires everything together),
`src/components/InfoPanel.tsx`, `src/components/DataTable.tsx` (keep it; change
the columns), `src/cesium/camera.ts` (where the map opens, and the keyboard
controls), `src/styles.css`, `src/layers/tilesets.ts` (see below), and
`public/data/`.

Edit these four with care:

```
vite.config.ts
src/cesium/createViewer.ts
src/components/Globe.tsx
index.html
```

Each carries an `EDIT WITH CARE` header. They are where a small,
reasonable-looking change produces a failure that looks like something else
entirely — a blank globe, or a build that works locally and breaks in
production. They are not off-limits — read the file's header comment first,
make the smallest change that works, and run `npm run build` afterwards.

`src/cesium/createViewer.ts` carries one deliberate exception, commented where
it happens: the geocoder is enabled (pointed at Google) whenever an ion token
is present, because Google Photorealistic 3D Tiles below requires it. That is
a considered one-line change baked into the template, not something to revert.

---

## Adding a 3D tileset

`src/layers/tilesets.ts` has ready-made `add.../remove...` functions for the
tilesets most projects reach for: Google Photorealistic 3D Tiles (a real
textured mesh instead of flat imagery on a heightmap), Cesium OSM Buildings (a
global 3D buildings layer), and any other asset in your ion account by id.
None of them are wired in by default — import the one you want and call it
once you have a viewer, the same place `ExampleGeoJsonLayer.ts`'s layer gets
attached in `App.tsx`.

Each needs its own asset enabled on your ion token — `assets:read` alone does
not grant access to a specific asset. See `.env.example` and the comments in
`src/layers/tilesets.ts` for the specifics, particularly for Google
Photorealistic 3D Tiles, which also requires the Google geocoder — already
handled for you, see the note above.

---

## Where the documentation lives

| File | Read it when |
| --- | --- |
| **[docs/gotchas.md](docs/gotchas.md)** | Something is broken, or before you commit to a dataset. Organised by symptom. **Start here.** |
| [CesiumGS/cesiumjs-skills](https://github.com/CesiumGS/cesiumjs-skills) | Before writing any Cesium code. 14 API-domain skills covering the current API; the API changed in 1.107 and most tutorials are out of date. Add it with `claude plugin marketplace add CesiumGS/cesiumjs-skills`. |
| [docs/rendering-decisions.md](docs/rendering-decisions.md) | Before rendering more than ~1,000 features. |
| [spec/spec-template.md](spec/spec-template.md) | Writing your own `spec/spec.md` before handing the project to an AI agent. |
| [AGENTS.md](AGENTS.md) | What the AI agent reads on every turn. Short by design; `CLAUDE.md` just points at it. |

---

## Accessibility

The curriculum is called CreateAccess, and a 3D globe is one of the least
accessible things you can put on a web page — it is a single `<canvas>`, which a
screen reader sees as one empty box. The template ships with a data table
showing the same features as text, linked to the map both ways; keyboard camera
controls (arrow keys to pan, `+`/`−` to zoom, `Home` to reset) with a visible
focus ring; real `<button>` and `<input>` elements with proper labels and ARIA;
`prefers-reduced-motion` support, so camera flights become instant jumps; and
high-contrast mode support, with no state signalled by colour alone.

Your project inherits all of it. Please keep it.

---

## Deploying

1. Push your repository to GitHub.
2. At [vercel.com](https://vercel.com), sign in with GitHub and click **Add New
   → Project**. Select your repository.
3. **Before clicking Deploy**, open **Environment Variables** and add
   `VITE_CESIUM_ION_TOKEN` with your token as the value.
4. Deploy, then add your new `.vercel.app` domain to the token's allowed URLs at
   [ion.cesium.com](https://ion.cesium.com).

Step 3 is the one people miss. `.env.local` is gitignored so it never reaches
Vercel, and because Vite bakes the value in at build time, adding the variable
afterwards requires a **redeploy**.

---

## Credits and licence

- Example data: [National Park Service](https://www.nps.gov/), public domain.
  Visitor figures are 2023 recreation visits.
- Fallback imagery: [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors, ODbL.
- Terrain and imagery (with a token): [Cesium ion](https://cesium.com/platform/cesium-ion/).
- Built with [CesiumJS](https://cesium.com/platform/cesiumjs/), Apache 2.0.

Add your own licence before publishing a project built from this template, and
keep any attribution your data sources require.
