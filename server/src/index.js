import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { ensureSeed } from "./seed.js";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { requireAuth, login, createResetToken, useResetToken } from "./auth.js";
import { mailEnabled, sendEmail } from "./services/email.js";
import { scheduleHousekeeping } from "./services/retention.js";
import { seedRules } from "./services/rules.js";
import { roles } from "./routes/roles.js";
import { candidates } from "./routes/candidates.js";
import { pub } from "./routes/public.js";
import { webhooks } from "./routes/webhooks.js";
import { misc } from "./routes/misc.js";
import { setup } from "./routes/setup.js";
import { scheduleFollowups } from "./services/followups.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
const publicLimit = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests, please slow down" } });
const loginLimit = rateLimit({ windowMs: 15 * 60_000, max: 20, message: { error: "Too many sign-in attempts. Try again in 15 minutes." } });
app.use("/api/public", publicLimit); app.use("/api/auth", loginLimit);
app.use(express.json({ limit: "2mb" }));
app.use("/api/public", express.json({ limit: "400kb" }));

app.post("/api/auth/login", async (req, res) => {
  const r = await login(req.body.email || "", req.body.password || "");
  if (!r) return res.status(401).json({ error: "Email or password is incorrect" });
  res.json(r);
});
app.post("/api/auth/forgot", async (req, res) => {
  const token = createResetToken(req.body.email || "");
  if (token && mailEnabled()) { try { await sendEmail(req.body.email, "Reset your Healthy Planet Hire password", `Open this link within one hour to set a new password:\n${process.env.PUBLIC_URL}/reset/${token}`); } catch (e) { console.error(e.message); } }
  else if (token) console.log(`Password reset link (email not configured): ${process.env.PUBLIC_URL}/reset/${token}`);
  res.json({ ok: true }); // always the same answer, so emails can't be enumerated
});
app.post("/api/auth/reset", async (req, res) => {
  if ((req.body.password || "").length < 8) return res.status(400).json({ error: "Use at least 8 characters" });
  res.json({ ok: await useResetToken(req.body.token, req.body.password) });
});
app.use("/api/public", pub);
app.use("/api/webhooks", webhooks);
app.use("/api/roles", requireAuth, roles);
app.use("/api/candidates", requireAuth, candidates);
app.use("/api/setup", requireAuth, setup);
app.use("/api", requireAuth, misc);

// Serve the web app if it has been built (single-service deploys). API routes above take priority.
const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "web", "dist");
if (fs.existsSync(webDir)) {
  app.use(express.static(webDir, { maxAge: "1h", index: false }));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(webDir, "index.html")));
}

app.use((err, req, res, next) => { console.error(err); res.status(err.status || 500).json({ error: err.message || "Something went wrong" }); });

ensureSeed();
seedRules();
scheduleFollowups();
scheduleHousekeeping();
app.listen(process.env.PORT || 4000, () => console.log(`Healthy Planet Hire API on :${process.env.PORT || 4000}`));
