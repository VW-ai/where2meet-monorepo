import { configDefaults, defineConfig } from "vitest/config";

const MIGRATION_TESTS = "tests/migrations/**/*.test.ts";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "tests/", "*.config.*"],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    projects: [
      {
        extends: true,
        test: {
          name: "app",
          include: ["tests/**/*.test.ts"],
          exclude: [...configDefaults.exclude, MIGRATION_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: "migrations",
          include: [MIGRATION_TESTS],
          // These files create and drop the cluster-wide panel role, so they run one at a time.
          // A project's fileParallelism: false still lets its files overlap in a full run.
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
  },
});
