// Import the function that configures the test environment
import { applyTestEnv } from "./testEnv.js";

// Runs at the start of every test worker, before any test file imports the app
applyTestEnv();
