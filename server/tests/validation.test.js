import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
} from "../src/validators/authValidators.js";
import {
  storySubmissionSchema,
  opportunitySubmissionSchema,
} from "../src/validators/submissionValidators.js";

const validOldStudent = {
  first_name: "Test",
  last_name: "User",

  school_status: "old_student",
  admission_year: "2011",
  completion_year: "2015",
  last_class_attended: "S6",

  email: "test@example.com",
  phone: "+256 700 000000",
  country_code: "UG",
  district: "Kampala",
  town_city: "Kampala",
  region: "Central",

  employment_status: "employed",
  profession: "Software Engineer",
  business_owner: "false",

  interests: ["networking", "career_development"],

  username: "test.user",
  password: "password123",
  confirm_password: "password123",

  terms_accepted: "on",
  privacy_accepted: "on",
  declaration_accepted: "on",
};

const validCurrentStudent = {
  ...validOldStudent,
  school_status: "current_student",
  admission_year: "2023",
  completion_year: "",
  expected_completion_year: "2027",
};

describe("Registration Validators", () => {
  it("accepts a valid old-student registration", () => {
    const result = registerSchema.safeParse(validOldStudent);

    expect(result.success).toBe(true);
  });

  it("accepts a valid current-student registration", () => {
    const result = registerSchema.safeParse(validCurrentStudent);

    expect(result.success).toBe(true);
  });

  it("rejects mismatched password confirmation", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      confirm_password: "different123",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues.some(
        (issue) => issue.path.includes("confirm_password"),
      )).toBe(true);
    }
  });

  it("requires an actual completion year for old students", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      completion_year: "",
    });

    expect(result.success).toBe(false);
  });

  it("does not allow old students to enter an expected completion year", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      expected_completion_year: "2027",
    });

    expect(result.success).toBe(false);
  });

  it("requires an expected completion year for current students", () => {
    const result = registerSchema.safeParse({
      ...validCurrentStudent,
      expected_completion_year: "",
    });

    expect(result.success).toBe(false);
  });

  it("does not allow current students to enter an actual completion year", () => {
    const result = registerSchema.safeParse({
      ...validCurrentStudent,
      completion_year: "2025",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a completion year earlier than admission year", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      admission_year: "2015",
      completion_year: "2011",
    });

    expect(result.success).toBe(false);
  });

  it("requires an explanation when Other is selected for the last class", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      last_class_attended: "other",
      last_class_explanation: "",
    });

    expect(result.success).toBe(false);
  });

  it("requires an explanation when Other is selected for the school house", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      school_house: "Other",
      school_house_other: "",
    });

    expect(result.success).toBe(false);
  });

  it("requires an explanation when Other is selected for examination level", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      examination_level: "other",
      examination_level_other: "",
    });

    expect(result.success).toBe(false);
  });

  it("requires a valid country code", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      country_code: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts an East African country code regardless of letter case", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      country_code: "ke",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.country_code).toBe("KE");
    }
  });

  it("rejects a country outside the East African options", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      country_code: "GB",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a district outside the Ugandan district options", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      district: "Nairobi",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unrecognised Ugandan city", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      town_city: "Kiganda",
    });

    expect(result.success).toBe(false);
  });

  it("allows town/city to remain optional", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      town_city: "",
    });

    expect(result.success).toBe(true);
  });

  it("requires a town/city when Other is selected", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      town_city: "Other",
      town_city_other: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts an entered town/city when Other is selected", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      town_city: "Other",
      town_city_other: "Kiganda",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.town_city_other).toBe("Kiganda");
    }
  });

  it("rejects a town/city Other value when Other is not selected", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      town_city: "Kampala",
      town_city_other: "Kiganda",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a nationality outside the East African options", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      nationality: "British",
    });

    expect(result.success).toBe(false);
  });

  it("allows nationality to remain optional", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      nationality: "",
    });

    expect(result.success).toBe(true);
  });

  it("requires a nationality when Other is selected", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      nationality: "Other",
      nationality_other: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts an entered nationality when Other is selected", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      nationality: "Other",
      nationality_other: "British",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.nationality_other).toBe("British");
    }
  });

  it("rejects a nationality Other value when Other is not selected", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      nationality: "Uganda",
      nationality_other: "British",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid HOSA region", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      region: "Southern",
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one interest", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      interests: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unsupported interest", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      interests: ["networking", "politics"],
    });

    expect(result.success).toBe(false);
  });

  it("requires a valid username", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      username: "ab",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported username characters", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      username: "test user!",
    });

    expect(result.success).toBe(false);
  });

  it("requires all three policy acknowledgements", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      terms_accepted: "",
      privacy_accepted: "",
      declaration_accepted: "",
    });

    expect(result.success).toBe(false);
  });

  it("requires business name and category when the applicant owns a business", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      business_owner: "true",
      business_name: "",
      business_category: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts complete business ownership details", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      business_owner: "true",
      business_name: "Kabanda Technologies",
      business_category: "Technology",
      business_description: "Software and technology services.",
      business_website: "https://example.com",
    });

    expect(result.success).toBe(true);
  });

  it("rejects business details when the applicant says they do not own a business", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      business_owner: "false",
      business_name: "Kabanda Technologies",
      business_category: "Technology",
    });

    expect(result.success).toBe(false);
  });

  it("requires a WhatsApp number when WhatsApp is the preferred contact method", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      preferred_contact: "whatsapp",
      whatsapp_phone: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts registration when skills are omitted", () => {
    const result = registerSchema.safeParse(validOldStudent);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.skills).toBeUndefined();
    }
  });

  it("accepts whitespace-only skills as empty", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      skills: "      ",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.skills).toBeUndefined();
    }
  });

  it("accepts skills containing exactly 500 characters", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      skills: "A".repeat(500),
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.skills).toHaveLength(500);
    }
  });

  it("rejects skills exceeding 500 characters", () => {
    const result = registerSchema.safeParse({
      ...validOldStudent,
      skills: "A".repeat(501),
    });

    expect(result.success).toBe(false);
  });

  it("allows optional professional and contact fields to remain empty", () => {
    const result = registerSchema.safeParse(validOldStudent);

    expect(result.success).toBe(true);
  });

  it("does not require public directory visibility", () => {
    const result = registerSchema.safeParse(validOldStudent);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.public_visibility).toBe(false);
    }
  });
});

describe("Login Validators", () => {
  it("accepts an email address as the login identifier", () => {
    const result = loginSchema.safeParse({
      identifier: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a username as the login identifier", () => {
    const result = loginSchema.safeParse({
      identifier: "test.user",
      password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty login identifier", () => {
    const result = loginSchema.safeParse({
      identifier: "",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("requires a password", () => {
    const result = loginSchema.safeParse({
      identifier: "test.user",
      password: "",
    });

    expect(result.success).toBe(false);
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
      body: "A".repeat(100),
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
