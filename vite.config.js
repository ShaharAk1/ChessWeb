import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/ChessWeb/' : '/',
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": "http://localhost:3000"
    }
  }
});
