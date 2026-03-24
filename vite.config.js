import { defineConfig } from "vite";

export default defineConfig({
  base: '',
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": "http://localhost:3000"
    }
  }
});
