/*
Purpose: Mount the React renderer entry point and load global application styles.
Out of scope: Route definitions, page composition, and Electron window management.
*/
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "@/renderer/app/providers";
import ShadcnLayout from "@/renderer/layouts/shadcn-layout";
import "@/renderer/app/styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Renderer root element was not found.");
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <ShadcnLayout />
    </AppProviders>
  </StrictMode>
);
