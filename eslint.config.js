import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "coverage/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    // Runs inside Cavalry's JavaScript engine, not Node.
    files: ["bridge/**/*.js"],
    languageOptions: {
      sourceType: "script",
      ecmaVersion: 2017,
      globals: { api: "readonly", ui: "readonly", console: "readonly" },
    },
    rules: {
      "no-var": "off",
      "no-unused-vars": ["error", { varsIgnorePattern: "^CavalryMcpBridge$" }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
);
