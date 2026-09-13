// Fails the build if any React component declares a hook after an early `return`.
import fs from "fs"; import path from "path";
const files = []; const walk = (d) => fs.readdirSync(d).forEach((f) => { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.jsx$/.test(p) && files.push(p); });
walk("src"); let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  // split into top-level function bodies roughly: from "function Name(" or "export default function" to the next top-level function
  const parts = src.split(/\n(?=(?:export default )?function\s+[A-Z]\w*\s*\(|const\s+[A-Z]\w*\s*=\s*\()/);
  for (const part of parts) {
    const lines = part.split("\n"); let returned = -1;
    lines.forEach((l, i) => {
      const depth = (part.split("\n").slice(0, i).join("\n").match(/\{/g) || []).length - (part.split("\n").slice(0, i).join("\n").match(/\}/g) || []).length;
      if (depth === 1 && /^\s*if\s*\(.*\)\s*return\b/.test(l) && returned < 0) returned = i;
      if (returned >= 0 && i > returned && depth === 1 && /\buse(State|Effect|Ref|Memo|Callback|Context)\s*\(/.test(l)) { console.error(`${f}: hook after early return, line ${i + 1} of component starting "${lines[0].slice(0, 40)}"`); bad++; }
    });
  }
}
if (bad) { process.exit(1); } else console.log(`hooks ok (${files.length} files)`);
