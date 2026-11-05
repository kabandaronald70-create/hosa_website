import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  createRegionalReportSignedUrl: vi.fn(),
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
  auditLog: vi.fn(),
}));

vi.mock("../src/models/regionalModel.js", () => ({
  createRegionalReport: vi.fn(),
  listRegionalReports: vi.fn(),
  updateRegionalReport: vi.fn(),
  deleteRegionalReport: vi.fn(),
}));

vi.mock("../src/services/regionalReportFileService.js", () => ({
  uploadRegionalReportFile: vi.fn(),
  cleanupRegionalReportFile: vi.fn(),
  createRegionalReportSignedUrl: mocks.createRegionalReportSignedUrl,
}));

import { actionDownloadRegionalReportAttachment } from "../src/controllers/regionalController.js";

function createMocks() {
  const req = {
    params: {
      id: "report-123",
    },
    user: {
      id: "officer-123",
    },
  };

  const res = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
  };

  const next = vi.fn();

  return { req, res, next };
}

describe("Regional Report Attachment Downloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an officer to download their own report attachment", async () => {
    const { req, res, next } = createMocks();

    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          file_path: "officer-123/report.pdf",
        },
      ],
    });

    mocks.createRegionalReportSignedUrl.mockResolvedValueOnce(
      "https://example.com/private-report",
    );

    await actionDownloadRegionalReportAttachment(req, res, next);

    expect(mocks.query).toHaveBeenCalledOnce();

    const [sql, values] = mocks.query.mock.calls[0];

    expect(sql).toContain("WHERE id = $1");
    expect(sql).toContain("AND submitted_by = $2");

    expect(values).toEqual(["report-123", "officer-123"]);

    expect(mocks.createRegionalReportSignedUrl).toHaveBeenCalledWith(
      "officer-123/report.pdf",
    );

    expect(res.set).toHaveBeenCalledWith("Cache-Control", "private, no-store");

    expect(res.redirect).toHaveBeenCalledWith(
      302,
      "https://example.com/private-report",
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("denies access when the report belongs to another officer", async () => {
    const { req, res, next } = createMocks();

    // The database returns no rows because the submitting officer
    // does not match the authenticated officer.
    mocks.query.mockResolvedValueOnce({
      rows: [],
    });

    await actionDownloadRegionalReportAttachment(req, res, next);

    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("AND submitted_by = $2"),
      ["report-123", "officer-123"],
    );

    expect(res.status).toHaveBeenCalledWith(404);

    expect(res.send).toHaveBeenCalledWith("Report attachment not found.");

    expect(mocks.createRegionalReportSignedUrl).not.toHaveBeenCalled();

    expect(res.redirect).not.toHaveBeenCalled();

    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 when the report has no attachment", async () => {
    const { req, res, next } = createMocks();

    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          file_path: null,
        },
      ],
    });

    await actionDownloadRegionalReportAttachment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);

    expect(res.send).toHaveBeenCalledWith("Report attachment not found.");

    expect(mocks.createRegionalReportSignedUrl).not.toHaveBeenCalled();

    expect(next).not.toHaveBeenCalled();
  });

  it("passes database errors to the error handler", async () => {
    const { req, res, next } = createMocks();

    const error = new Error("Database unavailable");

    mocks.query.mockRejectedValueOnce(error);

    await actionDownloadRegionalReportAttachment(req, res, next);

    expect(next).toHaveBeenCalledWith(error);

    expect(mocks.createRegionalReportSignedUrl).not.toHaveBeenCalled();

    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("passes signed URL errors to the error handler", async () => {
    const { req, res, next } = createMocks();

    const error = new Error("Signed URL generation failed");

    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          file_path: "officer-123/report.pdf",
        },
      ],
    });

    mocks.createRegionalReportSignedUrl.mockRejectedValueOnce(error);

    await actionDownloadRegionalReportAttachment(req, res, next);

    expect(next).toHaveBeenCalledWith(error);

    expect(res.redirect).not.toHaveBeenCalled();
  });
});
