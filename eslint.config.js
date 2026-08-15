import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
                ecmaVersion: 2020,
                globals: globals.browser,
        },
        plugins: {
                "react-hooks": reactHooks,
                "react-refresh": reactRefresh,
        },
        rules: {
                ...reactHooks.configs.recommended.rules,
                // React Compiler-readiness rules added in eslint-plugin-react-hooks v7.
                // This project doesn't use the React Compiler, and these rules flag
                // long-standing, working patterns (sync setState in an effect,
                // Date.now()/Math.random()/performance.now() during render, handler
                // functions referenced before their declaration within the same
                // component) as hard errors. Disabled until we actually adopt the
                // compiler; revisit then.
                "react-hooks/set-state-in-effect": "off",
                "react-hooks/purity": "off",
                "react-hooks/immutability": "off",
                "react-refresh/only-export-components": [
                          "warn",
                  { allowConstantExport: true },
                        ],
                "@typescript-eslint/no-unused-vars": ["error", { 
                                                              "argsIgnorePattern": "^_",
                          "varsIgnorePattern": "^_",
                          "caughtErrorsIgnorePattern": "^_"
                }]
        },
  }
  );
