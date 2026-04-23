import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import tsEslint from "@typescript-eslint/eslint-plugin";
import tsEslintParser from "@typescript-eslint/parser";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    // Combined plugins definition:
    plugins: {
      js,
      "@typescript-eslint": tsEslint,
    },
    extends: ["js/recommended"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parser: tsEslintParser,
    },

    rules: {
      // --- Standard naming conventions
      camelcase: "warn", // Disable the base rule to use the advanced one
      "@typescript-eslint/naming-convention": [
        "error",
        // Allow any format for object literal properties (the labels in your JSON object)
        {
          selector: "objectLiteralProperty",
          format: null,
        },
        {
          selector: ["variableLike", "function", "parameter", "property"],
          format: ["camelCase"],
        },
        {
          selector: "class",
          format: ["PascalCase"],
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "import",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
        },
      ],

      // --- Potential Problems ---
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }], // Error on unused vars, allow _arg
      "no-constant-condition": "error", // Prevents 'while (true)'
      "no-debugger": "error", // Prevents leaving debugger statements in code
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-empty": "error",
      "no-unexpected-multiline": "error",
      "no-undef": "error",

      // --- Modern JavaScript Best Practices ---
      "no-var": "error", // FORCES use of const or let (avoids 'var')
      "prefer-const": "error", // Suggests const if variable is never reassigned
      "prefer-arrow-callback": "error", // Use arrow functions where appropriate
      "object-shorthand": ["error", "always"], // Use { a, b } instead of { a: a, b: b }
      quotes: ["warn", "double"], // Enforce double quotes
      "no-else-return": "warn", // Promote early exits and readability

      // --- Style and Consistency ---
      semi: ["error", "always"], // Enforce semicolons at the end of statements
      indent: ["error", 2, { SwitchCase: 1 }], // Enforce 2 space indentation
      "comma-spacing": ["error", { before: false, after: true }],
      "comma-style": ["error", "last"],
      "eol-last": ["error", "always"], // Ensure files end with a newline
      "no-multiple-empty-lines": ["error", { max: 2, maxBOF: 0, maxEOF: 0 }],
      "no-extra-semi": "warn",
      "arrow-body-style": "warn",
    },
  },
]);
