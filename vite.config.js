import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": "http://localhost:3000"
    }
  }
});
