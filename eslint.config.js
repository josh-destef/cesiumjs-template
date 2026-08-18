/**
 * eslint.config.js
 *
 * Lint rules. These catch mistakes before you see them in the browser.
 *
 * This is the "flat config" format, which is a plain JavaScript array of
 * configuration objects. Each object says which files it applies to and which
 * rules to use. Older projects use a .eslintrc file instead — that format is
 * no longer supported by ESLint 10.
 */

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  // Files that should never be linted.
  {
    ignores: ["dist/**", "node_modules/**"],
  },

  // Base rules for all TypeScript.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Browser code.
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // The React rules that actually prevent bugs: hooks must be called
      // unconditionally, and effects must declare what they depend on.
      ...reactHooks.configs.recommended.rules,

      // Unused variables are usually a mistake, but a leading underscore is
      // the conventional way to say "I know, and I mean it".
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Config files run outside the browser, so they get Node globals instead
  // and are not subject to the React rules.
  {
    files: ["*.config.{js,ts}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
);
