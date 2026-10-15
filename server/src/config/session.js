import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { env } from "./env.js";
import { pool } from "./db.js";

const PgStore = connectPgSimple(session);

export function buildSessionMiddleware() {
  const store = new PgStore({
    pool,
    tableName: "session",
    createTableIfMissing: false,
    pruneSessionInterval: 60 * 15, // 15 minutes
  });

  return session({
    name: env.session.name,
    secret: env.session.secret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true, // refresh cookie on every response
    cookie: {
      httpOnly: true,
      secure: env.isProd, // HTTPS only in prod
      sameSite: "lax",
      maxAge: env.session.maxAgeMs,
      path: "/",
    },
  });
}
