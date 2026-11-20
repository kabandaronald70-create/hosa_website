import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("../src/config/db.js", () => db);

import { getMentorPublicById } from "../src/models/mentorshipModel.js";

describe("Public mentorship mentor lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an approved mentor who opted into mentoring and public visibility", async () => {
    const mentor = {
      user_id: "approved-mentor-id",
      display_name: "Approved Mentor",
      first_name: "Approved",
      last_name: "Mentor",
      mentor_field: "Software Development",
      public_visibility: true,
    };

    db.query.mockResolvedValueOnce({
      rows: [mentor],
    });

    await expect(
      getMentorPublicById("approved-mentor-id"),
    ).resolves.toEqual(mentor);

    expect(db.query).toHaveBeenCalledTimes(1);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("JOIN users u ON u.id = mp.user_id");
    expect(sql).toContain(
      "u.membership_approved_at IS NOT NULL",
    );
    expect(sql).toContain("mp.mentor_opt_in = TRUE");
    expect(sql).toContain("mp.public_visibility = TRUE");
    expect(params).toEqual(["approved-mentor-id"]);
  });

  it("returns null when no eligible approved mentor is found", async () => {
    db.query.mockResolvedValueOnce({
      rows: [],
    });

    await expect(
      getMentorPublicById("pending-mentor-id"),
    ).resolves.toBeNull();

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][1]).toEqual([
      "pending-mentor-id",
    ]);
  });
});
