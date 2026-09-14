import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
function version() { for (const f of ["./VERSION", "../VERSION"]) { try { return fs.readFileSync(new URL(f, import.meta.url), "utf8").trim(); } catch {} } return "dev"; }
export default defineConfig({ plugins: [react()], define: { __APP_VERSION__: JSON.stringify(version()) }, server: { proxy: { "/api": "http://localhost:4000" } } });
