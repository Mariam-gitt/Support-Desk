// React's entry point and its strict-mode helper (it warns about risky code during development)
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// BrowserRouter makes page addresses work without reloading the page
import { BrowserRouter } from "react-router-dom";
// React Query: the cache and tools for server data
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// Our auth system and the app itself
import { AuthProvider } from "./auth/AuthContext.js";
import { App } from "./App.js";
// The styles
import "./styles.css";

// One cache for the whole app; data counts as fresh for 5 seconds and failed reads are retried once
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } });

// Find the empty <div id="root"> in index.html (the "!" tells TypeScript it exists)
const container = document.getElementById("root")!;

// Draw the app; the nesting order matters: router and cache first, then auth (which may use them), then the pages
createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
