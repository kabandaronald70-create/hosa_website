import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFinancialSummary: vi.fn(),
  listContributions: vi.fn(),
  verifyContribution: vi.fn(),
  listExpenses: vi.fn(),
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
