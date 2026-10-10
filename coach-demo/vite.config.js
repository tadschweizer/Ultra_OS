import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react({ include: /\.(js|jsx)$/ })],
  resolve: {
    alias: {
      "next/router": fileURLToPath(new URL("./router.jsx", import.meta.url)),
      react: fileURLToPath(new URL("./node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(
        new URL("./node_modules/react-dom", import.meta.url),
      ),
    },
  },
  esbuild: { loader: "jsx", include: /.*\.(js|jsx)$/, exclude: [] },
  optimizeDeps: { esbuildOptions: { loader: { ".js": "jsx" } } },
  build: { outDir: "dist", emptyOutDir: true },
});
