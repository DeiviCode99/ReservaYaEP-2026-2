import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // El CORS del gateway solo admite http://localhost:3000.
    port: 3000,
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
});
