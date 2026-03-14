/*
Purpose: Compose the top-level renderer application from the active MVP page module.
Out of scope: Provider setup and low-level DOM mounting.
*/
import { HomePage } from "@/renderer/pages/home-page";

export function App() {
  return <HomePage />;
}
