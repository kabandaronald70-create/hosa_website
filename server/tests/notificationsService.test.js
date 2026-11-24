import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  notifyProjectProposalSubmitted,
  notifyProjectApprovalDecision,
  notifyExpenseApprovalDecision,
  notifyExpenseApprovalRequired,
} from "../src/services/notificationsService.js";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  createNotification: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../src/config/db.js", () => ({
  query: mocks.query,
}));

vi.mock("../src/models/notificationModel.js", () => ({
  createNotification: mocks.createNotification,
}));

vi.mock("../src/utils/logger.js", () => ({
  logger: mocks.logger,
}));

describe("Project proposal notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createNotification.mockResolvedValue({ id: "notification-id" });
    mocks.query.mockResolvedValue({ rows: [] });
  });

  it("notifies Projects Managers when a regional proposal is submitted", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "projects-manager" }],
    });

    await notifyProjectProposalSubmitted({
      id: "regional-project",
      title: "Regional Library Project",
      region: "Central",
      created_by: "regional-officer",
      proposal_source: "regional_outreach",
      approval_stage: "projects_manager",
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][0]).toContain("TRIM(office_title) = $1");
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "Projects Manager",
      "regional-officer",
    ]);

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "projects-manager",
        type: "project.approval_required",
        link: "/admin/project-proposals",
      }),
    );
  });

  it("notifies eligible Chairpersons when a Projects Manager submits a proposal, excluding the submitter", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "independent-chairperson" }],
    });

    await notifyProjectProposalSubmitted({
      id: "pm-project",
      title: "School Laboratory Upgrade",
      region: "Central",
      created_by: "projects-manager",
      proposal_source: "projects_manager",
      approval_stage: "chairperson",
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "Chairperson",
      "projects-manager",
    ]);

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "independent-chairperson",
        type: "project.approval_required",
      }),
    );

    expect(mocks.createNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "projects-manager",
      }),
    );
  });

  it("notifies the regional submitter with the rejection reason", async () => {
    await notifyProjectApprovalDecision({
      project: {
        id: "regional-project",
        title: "Regional Library Project",
        created_by: "regional-officer",
        proposal_source: "regional_outreach",
        rejection_reason: "Insufficient supporting information.",
      },
      actorUserId: "projects-manager",
      decision: "rejected",
      nextStage: "rejected",
    });

    expect(mocks.query).not.toHaveBeenCalled();

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createNotification).toHaveBeenCalledWith({
      userId: "regional-officer",
      type: "project.proposal_rejected",
      title: "Project Proposal Not Approved",
      body: expect.stringContaining("Insufficient supporting information."),
      link: "/regional/dashboard",
    });
  });

  it("notifies the next eligible Chairperson after Projects Manager approval", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "independent-chairperson" }],
    });

    await notifyProjectApprovalDecision({
      project: {
        id: "regional-project",
        title: "Regional Library Project",
        region: "Central",
        created_by: "regional-officer",
        proposal_source: "regional_outreach",
      },
      actorUserId: "projects-manager",
      decision: "approved",
      nextStage: "chairperson",
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "Chairperson",
      "projects-manager",
    ]);

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "independent-chairperson",
        type: "project.approval_required",
      }),
    );
  });

  it("notifies the submitter when final Super Admin approval is granted", async () => {
    await notifyProjectApprovalDecision({
      project: {
        id: "regional-project",
        title: "Regional Library Project",
        created_by: "regional-officer",
        proposal_source: "regional_outreach",
      },
      actorUserId: "super-admin",
      decision: "approved",
      nextStage: "completed",
    });

    expect(mocks.query).not.toHaveBeenCalled();

    expect(mocks.createNotification).toHaveBeenCalledWith({
      userId: "regional-officer",
      type: "project.proposal_approved",
      title: "Project Proposal Approved",
      body: expect.stringContaining("passed all approval stages"),
      link: "/regional/dashboard",
    });
  });

  it("does not throw when a notification cannot be created", async () => {
    mocks.createNotification.mockRejectedValueOnce(
      new Error("Notification database unavailable"),
    );

    await expect(
      notifyProjectApprovalDecision({
        project: {
          id: "regional-project",
          title: "Regional Library Project",
          created_by: "regional-officer",
          proposal_source: "regional_outreach",
          rejection_reason: "Missing documents.",
        },
        actorUserId: "projects-manager",
        decision: "rejected",
        nextStage: "rejected",
      }),
    ).resolves.toBeUndefined();

    expect(mocks.logger.error).toHaveBeenCalled();
  });
});

