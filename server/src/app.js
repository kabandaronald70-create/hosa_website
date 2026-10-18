import express from "express";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import expressLayouts from "express-ejs-layouts";
import { setCurrentPath } from "./middleware/setCurrentPath.js";

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

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: env.isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              scriptSrcAttr: ["'none'"],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com",
              ],
              imgSrc: [
                "'self'",
                "data:",
                "https://*.supabase.co",
                "https://flagcdn.com",
                "https://*.tile.openstreetmap.org",
              ],
              fontSrc: ["'self'", "https:", "data:"],
              connectSrc: ["'self'", "https://*.supabase.co"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'self'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
    }),
  );

  app.use(compression());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.use(buildSessionMiddleware());
  app.use(requestLogger);

  app.use(currentUser);
  app.use(setCurrentPath);
  app.use(flash);
  app.use(csrf);

  // Serve static assets (styles, fonts, images) from the server/public folder
  app.use(
    express.static(path.join(__dirname, "..", "public"), {
      maxAge: env.isProd ? "1h" : 0,
    }),
  );

  // EJS views
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(expressLayouts);
  app.set("layout", "layouts/base");

  // Mount all routes
  app.use(routes);

  // 404 and Error handling must be the last middlewares
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
