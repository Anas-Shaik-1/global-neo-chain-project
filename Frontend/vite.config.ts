import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  // simple-peer (used by the WebRTC calls module) is a Node-style library that
  // expects `global` and `process` to exist. Browsers don't have those, so we
  // shim them at build/dev time. Using `globalThis` is the safe modern shim.
  define: {
    global: "globalThis",
    "process.env": {},
  },
  server: {
    port: 5173,
  },
});
