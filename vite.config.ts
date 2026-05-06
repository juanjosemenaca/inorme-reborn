import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    /** Puerto del proyecto. Sin `host: "::"` para evitar fallos de `os.networkInterfaces()` en entornos restringidos. */
    port: 8080,
    strictPort: true,
    proxy: {
      "/api/bulk-invoices": {
        target: "http://127.0.0.1:3847",
        changeOrigin: true,
        timeout: 3_600_000,
        proxyTimeout: 3_600_000,
      },
    },
    /** Evita que el navegador sirva un JS antiguo y parezca que los cambios no aplican. */
    headers: {
      "Cache-Control": "no-store",
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
