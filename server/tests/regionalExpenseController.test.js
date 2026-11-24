import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),

  createExpense: vi.fn(),
  listExpensesSubmittedByUser: vi.fn(),
  listExpenseApprovalHistoryForUser: vi.fn(),
  updateRegionalExpenseRequest: vi.fn(),
  deleteRegionalExpenseRequest: vi.fn(),

  auditLog: vi.fn(),
  notifyExpenseApprovalRequired: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({
  query: mocks.query,
}));

vi.mock("../src/models/projectModel.js", () => ({
  createProject: vi.fn(),
  listRegionalOfficerProjects: vi.fn(),
}));

vi.mock("../src/services/projectFileService.js", () => ({
  uploadProjectImage: vi.fn(),
}));

vi.mock("../src/services/auditService.js", () => ({
  auditLog: mocks.auditLog,
}));

vi.mock("../src/services/notificationsService.js", () => ({
  notifyProjectProposalSubmitted: vi.fn(),
  notifyExpenseApprovalRequired: mocks.notifyExpenseApprovalRequired,
}));

vi.mock("../src/models/financeModel.js", () => ({
  createExpense: mocks.createExpense,
  listExpensesSubmittedByUser: mocks.listExpensesSubmittedByUser,
  listExpenseApprovalHistoryForUser:
    mocks.listExpenseApprovalHistoryForUser,
  updateRegionalExpenseRequest: mocks.updateRegionalExpenseRequest,
  deleteRegionalExpenseRequest: mocks.deleteRegionalExpenseRequest,
}));

vi.mock("../src/services/regionalReportFileService.js", () => ({
  uploadRegionalReportFile: vi.fn(),
  cleanupRegionalReportFile: vi.fn(),
  createRegionalReportSignedUrl: vi.fn(),
}));

vi.mock("../src/models/regionalModel.js", () => ({
  createRegionalReport: vi.fn(),
  listRegionalReports: vi.fn(),
  updateRegionalReport: vi.fn(),
  deleteRegionalReport: vi.fn(),
}));

import {
  actionSubmitRegionalExpense,
  showEditRegionalExpenseForm,
  actionUpdateRegionalExpense,
  actionDeleteRegionalExpense,
} from "../src/controllers/regionalController.js";

const expense = {
  id: "expense-123",
  title: "Community Outreach",
  amount: "150000",
  category: "Events",
  description: "Regional community activity.",
  status: "pending",
  approval_stage: "projects_manager",
  submitted_role: "regional_outreach_officer",
};

function createMocks({
  userId = "officer-123",
  params = { id: expense.id },
  body = {},
} = {}) {
  const req = {
    user: { id: userId },
    params,
    body: {
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      ...body,
    },
    flash: vi.fn(),
  };

  const res = {
    render: vi.fn(),
    redirect: vi.fn(),
  };

  const next = vi.fn();

  return { req, res, next };
}

