import typescriptEslintParser from "@typescript-eslint/parser";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";

const eslintConfig = [
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "dist/**", "build/**", "META/**", "UlTIMATE-REFERENCE/**"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ignores: ["**/features/*/api/index.ts"], // Feature API clients can import from @/lib/api/*
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
          "paths": [
            {
              "name": "@/lib/api/auth",
              "message": "Import from feature API client (@/features/auth/api)"
            },
            {
              "name": "@/lib/api/users",
              "message": "Import from feature API client (@/features/user/api)"
            },
            {
              "name": "@/lib/api/events",
              "message": "Import from feature API client (@/features/meeting/api)"
            },
            {
              "name": "@/lib/api/voting",
              "message": "Import from feature API client (@/features/voting/api)"
            }
          ]
        }
      ],
    }
  }
];

export default eslintConfig;
