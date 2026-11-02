import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("../src/config/db.js", () => db);

import {
  createContribution,
  verifyContribution,
} from "../src/models/financeModel.js";

describe("Project contributions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("credits project funds only on the first pending-to-verified transition", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ amount: "12500", project_id: "project-id" }],
        })
        .mockResolvedValueOnce({ rows: [] }),
    };
    db.withTransaction.mockImplementation((callback) => callback(client));

    await expect(verifyContribution("contribution-id", "admin-id")).resolves.toBe(
      true,
    );
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[0][0]).toContain("status = 'pending'");
    expect(client.query.mock.calls[1][0]).toContain("funds_raised");
    expect(client.query.mock.calls[1][1]).toEqual(["12500", "project-id"]);
  });

  it("does not credit project funds when a contribution is no longer pending", async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }),
    };
    db.withTransaction.mockImplementation((callback) => callback(client));

    await expect(verifyContribution("contribution-id", "admin-id")).resolves.toBe(
      false,
    );
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("refuses donations to projects that are no longer accepting donations", async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }),
    };
    db.withTransaction.mockImplementation((callback) => callback(client));

    await expect(
      createContribution({
        userId: "member-id",
        amount: 100,
        purpose: "Project Donation",
        paymentMethod: "Mobile Money",
        projectId: "project-id",
      }),
    ).resolves.toBeNull();
    expect(client.query).toHaveBeenCalledTimes(1);
  });
});