describe("Regional Expense Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.createExpense.mockResolvedValue(expense);
    mocks.listExpensesSubmittedByUser.mockResolvedValue([expense]);
    mocks.listExpenseApprovalHistoryForUser.mockResolvedValue([]);

    mocks.updateRegionalExpenseRequest.mockResolvedValue({
      ...expense,
      title: "Updated Community Outreach",
    });

    mocks.deleteRegionalExpenseRequest.mockResolvedValue(expense);

    mocks.notifyExpenseApprovalRequired.mockResolvedValue(undefined);
    mocks.auditLog.mockResolvedValue(undefined);
  });

  describe("Expense submission", () => {
    it("submits an expense using the server-controlled Regional Outreach role", async () => {
      const { req, res, next } = createMocks({
        body: {
          actorRole: "treasurer",
          submittedOffice: "Finance",
          submitted_role: "treasurer",
        },
      });

      await actionSubmitRegionalExpense(req, res, next);

      expect(mocks.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expense.title,
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          requestedBy: "officer-123",
          actorRole: "regional_outreach_officer",
          submittedOffice: "Regional Outreach",
        }),
      );

      expect(mocks.notifyExpenseApprovalRequired).toHaveBeenCalledWith({
        expense,
        stage: "projects_manager",
      });

      expect(mocks.auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "finance.expense_submitted",
          targetType: "expense",
          targetId: expense.id,
          metadata: expect.objectContaining({
            submittedRole: "regional_outreach_officer",
            submittedOffice: "Regional Outreach",
            approvalStage: "projects_manager",
          }),
        }),
      );

      expect(req.flash).toHaveBeenCalledWith(
        "success",
        expect.stringContaining("submitted successfully"),
      );

      expect(res.redirect).toHaveBeenCalledWith("/regional/dashboard");
      expect(next).not.toHaveBeenCalled();
    });

    it("passes submission errors to Express", async () => {
      const { req, res, next } = createMocks();
      const error = new Error("Database unavailable");

      mocks.createExpense.mockRejectedValue(error);

      await actionSubmitRegionalExpense(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.redirect).not.toHaveBeenCalled();
      expect(mocks.auditLog).not.toHaveBeenCalled();
    });
  });

  describe("Expense editing", () => {
    it("loads the officer's own eligible expense for editing", async () => {
      const { req, res, next } = createMocks();

      await showEditRegionalExpenseForm(req, res, next);

      expect(mocks.listExpensesSubmittedByUser).toHaveBeenCalledWith({
        requestedBy: "officer-123",
        limit: 100,
      });

      expect(res.render).toHaveBeenCalledWith(
        "regional/expense-edit",
        expect.objectContaining({
          title: "Edit Expense Request",
          expense,
          layout: "layouts/app",
        }),
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("refuses to load an expense that is not in the initial review stage", async () => {
      const { req, res, next } = createMocks();

      mocks.listExpensesSubmittedByUser.mockResolvedValue([
        {
          ...expense,
          approval_stage: "treasurer",
        },
      ]);

      await showEditRegionalExpenseForm(req, res, next);

      expect(res.render).not.toHaveBeenCalled();

      expect(req.flash).toHaveBeenCalledWith(
        "error",
        expect.stringContaining("cannot be edited"),
      );

      expect(res.redirect).toHaveBeenCalledWith("/regional/dashboard");
      expect(next).not.toHaveBeenCalled();
    });

    it("updates an eligible expense and records an audit event", async () => {
      const { req, res, next } = createMocks();

      await actionUpdateRegionalExpense(req, res, next);

      expect(mocks.updateRegionalExpenseRequest).toHaveBeenCalledWith(
        expense.id,
        "officer-123",
        expect.objectContaining({
          title: expense.title,
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
        }),
      );

      expect(mocks.auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "finance.regional_expense_updated",
          targetType: "expense",
          targetId: expense.id,
        }),
      );

      expect(req.flash).toHaveBeenCalledWith(
        "success",
        "Expense request updated successfully.",
      );

      expect(res.redirect).toHaveBeenCalledWith("/regional/dashboard");
      expect(next).not.toHaveBeenCalled();
    });

    it("refuses an update when the model reports that the request is no longer eligible", async () => {
      const { req, res, next } = createMocks();

      mocks.updateRegionalExpenseRequest.mockResolvedValue(null);

      await actionUpdateRegionalExpense(req, res, next);

      expect(mocks.auditLog).not.toHaveBeenCalled();

      expect(req.flash).toHaveBeenCalledWith(
        "error",
        expect.stringContaining("cannot be edited"),
      );

      expect(res.redirect).toHaveBeenCalledWith("/regional/dashboard");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Expense deletion", () => {
    it("deletes an eligible expense and records an audit event", async () => {
      const { req, res, next } = createMocks();

      await actionDeleteRegionalExpense(req, res, next);

      expect(mocks.deleteRegionalExpenseRequest).toHaveBeenCalledWith(
        expense.id,
        "officer-123",
      );

      expect(mocks.auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "finance.regional_expense_deleted",
          targetType: "expense",
          targetId: expense.id,
        }),
      );

      expect(req.flash).toHaveBeenCalledWith(
        "success",
        "Expense request deleted successfully.",
      );

      expect(res.redirect).toHaveBeenCalledWith("/regional/dashboard");
      expect(next).not.toHaveBeenCalled();
    });

    it("refuses deletion when the request is no longer eligible", async () => {
      const { req, res, next } = createMocks();

      mocks.deleteRegionalExpenseRequest.mockResolvedValue(null);

      await actionDeleteRegionalExpense(req, res, next);

      expect(mocks.auditLog).not.toHaveBeenCalled();

      expect(req.flash).toHaveBeenCalledWith(
        "error",
        expect.stringContaining("cannot be deleted"),
      );

      expect(res.redirect).toHaveBeenCalledWith("/regional/dashboard");
      expect(next).not.toHaveBeenCalled();
    });

    it("passes deletion errors to Express", async () => {
      const { req, res, next } = createMocks();
      const error = new Error("Database unavailable");

      mocks.deleteRegionalExpenseRequest.mockRejectedValue(error);

      await actionDeleteRegionalExpense(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.redirect).not.toHaveBeenCalled();
      expect(mocks.auditLog).not.toHaveBeenCalled();
    });
  });
});
