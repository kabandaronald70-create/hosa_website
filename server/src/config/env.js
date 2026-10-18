import "dotenv/config";

function required(name) {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name, fallback) {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

function toInt(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) {
    throw new Error(
      `Environment variable ${name} must be an integer, got: ${v}`,
    );
  }
  return n;
}

const NODE_ENV = optional("NODE_ENV", "development");

export const env = Object.freeze({
  NODE_ENV,
  isProd: NODE_ENV === "production",
  isDev: NODE_ENV !== "production",

  PORT: toInt("PORT", 3000),
  APP_ORIGIN: optional("APP_ORIGIN", "http://localhost:3000"),

  db: {
    host: optional("PGHOST", "localhost"),
    port: toInt("PGPORT", 5432),
    user: optional("PGUSER", "postgres"),
    password: required("PGPASSWORD"),
    database: optional("PGDATABASE", "hosa_dev"),
  },

  session: {
    secret: required("SESSION_SECRET"),
    name: optional("SESSION_NAME", "hosa.sid"),
    maxAgeMs: toInt("SESSION_MAX_AGE_MS", 1000 * 60 * 60 * 24 * 7),
  },

  csrf: {
    secret: required("CSRF_SECRET"),
    cookieName: optional("CSRF_COOKIE_NAME", "hosa.csrf"),
    headerName: optional("CSRF_HEADER_NAME", "x-csrf-token"),
    fieldName: optional("CSRF_FIELD_NAME", "_csrf"),
  },

  supabase: {
    url: required("SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    avatarBucket: optional("SUPABASE_AVATAR_BUCKET", "avatars"),
    signedUrlTtlSeconds: toInt("SUPABASE_SIGNED_URL_TTL_SECONDS", 60),
  },

  resendApiKey: optional("RESEND_API_KEY", null),
  emailFrom: optional("EMAIL_FROM", "HOSA <onboarding@resend.dev>"),
  appOrigin: optional("APP_ORIGIN", "http://localhost:3000"),

  log: {
    level: optional("LOG_LEVEL", NODE_ENV === "production" ? "info" : "debug"),
  },
});
