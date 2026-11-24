import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getProfileByUserId: vi.fn(),
  profileCompletion: vi.fn(),
  listMyUpcomingRsvps: vi.fn(),
  listMyRequests: vi.fn(),
  getFinancialSummary: vi.fn(),
  listPublicExpenseSummaries: vi.fn(),
  listPublicCompletedExpenseSummaries: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({
  query: mocks.query,
}));

vi.mock("../src/models/profileModel.js", () => ({
  getProfileByUserId: mocks.getProfileByUserId,
  profileCompletion: mocks.profileCompletion,
}));

vi.mock("../src/models/rsvpModel.js", () => ({
  listMyUpcomingRsvps: mocks.listMyUpcomingRsvps,
}));

vi.mock("../src/models/mentorshipModel.js", () => ({
  listMyRequests: mocks.listMyRequests,
}));

vi.mock("../src/models/financeModel.js", () => ({
  getFinancialSummary: mocks.getFinancialSummary,
  listPublicExpenseSummaries: mocks.listPublicExpenseSummaries,
  listPublicCompletedExpenseSummaries:
    mocks.listPublicCompletedExpenseSummaries,
}));

import { showDashboard } from "../src/controllers/memberController.js";

describe("Member dashboard", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: { id: "member-id" },
    };

    res = {
      render: vi.fn(),
    };

    next = vi.fn();

    mocks.getProfileByUserId.mockResolvedValue({
      first_name: "Test",
      last_name: "Member",
    });

    mocks.profileCompletion.mockReturnValue(80);

    mocks.listMyUpcomingRsvps.mockResolvedValue([]);

    mocks.listMyRequests.mockResolvedValue({
      received: [],
      sent: [],
    });

    mocks.getFinancialSummary.mockResolvedValue({
      totalIncome: 500000,
      totalExpenses: 100000,
      netBalance: 400000,
    });

    mocks.listPublicExpenseSummaries.mockResolvedValue([
      {
        id: "active-expense-id",
        title: "School outreach transport",
        status: "pending",
      },
    ]);

    mocks.listPublicCompletedExpenseSummaries.mockResolvedValue([
      {
        id: "completed-expense-id",
        title: "School materials",
        status: "paid",
        approval_stage: "completed",
      },
    ]);
  });

  it("loads active and completed public expenses for the dashboard", async () => {
    await showDashboard(req, res, next);

    expect(mocks.listPublicExpenseSummaries).toHaveBeenCalledWith({
      limit: 100,
    });

    expect(mocks.listPublicCompletedExpenseSummaries).toHaveBeenCalledWith({
      limit: 100,
    });

    expect(res.render).toHaveBeenCalledWith(
      "dashboard",
      expect.objectContaining({
        publicExpenses: [
          expect.objectContaining({
            id: "active-expense-id",
          }),
        ],
        completedExpenses: [
          expect.objectContaining({
            id: "completed-expense-id",
          }),
        ],
        layout: "layouts/app",
      }),
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("preserves the existing dashboard data", async () => {
    await showDashboard(req, res, next);

    expect(res.render).toHaveBeenCalledWith(
      "dashboard",
      expect.objectContaining({
        completion: 80,
        rsvps: [],
        activeMentorship: 0,
        finance: expect.objectContaining({
          totalIncome: 500000,
          totalExpenses: 100000,
        }),
      }),
    );
  });

  it("forwards errors when loading dashboard data fails", async () => {
    const error = new Error("Unable to load completed expenses");

    mocks.listPublicCompletedExpenseSummaries.mockRejectedValue(error);

    await showDashboard(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.render).not.toHaveBeenCalled();
  });
});