import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { pool } from "../src/config/db.js";

const app = createApp();
const agent = request.agent(app);

let csrfToken;

beforeAll(async () => {
  const page = await agent.get("/register");

  expect(page.status).toBe(200);

  const match = page.text.match(
    /<input[^>]*type="hidden"[^>]*name="_csrf"[^>]*value="([^"]+)"/i,
  );

  expect(match).not.toBeNull();

  csrfToken = match[1];
});

describe("Public API", () => {
  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/directory returns a valid list of members", async () => {
    const res = await request(app).get("/api/directory?limit=2");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeLessThanOrEqual(2);

    for (const member of res.body.data) {
      expect(member).toHaveProperty("name");
      expect(member).toHaveProperty("profession");
    }
  });

  it("GET /api/events returns a list of events", async () => {
    const res = await request(app).get("/api/events");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("GET /api/me returns null for unauthenticated users", async () => {
    const res = await request(app).get("/api/me");

    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});

describe("Protected API (Auth Guards)", () => {
  it("POST /api/saved rejects unauthenticated requests", async () => {
    const res = await agent
      .post("/api/saved")
      .set("x-csrf-token", csrfToken)
      .send({
        item_type: "member",
        item_id: "m001",
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Authentication required/i);
  });

  it("POST /api/rsvp rejects unauthenticated requests", async () => {
    const res = await agent
      .post("/api/rsvp/hosa-annual-general-meeting-2026-e001")
      .set("x-csrf-token", csrfToken)
      .send({ status: "going" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Authentication required/i);
  });
});

describe("Member registration integration", () => {
  const registrationAgent = request.agent(app);

  const uniqueId = `${Date.now()}`;
  const testEmail = `hosa.integration.${uniqueId}@example.test`;
  const testUsername = `h_test_${uniqueId}`;

  let registrationCsrfToken;

  // Track every successfully created account for reliable cleanup.
  const createdUserIds = new Set();

  beforeAll(async () => {
    const page = await registrationAgent.get("/register");

    expect(page.status).toBe(200);

    const match = page.text.match(
      /<input[^>]*type="hidden"[^>]*name="_csrf"[^>]*value="([^"]+)"/i,
    );

    expect(match).not.toBeNull();

    registrationCsrfToken = match[1];
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
  });

  // --------------------------------------------------
  // Reusable registration helper
  // --------------------------------------------------

  async function submitRegistration(overrides = {}) {
    const testAgent = request.agent(app);

    const page = await testAgent.get("/register");

    expect(page.status).toBe(200);

    const match = page.text.match(
      /<input[^>]*type="hidden"[^>]*name="_csrf"[^>]*value="([^"]+)"/i,
    );

    expect(match).not.toBeNull();

    const timestamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const values = {
      first_name: "Integration",
      last_name: "Additional",

      school_status: "old_student",
      admission_year: "2012",
      last_class_attended: "S4",
      completion_year: "2016",

      email: `hosa.additional.${timestamp}@example.test`,
      phone: "+256700000002",
      country_code: "UG",
      district: "Kasanda",
      region: "Central",

      employment_status: "employed",
      profession: "Integration Tester",
      business_owner: "no",

      username: `h_add_${timestamp}`,
      password: "TestPassword123!",
      confirm_password: "TestPassword123!",

      terms_accepted: "on",
      privacy_accepted: "on",
      declaration_accepted: "on",

      ...overrides,
    };

    // Remove explicitly omitted optional or conditional fields.
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null) {
        delete values[key];
      }
    }

    const form = new URLSearchParams(values);

    form.append("interests", "mentorship");

    const response = await testAgent
      .post("/register")
      .set("x-csrf-token", match[1])
      .type("form")
      .send(form.toString());

    return {
      agent: testAgent,
      response,
      values,
    };
  }

  // --------------------------------------------------
  // Reusable login helper
  // --------------------------------------------------

  async function loginWith(identifier) {
    const loginAgent = request.agent(app);

    const page = await loginAgent.get("/login");

    expect(page.status).toBe(200);

    const match = page.text.match(
      /<input[^>]*type="hidden"[^>]*name="_csrf"[^>]*value="([^"]+)"/i,
    );

    expect(match).not.toBeNull();

    const response = await loginAgent
      .post("/login")
      .set("x-csrf-token", match[1])
      .type("form")
      .send(
        new URLSearchParams({
          identifier,
          password: "TestPassword123!",
        }).toString(),
      );

    return {
      agent: loginAgent,
      response,
    };
  }

  // --------------------------------------------------
  // 1. Old student registration
  // --------------------------------------------------

  it("registers a new old student and persists all required records", async () => {
    const form = new URLSearchParams({
      first_name: "Integration",
      last_name: "Tester",

      school_status: "old_student",
      admission_year: "2012",
      last_class_attended: "S4",
      completion_year: "2016",

      email: testEmail,
      phone: "+256700000001",
      country_code: "UG",
      district: "Kasanda",
      region: "Central",

      employment_status: "employed",
      profession: "Integration Tester",

      business_owner: "no",

      username: testUsername,
      password: "TestPassword123!",
      confirm_password: "TestPassword123!",

      terms_accepted: "on",
      privacy_accepted: "on",
      declaration_accepted: "on",
    });

    form.append("interests", "mentorship");
    form.append("interests", "networking");

    const response = await registrationAgent
      .post("/register")
      .set("x-csrf-token", registrationCsrfToken)
      .type("form")
      .send(form.toString());

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/");

    // --------------------------------------------------
    // Verify the account.
    // --------------------------------------------------

    const accountResult = await pool.query(
      `SELECT id, username, email, status, password_hash
       FROM users
       WHERE email = $1`,
      [testEmail],
    );

    expect(accountResult.rowCount).toBe(1);

    const account = accountResult.rows[0];

    createdUserIds.add(account.id);

    const createdUserId = account.id;

    expect(account.username).toBe(testUsername);
    expect(account.status).toBe("pending_approval");
    expect(account.password_hash).not.toBe("TestPassword123!");
    expect(account.password_hash).toBeTruthy();

    // --------------------------------------------------
    // Verify member profile and privacy defaults.
    // --------------------------------------------------

    const profileResult = await pool.query(
      `SELECT first_name, last_name, region,
              graduation_year, public_visibility
       FROM member_profiles
       WHERE user_id = $1`,
      [createdUserId],
    );

    expect(profileResult.rowCount).toBe(1);

    const profile = profileResult.rows[0];

    expect(profile.first_name).toBe("Integration");
    expect(profile.last_name).toBe("Tester");
    expect(profile.region).toBe("Central");
    expect(Number(profile.graduation_year)).toBe(2016);
    expect(profile.public_visibility).toBe(false);

    // --------------------------------------------------
    // Verify school history.
    // --------------------------------------------------

    const schoolResult = await pool.query(
      `SELECT admission_year, completion_year,
              expected_completion_year, last_class_attended
       FROM school_records
       WHERE user_id = $1`,
      [createdUserId],
    );

    expect(schoolResult.rowCount).toBe(1);

    const school = schoolResult.rows[0];

    expect(Number(school.admission_year)).toBe(2012);
    expect(Number(school.completion_year)).toBe(2016);
    expect(school.expected_completion_year).toBeNull();
    expect(school.last_class_attended).toBe("S4");

    // --------------------------------------------------
    // Verify selected interests.
    // --------------------------------------------------

    const interestsResult = await pool.query(
      `SELECT interest
       FROM member_interests
       WHERE user_id = $1
       ORDER BY interest`,
      [createdUserId],
    );

    expect(interestsResult.rows.map((row) => row.interest)).toEqual([
      "mentorship",
      "networking",
    ]);

    // --------------------------------------------------
    // Verify policy acceptance records.
    // --------------------------------------------------

    const acceptanceResult = await pool.query(
      `SELECT terms_version, terms_accepted_at,
              privacy_version, privacy_accepted_at,
              declaration_version, declaration_accepted_at
       FROM registration_acceptances
       WHERE user_id = $1`,
      [createdUserId],
    );

    expect(acceptanceResult.rowCount).toBe(1);

    const acceptance = acceptanceResult.rows[0];

    expect(acceptance.terms_version).toBe("2026-11");
    expect(acceptance.privacy_version).toBe("2026-11");
    expect(acceptance.declaration_version).toBe("1.0");

    expect(acceptance.terms_accepted_at).toBeTruthy();
    expect(acceptance.privacy_accepted_at).toBeTruthy();
    expect(acceptance.declaration_accepted_at).toBeTruthy();

    // --------------------------------------------------
    // Verify default member role.
    // --------------------------------------------------

    const roleResult = await pool.query(
      `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [createdUserId],
    );

    expect(roleResult.rows.map((row) => row.name)).toContain("member");

    // --------------------------------------------------
    // Verify pending-approval page access.
    // --------------------------------------------------

    const pendingPage = await registrationAgent.get("/pending-approval");

    expect(pendingPage.status).toBe(200);
  });

  // --------------------------------------------------
  // 2. Duplicate email protection
  // --------------------------------------------------

  it("rejects an email address registered with different capitalization", async () => {
    const { response } = await submitRegistration({
      email: testEmail.toUpperCase(),
      username: `case_${uniqueId}`,
    });

    expect(response.status).toBe(409);

    expect(response.text).toContain(
      "That email address is already registered.",
    );

    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE email_normalized = $1`,
      [testEmail.toLowerCase()],
    );

    expect(result.rows[0].count).toBe(1);
  });

  it("rejects an email address with surrounding whitespace when already registered", async () => {
    const { response } = await submitRegistration({
      email: `  ${testEmail}  `,
      username: `space_${uniqueId}`,
    });

    expect(response.status).toBe(409);

    expect(response.text).toContain(
      "That email address is already registered.",
    );

    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE email_normalized = $1`,
      [testEmail.toLowerCase()],
    );

    expect(result.rows[0].count).toBe(1);
  });

  // --------------------------------------------------
  // 3. Duplicate username protection
  // --------------------------------------------------

  it("rejects a username already assigned to another account", async () => {
    const duplicateEmail = `hosa.username.conflict.${uniqueId}@example.test`;

    const { response } = await submitRegistration({
      email: duplicateEmail,
      username: testUsername,
    });

    expect(response.status).toBe(409);

    expect(response.text).toContain("That username is already taken.");

    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE email_normalized = $1`,
      [duplicateEmail.toLowerCase()],
    );

    expect(result.rows[0].count).toBe(0);
  });

  // --------------------------------------------------
  // 4. Current student registration
  // --------------------------------------------------

  it("registers a current student with an expected completion year", async () => {
    const currentStudentEmail = `hosa.current.${uniqueId}@example.test`;

    const currentStudentUsername = `h_current_${uniqueId}`;

    const { response } = await submitRegistration({
      first_name: "Current",
      last_name: "Student",

      school_status: "current_student",
      admission_year: "2022",
      last_class_attended: "S4",
      completion_year: undefined,
      expected_completion_year: "2028",

      email: currentStudentEmail,
      username: currentStudentUsername,
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/");

    const accountResult = await pool.query(
      `SELECT id, status
       FROM users
       WHERE email_normalized = $1`,
      [currentStudentEmail.toLowerCase()],
    );

    expect(accountResult.rowCount).toBe(1);

    const account = accountResult.rows[0];

    createdUserIds.add(account.id);

    expect(account.status).toBe("pending_approval");

    const schoolResult = await pool.query(
      `SELECT admission_year, completion_year,
              expected_completion_year
       FROM school_records
       WHERE user_id = $1`,
      [account.id],
    );

    expect(schoolResult.rowCount).toBe(1);

    const school = schoolResult.rows[0];

    expect(Number(school.admission_year)).toBe(2022);
    expect(school.completion_year).toBeNull();
    expect(Number(school.expected_completion_year)).toBe(2028);
  });

  it("rejects a current student without an expected completion year", async () => {
    const invalidEmail = `hosa.current.invalid.${uniqueId}@example.test`;

    const { response } = await submitRegistration({
      school_status: "current_student",
      admission_year: "2022",
      completion_year: undefined,
      expected_completion_year: undefined,

      email: invalidEmail,
      username: `h_invalid_${uniqueId}`,
    });

    expect(response.status).toBe(400);

    expect(response.text).toContain(
      "Expected completion year is required for current students.",
    );

    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE email_normalized = $1`,
      [invalidEmail.toLowerCase()],
    );

    expect(result.rows[0].count).toBe(0);
  });

  // --------------------------------------------------
  // 5. Login using email or username
  // --------------------------------------------------

  it("allows a pending member to log in using their email address", async () => {
    const { agent: loginAgent, response } = await loginWith(testEmail);

    expect(response.status).toBe(302);

    expect(response.headers.location).toBe("/pending-approval");

    const dashboard = await loginAgent.get("/dashboard");

    expect(dashboard.status).toBe(302);

    expect(dashboard.headers.location).toBe("/pending-approval");
  });

  it("allows a pending member to log in using their username", async () => {
    const { agent: loginAgent, response } = await loginWith(testUsername);

    expect(response.status).toBe(302);

    expect(response.headers.location).toBe("/pending-approval");

    const dashboard = await loginAgent.get("/dashboard");

    expect(dashboard.status).toBe(302);

    expect(dashboard.headers.location).toBe("/pending-approval");
  });
});
