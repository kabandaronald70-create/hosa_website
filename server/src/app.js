import express from "express";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import expressLayouts from "express-ejs-layouts";

import { env } from "./config/env.js";
import { buildSessionMiddleware } from "./config/session.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { currentUser } from "./middleware/currentUser.js";
import { csrf } from "./middleware/csrf.js";
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
      contentSecurityPolicy: env.isProd ? undefined : false,
    }),
  );

  app.use(compression());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  // Session must come before currentUser and csrf.
  app.use(buildSessionMiddleware());

  app.use(requestLogger);

  // Load req.user / req.userRoles / req.profile from the session.
  app.use(currentUser);

  // CSRF tokens available to every view; verification on state-changing methods.
  app.use(csrf);

  app.use(
    "/styles",
    express.static(path.join(__dirname, "..", "public", "styles"), {
      maxAge: env.isProd ? "1h" : 0,
    }),
  );

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(expressLayouts);
  app.set("layout", "layouts/base");

  app.use(routes);

  app.get("/", (req, res) => {
    res.render("home", {
      title: "HOSA Backend",
      now: new Date().toISOString(),
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
