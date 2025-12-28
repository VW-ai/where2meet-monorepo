import typescriptEslintParser from "@typescript-eslint/parser";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";

const eslintConfig = [
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "dist/**", "build/**", "META/**", "UlTIMATE-REFERENCE/**"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
    },
    rules: {
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "prefer-const": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": [
        "error",
        {
          "patterns": [
            {
              "group": ["@/lib/api/*"],
              "message": "Import from feature API client (e.g., @/features/auth/api, @/features/user/api, @/features/meeting/api, @/features/voting/api)"
            }
          ]
        }
      ],
    }
  }
];

export default eslintConfig;
