import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    // API(/api/*)は `npm run dev:api` で起動する wrangler dev(:8787)へ転送する。
    // Host を書き換えない(changeOrigin:false)ので、Worker側からは
    // http://localhost:5173 のリクエストとして見える。
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
      },
    },
  },
});
