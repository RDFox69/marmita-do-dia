import { defineConfig } from "vite";

const apiProxy = {
  "/api": "http://127.0.0.1:5000",
};

export default defineConfig({
  base: "/",
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
});
