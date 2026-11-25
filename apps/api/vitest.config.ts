// defineConfig gives us autocomplete and type checking for the test settings
import { defineConfig } from "vitest/config";

// Settings for the test runner (Vitest = a fast test framework that understands TypeScript)
export default defineConfig({
  test: {
    // Which files are tests
    include: ["tests/**/*.test.ts"],
    // Runs in every test worker BEFORE the test file loads: points the app at the TEST database and safe settings
    setupFiles: ["tests/setup/env.ts"],
    // Runs ONCE before all tests: migrates and empties the test database
    globalSetup: ["tests/setup/global.ts"],
    // Password hashing and database calls need more than the default 5 seconds in slow environments
    testTimeout: 30000,
    // Hooks (setup code) get the same generous limit
    hookTimeout: 60000,
  },
});
