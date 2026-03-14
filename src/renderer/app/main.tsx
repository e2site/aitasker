/*
Purpose: Mount the React renderer entry point and load global application styles.
Out of scope: Route definitions, page composition, and Electron window management.
*/
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/renderer/app/App";
import { AppProviders } from "@/renderer/app/providers";
import "@/renderer/app/styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Renderer root element was not found.");
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
);
