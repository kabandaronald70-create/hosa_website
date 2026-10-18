import { Resend } from "resend";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Only initialize if we have a key (prevents crashes in test env)
const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

const FROM = env.emailFrom || "HOSA <onboarding@resend.dev>";

async function send({ to, subject, html }) {
  if (!resend) {
    logger.warn("Email not sent: RESEND_API_KEY is missing.");
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    logger.error({ err }, "Failed to send email via Resend");
  }
}

export async function sendVerificationEmail({ to, name, token }) {
  const verifyUrl = `${env.appOrigin}/verify-email?token=${token}`;
  const html = `
    <h2>Welcome to HOSA, ${name}!</h2>
    <p>Please verify your email address to activate your account.</p>
    <p><a href="${verifyUrl}" style="background:#0F4C3A;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Verify Email</a></p>
    <p>Or copy this link: ${verifyUrl}</p>
  `;
  return send({ to, subject: "Verify your HOSA account", html });
}

export async function sendPasswordResetEmail({ to, name, token }) {
  const resetUrl = `${env.appOrigin}/reset-password?token=${token}`;
  const html = `
    <h2>Password Reset</h2>
    <p>Hi ${name}, you requested a password reset.</p>
    <p><a href="${resetUrl}" style="background:#0F4C3A;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Reset Password</a></p>
    <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  `;
  return send({ to, subject: "Reset your HOSA password", html });
}
