import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  installBrowserSentry,
  installClientErrorReporting,
} from "@hotelos/web-client";
import "@hotelos/ui/styles.css";
import { App } from "./app.js";

installBrowserSentry({
  appName: "admin",
  ...(import.meta.env.VITE_SENTRY_DSN
    ? { dsn: import.meta.env.VITE_SENTRY_DSN }
    : {}),
  environment:
    import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
});
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
