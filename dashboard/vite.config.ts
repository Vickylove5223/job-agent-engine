import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { localDbPlugin } from "./dev/localDb";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Relative base so the build works on GitHub Pages under /<repo>/.
  base: "./",
  plugins: [react(), tailwindcss(), localDbPlugin(path.resolve(here, "../data"))],
  resolve: {
    alias: {
      "@": path.resolve(here, "src"),
      "@shared": path.resolve(here, "../shared/src"),
    },
  },
  server: { port: 5180, fs: { allow: [".."] } },
});
