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
    layout: "layouts/public",
  });
}

export async function submitRegister(req, res, next) {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    const { fieldErrors } = flattenZodError(parsed.error);

    // Pass back ALL entered values so the user doesn't lose their progress
    const {
      email = "",
      first_name = "",
      last_name = "",
      other_name = "",
      graduation_year = "",
      district = "",
      country_code = "",
      nationality = "",
      profession = "",
      phone = "",
      region = "",
    } = req.body;

    return res.status(400).render("auth/register", {
      title: "Register — HOSA",
      values: {
        email,
        first_name,
        last_name,
        other_name,
        graduation_year,
        district,
        country_code,
        nationality,
        profession,
        phone,
        region,
      },
      fieldErrors,
      layout: "layouts/public",
    });
  }

  // Map Zod's snake_case output to registerMember's camelCase input.
  const input = {
    email: parsed.data.email,
    password: parsed.data.password,
    firstName: parsed.data.first_name,
    lastName: parsed.data.last_name,
    otherName: parsed.data.other_name || null,
    graduationYear: parsed.data.graduation_year ?? null,
    district: parsed.data.district || null,
    countryCode: parsed.data.country_code || null,
    mentorOptIn: Boolean(parsed.data.mentor_opt_in),
    nationality: parsed.data.nationality,
    profession: parsed.data.profession,
    phone: parsed.data.phone,
    region: parsed.data.region,
  };

  try {
    const { user } = await registerMember(input);

    // No email verification: sign the member in and keep them on the public
    // pages until an administrator approves their membership.
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.flash = {
        success:
          "Account created! An administrator will review your membership. You can browse the public site in the meantime.",
      };
      res.redirect("/");
    });
  } catch (err) {
    if (err.code === "EMAIL_TAKEN") {
      return res.status(409).render("auth/register", {
        title: "Register — HOSA",
        values: {
          email: req.body.email || "",
          first_name: req.body.first_name || "",
          last_name: req.body.last_name || "",
          other_name: req.body.other_name || "",
          graduation_year: req.body.graduation_year || "",
          district: req.body.district || "",
          country_code: req.body.country_code || "",
          nationality: req.body.nationality || "",
          profession: req.body.profession || "",
          phone: req.body.phone || "",
          region: req.body.region || "",
        },
        fieldErrors: { email: "That email is already registered." },
        layout: "layouts/public",
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
    layout: "layouts/public",
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
      layout: "layouts/public",
    });
  }

  try {
    const { user } = await loginUser(parsed.data);

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;

      // Members whose membership has not been approved yet are signed in but
      // are kept on the public site / pending-approval page.
      if (!user.membership_approved_at) {
        req.session.flash = {
          error: "Your account is pending administrator approval.",
        };
        return res.redirect("/pending-approval");
      }

      req.session.flash = { success: "Welcome back!" };
      const dest = sanitizeNext(req.body.next) || "/dashboard";
      res.redirect(dest);
    });
  } catch (err) {
    if (err.code === "INVALID_CREDENTIALS" || err.code === "ACCOUNT_INACTIVE") {
      return res.status(401).render("auth/login", {
        title: "Log in — HOSA",
        values: { email: req.body.email || "" },
        fieldErrors: { _form: "Invalid email or password." },
        next: req.body.next || "",
        layout: "layouts/public",
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

function sanitizeNext(value) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}
