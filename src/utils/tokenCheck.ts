/**
 * tokenCheck.ts
 *
 * A blank or black globe is the single most common problem people hit with
 * this template, and the cause is almost always a missing or placeholder
 * Cesium ion token. Cesium itself fails quietly when this happens — it just
 * shows you nothing — so this file exists to turn that silent failure into an
 * obvious, readable message.
 *
 * It is called once, early, from main.tsx.
 */

/**
 * The token is read from an environment variable at BUILD time.
 *
 * `import.meta.env` is Vite's way of exposing environment variables to
 * browser code. Only variables whose names start with `VITE_` are exposed —
 * that prefix is Vite telling you "this value goes into the browser".
 *
 * Read that last sentence again, because it matters: this value is baked into
 * the JavaScript file that every visitor downloads. It is NOT a secret. See
 * README.md, "About that token", for what to do about that.
 */
const rawToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

/** The exact string shipped in .env.example, which is not a real token. */
const PLACEHOLDER = "your_token_here";

/** The three states a token can be in. */
export type TokenStatus = "ok" | "missing" | "placeholder";

/**
 * Works out whether we have a usable token, without throwing.
 *
 * We deliberately do not throw here. Throwing would replace the globe with a
 * blank screen, which is the exact confusing outcome we are trying to avoid.
 * Instead we report the problem and let App.tsx show a readable banner.
 */
export function getTokenStatus(): TokenStatus {
  // `undefined` means the variable was never defined. An empty string means
  // it was defined but left blank. Both are "missing" as far as we care.
  if (rawToken === undefined || rawToken.trim() === "") {
    return "missing";
  }

  if (rawToken.trim() === PLACEHOLDER) {
    return "placeholder";
  }

  return "ok";
}

/**
 * Returns the token if it is usable, otherwise `undefined`.
 *
 * createViewer.ts uses this. Note that we never log the token itself — not
 * even a truncated version. Logging it would put it in browser consoles,
 * screen recordings, and screenshots pasted into help channels.
 */
export function getToken(): string | undefined {
  return getTokenStatus() === "ok" ? rawToken!.trim() : undefined;
}

/**
 * Prints a clear explanation to the browser console when the token is not
 * usable. Called once from main.tsx.
 *
 * We use console.warn rather than console.error on purpose: the smoke test
 * asserts there are zero console errors, and a missing token is a setup
 * problem rather than a code fault.
 */
export function warnIfTokenMissing(): void {
  const status = getTokenStatus();

  if (status === "ok") {
    return;
  }

  const reason =
    status === "missing"
      ? "No VITE_CESIUM_ION_TOKEN was found."
      : "VITE_CESIUM_ION_TOKEN is still set to the placeholder value.";

  // A multi-line template string keeps this readable in the console.
  console.warn(
    [
      "",
      "──────────────────────────────────────────────────────────────",
      "  Cesium ion token problem",
      "",
      `  ${reason}`,
      "",
      "  The app still works: it falls back to OpenStreetMap imagery,",
      "  so you will see a map. What you will NOT get is 3D terrain,",
      "  or access to any Cesium ion asset.",
      "",
      "  To fix this:",
      "    1. Sign in at https://ion.cesium.com/tokens",
      "    2. Create a NEW token (do not use the Default Token).",
      "       Give it the assets:read scope only.",
      "    3. Copy .env.example to .env.local",
      "    4. Paste your token as the value of VITE_CESIUM_ION_TOKEN",
      "    5. Stop the dev server and run `npm run dev` again",
      "",
      "  Step 5 matters: Vite only reads .env.local at startup, so a",
      "  running server will not notice the new file.",
      "──────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}
