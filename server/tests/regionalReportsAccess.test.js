import { describe, it, expect, vi } from "vitest";
import { requireRegionalReportsAccess } from "../src/middleware/requireRegionalReportsAccess.js";

function createMocks({
  user = { id: "user-1" },
  userRoles = [],
  leadershipRoles = [],
  originalUrl = "/admin/regional-reports",
} = {}) {
  const req = {
    user,
    userRoles,
    leadershipRoles,
    originalUrl,
  };

  const res = {
    redirect: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };

  const next = vi.fn();

  return { req, res, next };
}

describe("Regional Reports Authorization", () => {
  it("allows a Super Admin", () => {
    const { req, res, next } = createMocks({
      userRoles: ["super_admin"],
    });

    requireRegionalReportsAccess(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows an active Chairperson", () => {
    const { req, res, next } = createMocks({
      leadershipRoles: ["Chairperson"],
    });

    requireRegionalReportsAccess(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("allows an active Projects Manager", () => {
    const { req, res, next } = createMocks({
      leadershipRoles: ["Projects Manager"],
    });

    requireRegionalReportsAccess(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it.each(["admin", "moderator"])("denies an ordinary %s", (role) => {
    const { req, res, next } = createMocks({
      userRoles: [role],
    });

    requireRegionalReportsAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalled();
  });

  it("denies an ordinary member", () => {
    const { req, res, next } = createMocks();

    requireRegionalReportsAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("redirects unauthenticated visitors to login", () => {
    const { req, res, next } = createMocks({
      user: null,
      originalUrl: "/admin/regional-reports?status=pending",
    });

    requireRegionalReportsAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      "/login?next=%2Fadmin%2Fregional-reports%3Fstatus%3Dpending",
    );
  });

  it("denies users without an active leadership appointment", () => {
    const { req, res, next } = createMocks({
      leadershipRoles: [],
    });

    requireRegionalReportsAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
