import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installClientErrorReporting } from "@hotelos/web-client";
import "@hotelos/ui/styles.css";
import { App } from "./app.js";

installClientErrorReporting("admin");

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
