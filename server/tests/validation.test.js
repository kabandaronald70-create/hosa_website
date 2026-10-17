import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
} from "../src/validators/authValidators.js";
import {
  storySubmissionSchema,
  opportunitySubmissionSchema,
} from "../src/validators/submissionValidators.js";

describe("Auth Validators", () => {
  it("rejects mismatched password confirmation", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      confirm_password: "different",
      first_name: "Test",
      last_name: "User",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      confirm_password: "password123",
      first_name: "Test",
      last_name: "User",
      country_code: "UG",
    });
    expect(result.success).toBe(true);
  });
});

describe("Content Submission Validators", () => {
  it("rejects a story that is too short", () => {
    const result = storySubmissionSchema.safeParse({
      title: "My story",
      body: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid story", () => {
    const result = storySubmissionSchema.safeParse({
      title: "My story",
      body: "A".repeat(100), // > 50 chars
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid application URL for an opportunity", () => {
    const result = opportunitySubmissionSchema.safeParse({
      title: "New Job",
      description: "A".repeat(50),
      application_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
