import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  getDummyHash,
} from "../src/services/passwordService.js";

describe("Password Service", () => {
  it("hashes a password using argon2id", async () => {
    const hash = await hashPassword("correct horse battery staple");

    // Ensure it uses argon2id, not plain text or md5
    expect(hash).toMatch(/^\$argon2id\$/);

    // Ensure verifying works
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(
      true,
    );

    // Ensure wrong passwords fail
    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });

  it("rejects passwords shorter than 5 characters", () => {
    const err = validatePasswordStrength("abcd");
    expect(err).toMatch(/at least 5 characters/);
  });

  it("accepts a strong password", () => {
    expect(validatePasswordStrength("this-is-a-very-strong-password")).toBe(
      null,
    );
  });

  it("returns a dummy hash to prevent timing attacks", async () => {
    const dummy = await getDummyHash();
    expect(dummy).toMatch(/^\$argon2id\$/);
  });
});
