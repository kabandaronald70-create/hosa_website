import { registerMember, loginUser } from "../services/authService.js";
import {
  registerSchema,
  loginSchema,
  flattenZodError,
} from "../validators/authValidators.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export function showRegisterForm(req, res) {
  res.render("auth/register", {
    title: "Register — HOSA",
    values: {},
    fieldErrors: {},
  });
}

export async function submitRegister(req, res, next) {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    const { fieldErrors } = flattenZodError(parsed.error);
    const {
      email = "",
      first_name = "",
      last_name = "",
      graduation_year = "",
      district = "",
      country_code = "",
    } = req.body;
    return res.status(400).render("auth/register", {
      title: "Register — HOSA",
      values: {
        email,
        first_name,
        last_name,
        graduation_year,
        district,
        country_code,
      },
      fieldErrors,
    });
  }

  // Map Zod's snake_case output to registerMember's camelCase input.
  const input = {
    email: parsed.data.email,
    password: parsed.data.password,
    firstName: parsed.data.first_name,
    lastName: parsed.data.last_name,
    graduationYear: parsed.data.graduation_year ?? null,
    district: parsed.data.district || null,
    countryCode: parsed.data.country_code || null,
    mentorOptIn: Boolean(parsed.data.mentor_opt_in),
  };

  try {
    const { user } = await registerMember(input);

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.flash = {
        success: "Welcome to HOSA! Your account has been created.",
      };
      res.redirect("/dashboard");
    });
  } catch (err) {
    if (err.code === "EMAIL_TAKEN") {
      return res.status(409).render("auth/register", {
        title: "Register — HOSA",
        values: {
          email: req.body.email || "",
          first_name: req.body.first_name || "",
          last_name: req.body.last_name || "",
          graduation_year: req.body.graduation_year || "",
          district: req.body.district || "",
          country_code: req.body.country_code || "",
        },
        fieldErrors: { email: "That email is already registered." },
      });
    }
    logger.error({ err }, "Registration failed");
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export function showLoginForm(req, res) {
  const next_ = typeof req.query.next === "string" ? req.query.next : "";
  res.render("auth/login", {
    title: "Log in — HOSA",
    values: { email: "" },
    fieldErrors: {},
    next: next_,
  });
}

export async function submitLogin(req, res, next) {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    const { fieldErrors } = flattenZodError(parsed.error);
    return res.status(400).render("auth/login", {
      title: "Log in — HOSA",
      values: { email: req.body.email || "" },
      fieldErrors,
      next: req.body.next || "",
    });
  }

  try {
    const { user } = await loginUser(parsed.data);

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      // Write flash directly to the fresh session — no reliance on the pre-regenerate closure.
      req.session.flash = { success: "Welcome back!" };
      const dest = sanitizeNext(req.body.next) || "/dashboard";
      res.redirect(dest);
    });
  } catch (err) {
    if (err.code === "INVALID_CREDENTIALS" || err.code === "ACCOUNT_INACTIVE") {
      // Never reveal which one failed.
      return res.status(401).render("auth/login", {
        title: "Log in — HOSA",
        values: { email: req.body.email || "" },
        fieldErrors: { _form: "Invalid email or password." },
        next: req.body.next || "",
      });
    }
    logger.error({ err }, "Login failed");
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export function logout(req, res, next) {
  if (!req.session) return res.redirect("/");
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("hosa.sid");
    res.redirect("/");
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Allow only same-origin paths in the "next" parameter to prevent
 * open-redirect attacks. Reject protocol-relative ("//evil.com") and
 * absolute URLs.
 */
function sanitizeNext(value) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}
