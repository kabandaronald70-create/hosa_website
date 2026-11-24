import { describe, it, expect, vi } from "vitest";
import {
  requireFinanceAccess,
  requireExpenseWorkflowAccess,
} from "../src/middleware/requireFinanceAccess.js";

function createMocks({ userRoles = [], leadershipRoles = [] } = {}) {
  const req = {
    userRoles,
    leadershipRoles,
    flash: vi.fn(),
  };

  const res = {
    redirect: vi.fn(),
  };

  const next = vi.fn();

  return { req, res, next };
}

describe("requireFinanceAccess", () => {
  it("allows a Super Admin", () => {
    const { req, res, next } = createMocks({
      userRoles: ["super_admin"],
    });

    requireFinanceAccess(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("allows an appointed Treasurer without an admin system role", () => {
    const { req, res, next } = createMocks({
      userRoles: ["member"],
      leadershipRoles: ["Treasurer"],
    });

    requireFinanceAccess(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("denies an appointed Chairperson without an authorized finance role", () => {
    const { req, res, next } = createMocks({
      userRoles: ["member"],
      leadershipRoles: ["Chairperson"],
    });

    requireFinanceAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("denies an ordinary member", () => {
    const { req, res, next } = createMocks({
      userRoles: ["member"],
    });

    requireFinanceAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(req.flash).toHaveBeenCalledWith(
      "error",
      "Access denied. Only the Treasurer and Super Admin can perform this financial operation.",
    );
    expect(res.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("denies a moderator without an authorized finance leadership role", () => {
    const { req, res, next } = createMocks({
      userRoles: ["moderator"],
    });

    requireFinanceAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("denies requests with missing role arrays safely", () => {
    const { req, res, next } = createMocks({
      userRoles: undefined,
      leadershipRoles: undefined,
    });

    requireFinanceAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith("/dashboard");
  });
});

describe("requireExpenseWorkflowAccess", () => {
  it.each([
    "Outreach Officer (Eastern)",
    "Outreach Officer (Central)",
    "Outreach Officer (Western)",
    "Outreach Officer (Northern)",
  ])("allows %s to access expense workflow routes", (role) => {
    const { req, res, next } = createMocks({
      userRoles: ["member"],
      leadershipRoles: [role],
    });

    requireExpenseWorkflowAccess(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("does not grant ordinary members expense workflow access", () => {
    const { req, res, next } = createMocks({
      userRoles: ["member"],
    });

    requireExpenseWorkflowAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith("/dashboard");
  });
});
