import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  createRegionalReport: vi.fn(),
  uploadRegionalReportFile: vi.fn(),
  cleanupRegionalReportFile: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({
  query: mocks.query,
}));

vi.mock("../src/models/projectModel.js", () => ({
  createProject: vi.fn(),
  listProjects: vi.fn(),
}));

vi.mock("../src/services/projectFileService.js", () => ({
  uploadProjectImage: vi.fn(),
}));

vi.mock("../src/services/auditService.js", () => ({
  auditLog: mocks.auditLog,
}));

vi.mock("../src/models/regionalModel.js", () => ({
  createRegionalReport: mocks.createRegionalReport,
  listRegionalReports: vi.fn(),
  updateRegionalReport: vi.fn(),
  deleteRegionalReport: vi.fn(),
}));

vi.mock("../src/services/regionalReportFileService.js", () => ({
  uploadRegionalReportFile: mocks.uploadRegionalReportFile,
  cleanupRegionalReportFile: mocks.cleanupRegionalReportFile,
  createRegionalReportSignedUrl: vi.fn(),
}));

import { actionSubmitReport } from "../src/controllers/regionalController.js";

function createMocks({
  file = {
    buffer: Buffer.from("%PDF-1.7 test document"),
    originalname: "monthly-report.pdf",
  },
} = {}) {
  const req = {
    user: {
      id: "officer-123",
    },
    body: {
      title: "Monthly Report",
      report_type: "Monthly Report",
      content: "Monthly regional activities.",
    },
    file,
  };

  const res = {
    redirect: vi.fn().mockReturnThis(),
  };

  const next = vi.fn();

  req.flash = vi.fn();

  return { req, res, next };
}

describe("Regional Report Submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.query.mockResolvedValue({
      rows: [
        {
          office_title: "Outreach Officer (Central)",
        },
      ],
    });

    mocks.uploadRegionalReportFile.mockResolvedValue({
      storagePath: "officer-123/random-file.pdf",
      originalName: "monthly-report.pdf",
    });

    mocks.createRegionalReport.mockResolvedValue({
      id: "report-123",
    });

    mocks.cleanupRegionalReportFile.mockResolvedValue(undefined);

    mocks.auditLog.mockResolvedValue(undefined);
  });

  it("submits a report with an attachment successfully", async () => {
    const { req, res, next } = createMocks();

    await actionSubmitReport(req, res, next);

    expect(mocks.query).toHaveBeenCalledOnce();

    expect(mocks.uploadRegionalReportFile).toHaveBeenCalledWith(
      "officer-123",
      req.file.buffer,
      "monthly-report.pdf",
    );

    expect(mocks.createRegionalReport).toHaveBeenCalledWith({
      region: "Central",
      title: "Monthly Report",
      reportType: "Monthly Report",
      content: "Monthly regional activities.",
      filePath: "officer-123/random-file.pdf",
      fileName: "monthly-report.pdf",
      submittedBy: "officer-123",
    });

    expect(mocks.cleanupRegionalReportFile).not.toHaveBeenCalled();

    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "regional_report.submitted",
        targetId: "report-123",
      }),
    );

    expect(req.flash).toHaveBeenCalledWith(
      "success",
      "Report submitted successfully.",
    );

    expect(res.redirect).toHaveBeenCalledWith("/regional/reports");

    expect(next).not.toHaveBeenCalled();
  });

  it("removes the uploaded attachment when database insertion fails", async () => {
    const { req, res, next } = createMocks();

    const databaseError = new Error("Database insertion failed");

    mocks.createRegionalReport.mockRejectedValueOnce(databaseError);

    await actionSubmitReport(req, res, next);

    expect(mocks.uploadRegionalReportFile).toHaveBeenCalledOnce();

    expect(mocks.cleanupRegionalReportFile).toHaveBeenCalledWith(
      "officer-123/random-file.pdf",
    );

    expect(next).toHaveBeenCalledWith(databaseError);

    expect(mocks.auditLog).not.toHaveBeenCalled();

    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("does not attempt attachment cleanup when no file was uploaded", async () => {
    const { req, res, next } = createMocks({
      file: null,
    });

    const databaseError = new Error("Database insertion failed");

    mocks.createRegionalReport.mockRejectedValueOnce(databaseError);

    await actionSubmitReport(req, res, next);

    expect(mocks.uploadRegionalReportFile).not.toHaveBeenCalled();

    expect(mocks.createRegionalReport).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: null,
        fileName: null,
      }),
    );

    expect(mocks.cleanupRegionalReportFile).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledWith(databaseError);
  });

  it("rejects an invalid report type before uploading", async () => {
    const { req, res, next } = createMocks();

    req.body.report_type = "Unknown Report";

    await actionSubmitReport(req, res, next);

    expect(req.flash).toHaveBeenCalledWith(
      "error",
      "Select a valid report type.",
    );

    expect(res.redirect).toHaveBeenCalledWith("/regional/reports/new");

    expect(mocks.query).not.toHaveBeenCalled();

    expect(mocks.uploadRegionalReportFile).not.toHaveBeenCalled();

    expect(mocks.createRegionalReport).not.toHaveBeenCalled();

    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an empty report title before uploading", async () => {
    const { req, res, next } = createMocks();

    req.body.title = "   ";

    await actionSubmitReport(req, res, next);

    expect(req.flash).toHaveBeenCalledWith(
      "error",
      "Report title and content are required.",
    );

    expect(res.redirect).toHaveBeenCalledWith("/regional/reports/new");

    expect(mocks.query).not.toHaveBeenCalled();

    expect(mocks.uploadRegionalReportFile).not.toHaveBeenCalled();

    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an officer without an active regional assignment", async () => {
    const { req, res, next } = createMocks();

    mocks.query.mockResolvedValueOnce({
      rows: [],
    });

    await actionSubmitReport(req, res, next);

    expect(req.flash).toHaveBeenCalledWith(
      "error",
      "You are not assigned as an Outreach Officer.",
    );

    expect(res.redirect).toHaveBeenCalledWith("/dashboard");

    expect(mocks.uploadRegionalReportFile).not.toHaveBeenCalled();

    expect(mocks.createRegionalReport).not.toHaveBeenCalled();

    expect(next).not.toHaveBeenCalled();
  });
});
