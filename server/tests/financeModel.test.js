import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("../src/config/db.js", () => db);

import {
  createContribution,
  verifyContribution,
  rejectContribution,
  getMemberContributionProof,
  getFinanceContributionProof,
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

    await expect(
      verifyContribution("contribution-id", "admin-id"),
    ).resolves.toBe(true);

    expect(client.query).toHaveBeenCalledTimes(2);

    const verificationQuery = client.query.mock.calls[0][0];

    expect(verificationQuery).toContain("status = 'pending'");
    expect(verificationQuery).toContain("user_id IS NULL");
    expect(verificationQuery).toContain("payment_proof_path IS NOT NULL");

    expect(client.query.mock.calls[1][0]).toContain("funds_raised");
    expect(client.query.mock.calls[1][1]).toEqual(["12500", "project-id"]);
  });

  it("does not credit project funds when a contribution is no longer pending", async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }),
    };

    db.withTransaction.mockImplementation((callback) => callback(client));

    await expect(
      verifyContribution("contribution-id", "admin-id"),
    ).resolves.toBe(false);

    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("does not verify a member contribution without payment proof", async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }),
    };

    db.withTransaction.mockImplementation((callback) => callback(client));

    await expect(
      verifyContribution("contribution-id", "admin-id"),
    ).resolves.toBe(false);

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0][0]).toContain(
      "payment_proof_path IS NOT NULL",
    );
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
        paymentProofPath: "member-id/test-proof.jpg",
        paymentProofName: "payment-slip.jpg",
      }),
    ).resolves.toBeNull();

    expect(client.query).toHaveBeenCalledTimes(1);
  });
});

describe("Contribution payment proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a member to retrieve their own payment proof", async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          payment_proof_path: "member-id/proof.jpg",
          payment_proof_name: "proof.jpg",
        },
      ],
    });

    await expect(
      getMemberContributionProof("contribution-id", "member-id"),
    ).resolves.toEqual({
      payment_proof_path: "member-id/proof.jpg",
      payment_proof_name: "proof.jpg",
    });

    expect(db.query.mock.calls[0][0]).toContain("user_id = $2");
    expect(db.query.mock.calls[0][0]).toContain(
      "payment_proof_path IS NOT NULL",
    );
    expect(db.query.mock.calls[0][1]).toEqual(["contribution-id", "member-id"]);
  });

  it("does not return payment proof when the member does not own the contribution", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      getMemberContributionProof("another-members-contribution", "member-id"),
    ).resolves.toBeNull();

    expect(db.query.mock.calls[0][0]).toContain("user_id = $2");
    expect(db.query.mock.calls[0][1]).toEqual([
      "another-members-contribution",
      "member-id",
    ]);
  });

  it("allows the finance model to retrieve an existing contribution proof", async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          payment_proof_path: "member-id/proof.jpg",
          payment_proof_name: "proof.jpg",
        },
      ],
    });

    await expect(
      getFinanceContributionProof("contribution-id"),
    ).resolves.toEqual({
      payment_proof_path: "member-id/proof.jpg",
      payment_proof_name: "proof.jpg",
    });

    expect(db.query.mock.calls[0][0]).toContain(
      "payment_proof_path IS NOT NULL",
    );
    expect(db.query.mock.calls[0][1]).toEqual(["contribution-id"]);
  });

  it("records the rejection reason, administrator, and timestamp", async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: "contribution-id" }],
    });

    await expect(
      rejectContribution(
        "contribution-id",
        "treasurer-id",
        "Payment could not be confirmed.",
      ),
    ).resolves.toBe(true);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("status = 'rejected'");
    expect(sql).toContain("rejection_reason = $1");
    expect(sql).toContain("rejected_by = $2");
    expect(sql).toContain("rejected_at = now()");
    expect(sql).toContain("status = 'pending'");

    expect(params).toEqual([
      "Payment could not be confirmed.",
      "treasurer-id",
      "contribution-id",
    ]);
  });

  it("does not reject a contribution that is no longer pending", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      rejectContribution(
        "contribution-id",
        "treasurer-id",
        "Payment could not be confirmed.",
      ),
    ).resolves.toBe(false);

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain("status = 'pending'");
  });

  it("stores the private proof path and filename when creating a contribution", async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: "new-contribution-id",
            user_id: "member-id",
            amount: "25000",
            payment_proof_name: "receipt.jpg",
            status: "pending",
          },
        ],
      }),
    };

    db.withTransaction.mockImplementation((callback) => callback(client));

    await expect(
      createContribution({
        userId: "member-id",
        amount: 25000,
        purpose: "Annual Subscription",
        paymentMethod: "Mobile Money",
        reference: "TX123",
        paymentProofPath: "member-id/random-proof.jpg",
        paymentProofName: "receipt.jpg",
      }),
    ).resolves.toMatchObject({
      id: "new-contribution-id",
      user_id: "member-id",
      payment_proof_name: "receipt.jpg",
      status: "pending",
    });

    expect(client.query).toHaveBeenCalledTimes(1);

    const [sql, params] = client.query.mock.calls[0];

    expect(sql).toContain("payment_proof_path");
    expect(sql).toContain("payment_proof_name");

    expect(params).toContain("member-id/random-proof.jpg");
    expect(params).toContain("receipt.jpg");
  });

  it("rejects contribution creation when payment proof is missing", async () => {
    await expect(
      createContribution({
        userId: "member-id",
        amount: 25000,
        purpose: "Annual Subscription",
        paymentMethod: "Mobile Money",
      }),
    ).rejects.toThrow("Contribution payment proof is required.");

    expect(db.withTransaction).not.toHaveBeenCalled();
  });
});
