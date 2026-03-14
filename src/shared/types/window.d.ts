/*
Purpose: Extend the browser Window type with the typed desktop API exposed by the preload script.
Out of scope: Preload implementation details and domain schema declarations.
*/
import type { DesktopApi } from "../contracts/desktop-api";

declare global {
  interface Window {
    desktop: DesktopApi;
  }
}

export {};
