// Adds readable checks like expect(element).toBeInTheDocument() to Vitest
import "@testing-library/jest-dom/vitest";
// Tools to clean up between tests
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { setAccessToken } from "../lib/api.js";

// After every test: remove the rendered components, forget saved logins, and restore any faked functions
afterEach(() => {
  // Remove what the test drew on the fake page
  cleanup();
  // The fake browser tab storage must start empty for the next test
  sessionStorage.clear();
  setAccessToken(null);
  // Undo vi.stubGlobal("fetch", ...) and similar fakes
  vi.unstubAllGlobals();
});
