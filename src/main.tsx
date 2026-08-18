/**
 * main.tsx
 *
 * The entry point. index.html loads this file, and this file starts React.
 *
 * There is one unusual thing here and it is important, so it is explained in
 * full below: this app deliberately does NOT use React.StrictMode.
 */

import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { warnIfTokenMissing } from "./utils/tokenCheck";
import "./styles.css";

// Check the Cesium ion token before anything else runs, so the explanation is
// the first thing in the console rather than buried under Cesium's own output.
warnIfTokenMissing();

/**
 * The React Query client, which holds the cache for every request the app
 * makes.
 *
 * It is created out here, at module level, rather than inside a component.
 * Creating it inside a component would build a brand new (and therefore empty)
 * cache on every render, which quietly defeats the entire point of caching.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * How long fetched data is considered current: five minutes.
       *
       * Within that window, asking for the same data again returns the cached
       * copy instantly with no network request. Geospatial datasets are large
       * and change slowly, so this is a good trade. Lower it if your data is
       * genuinely live.
       */
      staleTime: 5 * 60 * 1000,

      /**
       * Do not re-fetch just because the user clicked back into the browser
       * window.
       *
       * React Query does this by default, and for a dashboard it is exactly
       * right. For a map it is not: a refetch can rebuild the layer, which
       * looks like a flicker and can throw away the view the user had set up.
       */
      refetchOnWindowFocus: false,

      /**
       * Try a failed request once more before giving up. The default of three
       * retries makes a genuinely broken URL take a long time to report itself,
       * which is confusing when you are still setting the project up.
       */
      retry: 1,
    },
  },
});

// Find the div from index.html that React will render into.
const container = document.getElementById("root");

if (!container) {
  throw new Error(
    'No element with id "root" found in index.html. React has nowhere to render.',
  );
}

// ---------------------------------------------------------------------------
// WHY THERE IS NO <React.StrictMode> HERE
// ---------------------------------------------------------------------------
// In development, StrictMode deliberately mounts every component twice, runs
// every effect twice, and then keeps the second one. It does this to surface
// components that do not clean up after themselves. It is a good tool and most
// React projects should use it.
//
// This project cannot. A Cesium Viewer takes exclusive ownership of a canvas
// and a WebGL context. Under StrictMode the sequence becomes:
//
//     create viewer -> destroy viewer -> create viewer again
//
// and the third step attaches to a DOM node the second step has already torn
// down. The result is a blank globe, console errors about a destroyed object,
// or a hard crash — in development only, which makes it maddening to diagnose.
//
// Do not add StrictMode back. If you want the safety it provides, the honest
// alternative is to read src/components/Globe.tsx, which does the cleanup
// StrictMode would be checking for.
// ---------------------------------------------------------------------------

createRoot(container).render(
  // ErrorBoundary is outermost so it can catch a crash anywhere below it,
  // including one inside the query provider.
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </ErrorBoundary>,
);
