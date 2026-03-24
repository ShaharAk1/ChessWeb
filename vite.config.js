import { defineConfig } from "vite";

export default defineConfig({
  base: '/ChessWeb/',
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": "http://localhost:3000"
    }
  }
});
