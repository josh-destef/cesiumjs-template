// DO NOT EDIT — known-good configuration.
// Changing this file is the most common cause of unrecoverable build failures.
// If you think you need to change it, tell the user instead.
//
// Why this file is so short:
// CesiumJS is not a normal JavaScript library. It ships a large folder of
// static assets (worker scripts, shaders, fonts, imagery) that the browser
// loads at runtime, separately from your bundled code. Vite does not know
// about those files by default, so a plain Vite setup builds fine and then
// shows a blank globe in production.
//
// vite-plugin-cesium handles all of that for us: it copies the asset folder
// into the build output and sets the CESIUM_BASE_URL variable that tells
// Cesium where to find those assets. That is the whole reason it is here.
//
// Do not add vite-plugin-static-copy, manual `define` entries for
// CESIUM_BASE_URL, or copy targets. They conflict with this plugin.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  plugins: [react(), cesium()],
});
