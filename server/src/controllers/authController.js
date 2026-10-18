import {
  registerMember,
  loginUser,
  markUserVerified,
} from "../services/authService.js";
import {
  registerSchema,
  loginSchema,
  flattenZodError,
} from "../validators/authValidators.js";
import { logger } from "../utils/logger.js";
import {
  createEmailToken,
  verifyEmailToken,
  markTokenUsed,
} from "../services/tokenService.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../services/emailService.js";
import { updateUserPassword, findUserByEmail } from "../models/userModel.js";
import {
  hashPassword,
  validatePasswordStrength,
} from "../services/passwordService.js";
import { query } from "../config/db.js"; // ← ADDED THIS IMPORT

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
      layout: "layouts/public",
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

    // Generate token and send verification email
    const token = await createEmailToken(user.id, "verification");
    await sendVerificationEmail({
      to: user.email,
      name: input.firstName,
      token,
    });

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.flash = {
        success:
          "Account created! Please check your email to verify your account.",
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

    if (!user.email_verified_at) {
      // User is authenticated but NOT verified.
      // Set the session, but redirect them to a holding page.
      req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.userId = user.id;
        req.session.flash = {
          error: "Please verify your email address to continue.",
        };
        res.redirect("/verify-required");
      });
      return;
    }

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
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
// Verify Email
// ---------------------------------------------------------------------------

export async function handleVerifyEmail(req, res, next) {
  try {
    const { token } = req.query;
    if (!token) return res.redirect("/login");

    const userId = await verifyEmailToken(token, "verification");
    if (!userId) {
      return res.render("auth/message", {
        title: "Invalid Link",
        message: "This verification link is invalid or has expired.",
        layout: "layouts/public",
      });
    }

    await markUserVerified(userId);
    await markTokenUsed(token);

    // Refresh session to reflect the new 'active' status
    if (req.session) {
      req.session.flash = {
        success: "Your email is verified! Welcome to HOSA.",
      };
    }
    res.redirect("/dashboard");
  } catch (err) {
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
// Forgot Password
// ---------------------------------------------------------------------------

export function showForgotPasswordForm(req, res) {
  res.render("auth/forgot-password", {
    title: "Forgot Password — HOSA",
    layout: "layouts/public",
    values: {},
    fieldErrors: {},
  });
}

export async function submitForgotPassword(req, res, next) {
  try {
    const email = (req.body.email || "").trim().toLowerCase();

    // Always show the same message to prevent email enumeration
    const successMessage =
      "If an account exists with that email, we've sent a password reset link.";

    if (!email) {
      return res.status(400).render("auth/forgot-password", {
        title: "Forgot Password — HOSA",
        layout: "layouts/public",
        values: { email },
        fieldErrors: { email: "Email is required." },
      });
    }

    const user = await findUserByEmail(email);
    if (user) {
      const token = await createEmailToken(user.id, "reset");
      await sendPasswordResetEmail({
        to: user.email,
        name: "Alumnus", // We don't have user.first_name here
        token,
      });
    }

    req.flash("success", successMessage);
    res.redirect("/forgot-password");
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Reset Password
// ---------------------------------------------------------------------------

export async function showResetPasswordForm(req, res, next) {
  try {
    const { token } = req.query;
    if (!token) return res.redirect("/login");

    const userId = await verifyEmailToken(token, "reset");
    if (!userId) {
      return res.render("auth/message", {
        title: "Invalid Link",
        message: "This password reset link is invalid or has expired.",
        layout: "layouts/public",
      });
    }

    res.render("auth/reset-password", {
      title: "Reset Password — HOSA",
      layout: "layouts/public",
      token,
      values: {},
      fieldErrors: {},
    });
  } catch (err) {
    next(err);
  }
}

export async function submitResetPassword(req, res, next) {
  try {
    const { token, password, confirm_password } = req.body;

    if (!token) return res.redirect("/login");

    const userId = await verifyEmailToken(token, "reset");
    if (!userId) {
      return res.render("auth/message", {
        title: "Invalid Link",
        message: "This password reset link is invalid or has expired.",
        layout: "layouts/public",
      });
    }

    const fieldErrors = {};
    if (password !== confirm_password) {
      fieldErrors.confirm_password = "Passwords do not match.";
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) fieldErrors.password = strengthError;

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).render("auth/reset-password", {
        title: "Reset Password — HOSA",
        layout: "layouts/public",
        token,
        values: { email: req.body.email },
        fieldErrors,
      });
    }

    const newHash = await hashPassword(password);
    await updateUserPassword(userId, newHash);
    await markTokenUsed(token);

    // Invalidate all existing sessions for this user (security)
    // We use the imported `query` function now.
    await query(`DELETE FROM session WHERE sess::jsonb->>'userId' = $1`, [
      userId,
    ]);

    req.flash(
      "success",
      "Your password has been reset. Please log in with your new password.",
    );
    res.redirect("/login");
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Resend Verification
// ---------------------------------------------------------------------------

export async function resendVerification(req, res, next) {
  try {
    if (!req.user) return res.redirect("/login");
    if (req.user.email_verified_at) {
      return res.redirect("/dashboard");
    }

    const token = await createEmailToken(req.user.id, "verification");
    await sendVerificationEmail({
      to: req.user.email,
      name: req.profile?.first_name || "Alumnus",
      token,
    });

    req.flash("success", "Verification email resent. Please check your inbox.");
    res.redirect("/verify-required");
  } catch (err) {
    next(err);
  }
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
