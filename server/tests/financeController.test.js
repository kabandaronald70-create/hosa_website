import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFinancialSummary: vi.fn(),
  listContributions: vi.fn(),
  verifyContribution: vi.fn(),
  listExpenses: vi.fn(),
  listExpensesForChairpersonReview: vi.fn(),
  createExpense: vi.fn(),
  setExpenseStatus: vi.fn(),
  createContribution: vi.fn(),
  updatePendingExpense: vi.fn(),
  deletePendingExpense: vi.fn(),
  listAllContributionsForExport: vi.fn(),
  getExpenseById: vi.fn(),
  listAllExpensesForExport: vi.fn(),
  rejectContribution: vi.fn(),
  getMemberContributionProof: vi.fn(),
  getFinanceContributionProof: vi.fn(),

  query: vi.fn(),
  auditLog: vi.fn(),

  notifyExpenseApprovalRequired: vi.fn(),
  notifyExpenseApprovalDecision: vi.fn(),
  notifyExpenseRejected: vi.fn(),
  notifyExpenseRejectedBySuperAdmin: vi.fn(),

  listDonationProjects: vi.fn(),

  uploadContributionProofFile: vi.fn(),
  cleanupContributionProofFile: vi.fn(),
  createContributionProofSignedUrl: vi.fn(),
}));

vi.mock("../src/models/financeModel.js", () => ({
  getFinancialSummary: mocks.getFinancialSummary,
  listContributions: mocks.listContributions,
  verifyContribution: mocks.verifyContribution,
  listExpenses: mocks.listExpenses,
  listExpensesForChairpersonReview: mocks.listExpensesForChairpersonReview,
  createExpense: mocks.createExpense,
  setExpenseStatus: mocks.setExpenseStatus,
  createContribution: mocks.createContribution,
  updatePendingExpense: mocks.updatePendingExpense,
  deletePendingExpense: mocks.deletePendingExpense,
  listAllContributionsForExport: mocks.listAllContributionsForExport,
  getExpenseById: mocks.getExpenseById,
  listAllExpensesForExport: mocks.listAllExpensesForExport,
  rejectContribution: mocks.rejectContribution,
  getMemberContributionProof: mocks.getMemberContributionProof,
  getFinanceContributionProof: mocks.getFinanceContributionProof,
}));

vi.mock("../src/config/db.js", () => ({
  query: mocks.query,
}));

vi.mock("../src/services/auditService.js", () => ({
  auditLog: mocks.auditLog,
}));

vi.mock("../src/services/notificationsService.js", () => ({
  notifyExpenseApprovalRequired: mocks.notifyExpenseApprovalRequired,
  notifyExpenseApprovalDecision: mocks.notifyExpenseApprovalDecision,
  notifyExpenseRejected: mocks.notifyExpenseRejected,
  notifyExpenseRejectedBySuperAdmin: mocks.notifyExpenseRejectedBySuperAdmin,
}));

vi.mock("../src/models/projectModel.js", () => ({
  listDonationProjects: mocks.listDonationProjects,
}));

vi.mock("../src/services/contributionProofFileService.js", () => ({
  uploadContributionProofFile: mocks.uploadContributionProofFile,
  cleanupContributionProofFile: mocks.cleanupContributionProofFile,
  createContributionProofSignedUrl: mocks.createContributionProofSignedUrl,
}));

import {
  actionSubmitContribution,
  showMyContributionProof,
  showFinanceContributionProof,
  showFinanceDashboard,
  actionUpdateExpenseStatus,
  actionExportAllExpenses,
  actionExportSingleExpense,
} from "../src/controllers/financeController.js";

function createMocks({ includeFile = true, body = {} } = {}) {
  const req = {
    user: { id: "member-id" },

    body: {
      amount: "25000",
      purpose: "General Fund",
      payment_method: "Mobile Money",
      reference: "TX123",
      ...body,
    },

    file: includeFile
      ? {
          buffer: Buffer.from("test-image"),
          originalname: "payment-slip.jpg",
          mimetype: "image/jpeg",
        }
      : undefined,

    flash: vi.fn(),
  };

  const res = {
    redirect: vi.fn(),
  };

  return {
    req,
    res,
    next: vi.fn(),
  };
}

