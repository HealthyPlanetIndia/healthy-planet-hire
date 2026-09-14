import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// Single source of truth is the VERSION file at the repository root (copied into the image); falls back to "dev".
function read() { for (const rel of ["../../VERSION", "../VERSION", "../../../VERSION"]) { try { return fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), rel), "utf8").trim(); } catch {} } return "dev"; }
export const VERSION = read();
