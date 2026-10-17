import express from "express";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import expressLayouts from "express-ejs-layouts";

import { env } from "./config/env.js";
import { buildSessionMiddleware } from "./config/session.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { currentUser } from "./middleware/currentUser.js";
import { csrf } from "./middleware/csrf.js";
import { flash } from "./middleware/flash.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import routes from "./routes/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path to the Vite build output.
const SPA_DIST = path.join(__dirname, "..", "public", "dist");
const SPA_INDEX = path.join(SPA_DIST, "index.html");

// Paths that Express owns. Everything else with a GET is handled by the SPA
// fallback (unless the file exists in dist/, in which case static wins).
const SERVER_OWNED_PREFIXES = [
  "/api/",
  "/health",
  "/login",
  "/register",
  "/logout",
  "/dashboard",
  "/styles/",
];

function isServerOwnedPath(p) {
  return SERVER_OWNED_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(prefix),
  );
}

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: env.isProd ? undefined : false,
    }),
  );

  app.use(compression());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.use(buildSessionMiddleware());
  app.use(requestLogger);

  app.use(currentUser);
  app.use(flash);
  app.use(csrf);

  // Backend-owned static assets (our small EJS stylesheet).
  app.use(
    "/styles",
    express.static(path.join(__dirname, "..", "public", "styles"), {
      maxAge: env.isProd ? "1h" : 0,
    }),
  );

  // Vite build output (the SPA). Mounted at / so /assets/*, /js/*, /index.html
  // all come from dist/. In dev this directory may be empty — that's fine;
  // the SPA is served from :5173 instead and the proxy forwards API calls.
  app.use(
    express.static(SPA_DIST, {
      maxAge: env.isProd ? "1h" : 0,
      index: false, // we control index.html ourselves in the fallback
      fallthrough: true,
    }),
  );

  // EJS views (auth/admin pages).
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(expressLayouts);
  app.set("layout", "layouts/base");

  // Backend routes: /api/*, /health, /login, /register, /dashboard, ...
  app.use(routes);

  // SPA fallback: any GET that isn't server-owned and isn't a static file
  // gets dist/index.html so client-side routing can take over.
  app.all(/^(?!\/api\/).*/, (req, res, next) => {
    // Only GET and HEAD fall through to the SPA. Everything else 404s.
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (isServerOwnedPath(req.path)) return next();
    if (!existsSync(SPA_INDEX)) {
      return res
        .status(404)
        .type("text/plain")
        .send(
          'SPA build not found. Run "npm run build" at the repo root, or use the Vite dev server on :5173.',
        );
    }
    res.sendFile(SPA_INDEX);
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
