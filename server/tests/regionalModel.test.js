import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../src/config/db.js", () => db);

import {
  listRegionalReports,
  updateRegionalReport,
  deleteRegionalReport,
} from "../src/models/regionalModel.js";

describe("Regional report actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates only the submitting officer's pending report", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: "report-id" }] });

    await expect(
      updateRegionalReport("report-id", "officer-id", {
        title: "Monthly report",
        reportType: "Monthly Report",
        content: "Report content",
      }),
    ).resolves.toEqual({ id: "report-id" });

    expect(db.query.mock.calls[0][0]).toContain(
      "AND submitted_by = $5 AND status = 'pending'",
    );
    expect(db.query.mock.calls[0][1]).toEqual([
      "Monthly report",
      "Monthly Report",
      "Report content",
      "report-id",
      "officer-id",
    ]);
  });
  it("lists only reports belonging to the specified officer and region", async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: "report-id", region: "Central" }],
    });

    await expect(
      listRegionalReports({
        region: "Central",
        submittedBy: "officer-id",
      }),
    ).resolves.toEqual([{ id: "report-id", region: "Central" }]);

    const [sql, values] = db.query.mock.calls[0];

    expect(sql).toContain("rr.region = $1");
    expect(sql).toContain("rr.submitted_by = $2");
    expect(values).toEqual(["Central", "officer-id"]);
  });

  it("deletes only the submitting officer's pending report and returns attachment details", async () => {
    const deletedReport = {
      id: "report-id",
      file_path: "officer-id/report-file.pdf",
      file_name: "monthly-report.pdf",
    };

    db.query.mockResolvedValueOnce({ rows: [deletedReport] });

    await expect(
      deleteRegionalReport("report-id", "officer-id"),
    ).resolves.toEqual(deletedReport);

    expect(db.query.mock.calls[0][0]).toContain(
      "AND submitted_by = $2 AND status = 'pending'",
    );

    expect(db.query.mock.calls[0][1]).toEqual(["report-id", "officer-id"]);
  });
});