describe("Finance Controller - Contribution Submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.uploadContributionProofFile.mockResolvedValue({
      storagePath: "member-id/random-proof.jpg",
      originalName: "payment-slip.jpg",
    });

    mocks.cleanupContributionProofFile.mockResolvedValue(undefined);
  });

  it("rejects a contribution when payment proof is missing", async () => {
    const { req, res, next } = createMocks({
      includeFile: false,
    });

    await actionSubmitContribution(req, res, next);

    expect(req.flash).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("Upload an image"),
    );

    expect(res.redirect).toHaveBeenCalledWith("/dashboard/contributions");

    expect(mocks.uploadContributionProofFile).not.toHaveBeenCalled();
    expect(mocks.createContribution).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("saves the uploaded proof details with a successful contribution", async () => {
    const { req, res, next } = createMocks();

    mocks.createContribution.mockResolvedValue({
      id: "contribution-id",
      status: "pending",
    });

    await actionSubmitContribution(req, res, next);

    expect(mocks.uploadContributionProofFile).toHaveBeenCalledWith(
      "member-id",
      req.file.buffer,
      "payment-slip.jpg",
    );

    expect(mocks.createContribution).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "member-id",
        amount: 25000,
        purpose: "General Fund",
        paymentMethod: "Mobile Money",
        paymentProofPath: "member-id/random-proof.jpg",
        paymentProofName: "payment-slip.jpg",
      }),
    );

    expect(mocks.cleanupContributionProofFile).not.toHaveBeenCalled();

    expect(res.redirect).toHaveBeenCalledWith("/dashboard/contributions");

    expect(req.flash).toHaveBeenCalledWith(
      "success",
      expect.stringContaining("Treasurer will review"),
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("cleans up the uploaded proof when the selected project is no longer accepting donations", async () => {
    const projectId = "12345678-1234-1234-1234-123456789012";

    const { req, res, next } = createMocks({
      body: {
        purpose: "Project Donation",
        project_id: projectId,
      },
    });

    mocks.createContribution.mockResolvedValue(null);

    await actionSubmitContribution(req, res, next);

    expect(mocks.createContribution).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        paymentProofPath: "member-id/random-proof.jpg",
      }),
    );

    expect(mocks.cleanupContributionProofFile).toHaveBeenCalledWith(
      "member-id/random-proof.jpg",
    );

    expect(req.flash).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("no longer accepting donations"),
    );

    expect(res.redirect).toHaveBeenCalledWith("/dashboard/contributions");

    expect(next).not.toHaveBeenCalled();
  });

  it("cleans up the uploaded proof and forwards the original database error", async () => {
    const { req, res, next } = createMocks();

    const databaseError = new Error("Database connection failed");

    mocks.createContribution.mockRejectedValue(databaseError);

    await actionSubmitContribution(req, res, next);

    expect(mocks.cleanupContributionProofFile).toHaveBeenCalledWith(
      "member-id/random-proof.jpg",
    );

    expect(next).toHaveBeenCalledWith(databaseError);

    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("does not delete the proof after a successful database save", async () => {
    const { req, res, next } = createMocks();

    mocks.createContribution.mockResolvedValue({
      id: "contribution-id",
      status: "pending",
    });

    await actionSubmitContribution(req, res, next);

    expect(mocks.uploadContributionProofFile).toHaveBeenCalledTimes(1);
    expect(mocks.createContribution).toHaveBeenCalledTimes(1);

    expect(mocks.cleanupContributionProofFile).not.toHaveBeenCalled();

    expect(next).not.toHaveBeenCalled();
  });
});

