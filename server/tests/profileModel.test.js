import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../src/config/db.js", () => db);

import { getPublicAvatarProfileByUserId } from "../src/models/profileModel.js";

describe("Public avatar profile lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an avatar profile only through the public eligibility query", async () => {
    const profile = {
      user_id: "approved-member-id",
      avatar_path: "approved-member-id/avatar.webp",
    };

    db.query.mockResolvedValueOnce({
      rows: [profile],
    });

    await expect(
      getPublicAvatarProfileByUserId("approved-member-id"),
    ).resolves.toEqual(profile);

    expect(db.query).toHaveBeenCalledTimes(1);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("JOIN users u ON u.id = mp.user_id");
    expect(sql).toContain("mp.public_visibility = TRUE");
    expect(sql).toContain("u.membership_approved_at IS NOT NULL");
    expect(sql).toContain("u.status = 'active'");
    expect(params).toEqual(["approved-member-id"]);
  });

  it("returns null when the profile is not publicly eligible", async () => {
    db.query.mockResolvedValueOnce({
      rows: [],
    });

    await expect(
      getPublicAvatarProfileByUserId("pending-member-id"),
    ).resolves.toBeNull();

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][1]).toEqual(["pending-member-id"]);
  });
});
