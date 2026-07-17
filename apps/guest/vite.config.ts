import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@hotelos/ui/styles.css": resolve(
        __dirname,
        "../../packages/ui/src/styles/tokens.css",
      ),
      "@hotelos/ui": resolve(__dirname, "../../packages/ui/src/index.ts"),
      "@hotelos/web-client": resolve(
        __dirname,
        "../../packages/web-client/src/index.ts",
      ),
    },
  },
  server: {
    port: 5175,
    strictPort: true,
  },
});
