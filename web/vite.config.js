import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
const VERSION = fs.readFileSync(new URL("../server/src/version.js", import.meta.url), "utf8").match(/"([^"]+)"/)[1];
export default defineConfig({ plugins: [react()], define: { __APP_VERSION__: JSON.stringify(VERSION) }, server: { proxy: { "/api": "http://localhost:4000" } } });
