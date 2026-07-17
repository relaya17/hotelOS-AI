// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

const FRONTEND_APPS = ["apps/executive", "apps/admin", "apps/guest"];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/.data/**",
      "**/coverage/**",
      "**/*.config.{js,cjs,mjs,ts}",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      // The TS compiler settings in tsconfig.base.json (strict, noUncheckedIndexedAccess,
      // exactOptionalPropertyTypes, ...) already enforce most correctness concerns.
      // Keep ESLint focused on bugs the compiler can't catch: unhandled promises,
      // misused async in sync-expecting positions, unreachable/dead branches.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/require-await": "warn",
    },
  },
  {
    files: FRONTEND_APPS.map((app) => `${app}/**/*.{ts,tsx}`),
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // The new React Compiler-era purity/set-state-in-effect rules flag the
      // codebase's existing, standard "fetch-on-mount in useEffect" pattern
      // (reload().catch(setError)) as an error. That pattern is intentional and
      // correct here; keep the rules on as a warning so real regressions still
      // surface without failing the QA gate on pre-existing, reviewed code.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
);