describe("Finance Controller - Private Payment Proof Access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a member to retrieve their own payment proof", async () => {
    const req = {
      user: { id: "member-id" },
      params: { id: "contribution-id" },
    };

    const res = {
      redirect: vi.fn(),
    };

    const next = vi.fn();

    mocks.getMemberContributionProof.mockResolvedValueOnce({
      payment_proof_path: "member-id/proof.jpg",
      payment_proof_name: "receipt.jpg",
    });

    mocks.createContributionProofSignedUrl.mockResolvedValueOnce(
      "https://signed-storage-url.example/receipt",
    );

    await showMyContributionProof(req, res, next);

    expect(mocks.getMemberContributionProof).toHaveBeenCalledWith(
      "contribution-id",
      "member-id",
    );

    expect(mocks.createContributionProofSignedUrl).toHaveBeenCalledWith(
      "member-id/proof.jpg",
    );

    expect(res.redirect).toHaveBeenCalledWith(
      "https://signed-storage-url.example/receipt",
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("does not generate a signed URL when the member does not own the proof", async () => {
    const req = {
      user: { id: "member-id" },
      params: { id: "another-members-contribution" },
      flash: vi.fn(),
    };

    const res = {
      redirect: vi.fn(),
    };

    const next = vi.fn();

    mocks.getMemberContributionProof.mockResolvedValueOnce(null);

    await showMyContributionProof(req, res, next);

    expect(mocks.createContributionProofSignedUrl).not.toHaveBeenCalled();

    expect(req.flash).toHaveBeenCalledWith("error", expect.any(String));

    expect(res.redirect).toHaveBeenCalledWith("/dashboard/contributions");

    expect(next).not.toHaveBeenCalled();
  });

  it("allows an authorized finance controller request to retrieve payment proof", async () => {
    const req = {
      params: { id: "contribution-id" },
    };

    const res = {
      redirect: vi.fn(),
    };

    const next = vi.fn();

    mocks.getFinanceContributionProof.mockResolvedValueOnce({
      payment_proof_path: "member-id/proof.jpg",
      payment_proof_name: "receipt.jpg",
    });

    mocks.createContributionProofSignedUrl.mockResolvedValueOnce(
      "https://signed-storage-url.example/receipt",
    );

    await showFinanceContributionProof(req, res, next);

    expect(mocks.getFinanceContributionProof).toHaveBeenCalledWith(
      "contribution-id",
    );

    expect(mocks.createContributionProofSignedUrl).toHaveBeenCalledWith(
      "member-id/proof.jpg",
    );

    expect(res.redirect).toHaveBeenCalledWith(
      "https://signed-storage-url.example/receipt",
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("does not generate a signed URL when finance proof does not exist", async () => {
    const req = {
      params: { id: "missing-contribution" },
      flash: vi.fn(),
    };

    const res = {
      redirect: vi.fn(),
    };

    const next = vi.fn();

    mocks.getFinanceContributionProof.mockResolvedValueOnce(null);

    await showFinanceContributionProof(req, res, next);

    expect(mocks.createContributionProofSignedUrl).not.toHaveBeenCalled();

    expect(res.redirect).toHaveBeenCalledWith("/admin/finance");

    expect(next).not.toHaveBeenCalled();
  });
});

describe("Finance Controller - Dashboard Access", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getFinancialSummary.mockResolvedValue({
      totalIncome: 100000,
      totalExpenses: 20000,
      approvedUnpaidCommitments: 10000,
      netBalance: 80000,
      pendingContributions: 0,
    });

    mocks.listContributions.mockResolvedValue([]);
    mocks.listExpenses.mockResolvedValue([]);
    mocks.listAllContributionsForExport.mockResolvedValue([]);
    mocks.listExpensesForChairpersonReview.mockResolvedValue([]);
  });

  it("renders only the restricted expense review dashboard for Chairperson", async () => {
    const req = {
      user: { id: "chairperson-id" },
      userRoles: ["member"],
      leadershipRoles: ["Chairperson"],
    };

    const res = {
      render: vi.fn(),
    };

    const next = vi.fn();

    mocks.listExpensesForChairpersonReview.mockResolvedValue([
      { id: "expense-1", title: "Regional Outreach Activity" },
    ]);

    await showFinanceDashboard(req, res, next);

    expect(mocks.listExpensesForChairpersonReview).toHaveBeenCalledWith({
      limit: 50,
    });

    expect(res.render).toHaveBeenCalledWith(
      "admin/finance-chairperson",
      expect.objectContaining({
        title: "Expense Approval Review",
        layout: "layouts/app",
      }),
    );

    expect(mocks.getFinancialSummary).not.toHaveBeenCalled();
    expect(mocks.listContributions).not.toHaveBeenCalled();
    expect(mocks.listExpenses).not.toHaveBeenCalled();
    expect(mocks.listAllContributionsForExport).not.toHaveBeenCalled();

    expect(next).not.toHaveBeenCalled();
  });

  it("renders the full financial dashboard for the active Treasurer", async () => {
    const req = {
      user: { id: "treasurer-id" },
      userRoles: ["member"],
      leadershipRoles: ["Treasurer"],
    };

    const res = {
      render: vi.fn(),
    };

    const next = vi.fn();

    await showFinanceDashboard(req, res, next);

    expect(mocks.getFinancialSummary).toHaveBeenCalledTimes(1);
    expect(mocks.listContributions).toHaveBeenCalledWith({
      status: "pending",
      limit: 10,
    });
    expect(mocks.listExpenses).toHaveBeenCalledWith({ limit: 50 });
    expect(mocks.listAllContributionsForExport).toHaveBeenCalledTimes(1);

    expect(res.render).toHaveBeenCalledWith(
      "admin/finance",
      expect.objectContaining({
        isTreasurer: true,
        isSuperAdmin: false,
        layout: "layouts/app",
      }),
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("renders the full financial dashboard for Super Admin", async () => {
    const req = {
      user: { id: "super-admin-id" },
      userRoles: ["super_admin"],
      leadershipRoles: [],
    };

    const res = {
      render: vi.fn(),
    };

    const next = vi.fn();

    await showFinanceDashboard(req, res, next);

    expect(mocks.getFinancialSummary).toHaveBeenCalledTimes(1);
    expect(mocks.listExpenses).toHaveBeenCalledTimes(1);

    expect(res.render).toHaveBeenCalledWith(
      "admin/finance",
      expect.objectContaining({
        isSuperAdmin: true,
        isTreasurer: false,
        layout: "layouts/app",
      }),
    );

    expect(next).not.toHaveBeenCalled();
  });
});

describe("Finance Controller - Expense Payment Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents Super Admin from recording an expense payment", async () => {
    const req = {
      user: { id: "super-admin-id" },
      userRoles: ["super_admin"],
      leadershipRoles: [],
      params: { id: "expense-id" },
      body: { status: "paid" },
      flash: vi.fn(),
    };

    const res = {
      redirect: vi.fn(),
    };

    const next = vi.fn();

    mocks.query.mockResolvedValue({
      rows: [
        {
          id: "expense-id",
          title: "Regional Activity",
          amount: 50000,
          requested_by: "member-id",
          status: "approved",
          approval_stage: "payment",
          submitted_role: "regional_outreach_officer",
          submitted_office: "Regional Outreach",
        },
      ],
    });

    await actionUpdateExpenseStatus(req, res, next);

    expect(req.flash).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("Only the active Treasurer"),
    );

    expect(res.redirect).toHaveBeenCalledWith("/regional/dashboard");

    expect(mocks.setExpenseStatus).not.toHaveBeenCalled();
    expect(mocks.notifyExpenseApprovalDecision).not.toHaveBeenCalled();
    expect(mocks.auditLog).not.toHaveBeenCalled();

    expect(next).not.toHaveBeenCalled();
  });
});

// ============================================================
// Finance Controller - Expense CSV Export Security
// ============================================================

describe("Finance Controller - Expense CSV Export Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports expenses with CSV escaping and formula injection protection", async () => {
    mocks.listAllExpensesForExport.mockResolvedValue([
      {
        id: "expense-1",
        title: "=1+1",
        amount: 50000,
        category: "Events",
        status: "pending",
        requester_email: "member@example.com",
        description: 'Regional "North", Activity\nLine two',
        created_at: "2026-11-20T10:00:00.000Z",
      },
      {
        id: "expense-2",
        title: "+SUM(A1:A2)",
        amount: 30000,
        category: "Projects",
        status: "approved",
        requester_email: "other@example.com",
        description: "@SUM(A1)",
        created_at: "2026-11-21T10:00:00.000Z",
      },
    ]);

    const req = {};
    const res = {
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    const next = vi.fn();

    await actionExportAllExpenses(req, res, next);

    expect(mocks.listAllExpensesForExport).toHaveBeenCalledTimes(1);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/csv; charset=utf-8",
    );

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="hosa-expenses.csv"',
    );

    const csv = res.send.mock.calls[0][0];

    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+SUM(A1:A2)");
    expect(csv).toContain("'@SUM(A1)");

    expect(csv).toContain('"Regional ""North"", Activity\nLine two"');
    expect(csv).toContain("member@example.com");
    expect(csv).toContain("\r\n");

    expect(next).not.toHaveBeenCalled();
  });

  it("forwards bulk export database errors to error middleware", async () => {
    const error = new Error("Expense export query failed");
    mocks.listAllExpensesForExport.mockRejectedValue(error);

    const req = {};
    const res = {
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    const next = vi.fn();

    await actionExportAllExpenses(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.send).not.toHaveBeenCalled();
  });

  it("exports a single expense with safe CSV formatting", async () => {
    mocks.getExpenseById.mockResolvedValue({
      id: "expense-123",
      title: 'Regional "Central", Meeting',
      amount: 75000,
      category: "Events",
      status: "approved",
      requester_email: "member@example.com",
      description: '=HYPERLINK("https://example.com")',
      created_at: "2026-11-20T10:00:00.000Z",
    });

    const req = {
      params: { id: "expense-123" },
    };
    const res = {
      setHeader: vi.fn(),
      send: vi.fn(),
      redirect: vi.fn(),
    };
    const next = vi.fn();

    await actionExportSingleExpense(req, res, next);

    expect(mocks.getExpenseById).toHaveBeenCalledWith("expense-123");

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="expense-expense-123.csv"',
    );

    const csv = res.send.mock.calls[0][0];

    expect(csv).toContain('"Regional ""Central"", Meeting"');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("member@example.com");
    expect(csv).toContain("UGX");

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("redirects when the requested expense does not exist", async () => {
    mocks.getExpenseById.mockResolvedValue(null);

    const req = {
      params: { id: "missing-expense" },
      flash: vi.fn(),
    };
    const res = {
      redirect: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    const next = vi.fn();

    await actionExportSingleExpense(req, res, next);

    expect(req.flash).toHaveBeenCalledWith("error", "Expense not found.");

    expect(res.redirect).toHaveBeenCalledWith("/admin/finance");
    expect(res.send).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