describe("Expense approval notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createNotification.mockResolvedValue({
      id: "notification-id",
    });
    mocks.query.mockResolvedValue({ rows: [] });
  });

  it("excludes both the requester and previous approver from next-stage notifications", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "treasurer-user" }],
    });

    await notifyExpenseApprovalDecision({
      expense: {
        id: "expense-004",
        title: "Regional Outreach Transport",
        amount: 500000,
        requested_by: "regional-officer",
        submitted_role: "regional_outreach_officer",
        approval_stage: "treasurer",
      },
      actorUserId: "projects-manager",
      decision: "approved",
      approvedStage: "projects_manager",
      nextStage: "treasurer",
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "treasurer",
      "projects-manager",
      "regional-officer",
    ]);

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "regional-officer",
        type: "finance.expense_stage_approved",
      }),
    );

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "treasurer-user",
        type: "finance.expense_pending",
      }),
    );
  });

  it("excludes suspended and deactivated Super Admin accounts from approval notifications", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "active-super-admin" }],
    });

    await notifyExpenseApprovalDecision({
      expense: {
        id: "expense-005",
        title: "School Development",
        amount: 900000,
        requested_by: "regional-officer",
        submitted_role: "regional_outreach_officer",
        approval_stage: "super_admin",
      },
      actorUserId: "chairperson-user",
      decision: "approved",
      approvedStage: "chairperson",
      nextStage: "super_admin",
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);

    const sql = mocks.query.mock.calls[0][0];

    expect(sql).toContain("COALESCE(u.status, '')");
    expect(sql).toContain("'suspended'");
    expect(sql).toContain("'deactivated'");

    expect(mocks.query.mock.calls[0][1]).toEqual([
      "chairperson-user",
      "regional-officer",
    ]);

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "active-super-admin",
        type: "finance.expense_pending",
      }),
    );
  });

  it("notifies active Treasurers after final Super Admin approval", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "treasurer-user" }],
    });

    await notifyExpenseApprovalDecision({
      expense: {
        id: "expense-001",
        title: "Regional Outreach Transport",
        amount: 500000,
        requested_by: "regional-officer",
        submitted_role: "regional_outreach_officer",
        approval_stage: "payment",
      },
      actorUserId: "super-admin",
      decision: "approved",
      approvedStage: "super_admin",
      nextStage: "payment",
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][0]).toContain(
      "LOWER(TRIM(lr.office_title)) = $1",
    );
    expect(mocks.query.mock.calls[0][1]).toEqual(["treasurer", null, null]);

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "treasurer-user",
        type: "finance.expense_payment_required",
        title: "Expense Awaiting Payment",
        body: expect.stringContaining(
          "The Super Admin has granted final approval",
        ),
        link: "/admin/finance",
      }),
    );
  });

  it("notifies the Treasurer even when the Treasurer submitted the expense", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "treasurer-user" }],
    });

    await notifyExpenseApprovalDecision({
      expense: {
        id: "expense-002",
        title: "Office Equipment",
        amount: 800000,
        requested_by: "treasurer-user",
        submitted_role: "treasurer",
        approval_stage: "payment",
      },
      actorUserId: "super-admin",
      decision: "approved",
      approvedStage: "super_admin",
      nextStage: "payment",
    });

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "treasurer-user",
        type: "finance.expense_stage_approved",
      }),
    );

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "treasurer-user",
        type: "finance.expense_payment_required",
      }),
    );
  });

  it("notifies the requester when the Treasurer records payment", async () => {
    await notifyExpenseApprovalDecision({
      expense: {
        id: "expense-003",
        title: "School Outreach Materials",
        amount: 350000,
        requested_by: "regional-officer",
        submitted_role: "regional_outreach_officer",
        approval_stage: "completed",
      },
      actorUserId: "treasurer-user",
      decision: "paid",
    });

    expect(mocks.query).not.toHaveBeenCalled();

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "regional-officer",
        type: "finance.expense_paid",
        title: "Expense Payment Recorded",
        body: expect.stringContaining("has been recorded by the Treasurer"),
        link: "/regional/dashboard",
      }),
    );
  });
});

describe("Expense submission notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.createNotification.mockResolvedValue({
      id: "notification-id",
    });

    mocks.query.mockResolvedValue({ rows: [] });
  });

  it("notifies the first eligible Treasurer and excludes the submitter", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "treasurer-user" }],
    });

    await notifyExpenseApprovalRequired({
      expense: {
        id: "expense-submission-001",
        title: "Transport Expenses",
        amount: 150000,
        requested_by: "requesting-member",
      },
      stage: "treasurer",
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);

    expect(mocks.query.mock.calls[0][1]).toEqual([
      "treasurer",
      "requesting-member",
      null,
    ]);

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "treasurer-user",
        type: "finance.expense_pending",
        title: "Expense Approval Required",
        link: "/admin/finance",
      }),
    );

    expect(mocks.createNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "requesting-member",
      }),
    );
  });

  it("notifies the Projects Manager for a Regional Outreach expense", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "projects-manager" }],
    });

    await notifyExpenseApprovalRequired({
      expense: {
        id: "regional-expense-submission-001",
        title: "Regional Activity",
        amount: 200000,
        requested_by: "regional-officer",
      },
      stage: "projects_manager",
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);

    expect(mocks.query.mock.calls[0][1]).toEqual([
      "projects manager",
      "regional-officer",
      null,
    ]);

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "projects-manager",
        type: "finance.expense_pending",
        title: "Expense Approval Required",
        link: "/admin/projects",
      }),
    );

    expect(mocks.createNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "regional-officer",
      }),
    );
  });

  it("does not notify approvers when no expense record is supplied", async () => {
    await notifyExpenseApprovalRequired({
      expense: null,
      expenseTitle: "Missing expense",
      stage: "treasurer",
    });

    expect(mocks.query).not.toHaveBeenCalled();

    expect(mocks.createNotification).not.toHaveBeenCalled();

    expect(mocks.logger.warn).toHaveBeenCalled();
  });
});
