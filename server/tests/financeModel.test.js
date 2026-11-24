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
  createExpense,
  setExpenseStatus,
  listRegionalExpensesForProjectsManagerReview,
  listExpensesSubmittedByUser,
  listPublicExpenseSummaries,
  listPublicCompletedExpenseSummaries,
  listExpenseApprovalHistoryForUser,
  updateRegionalExpenseRequest,
  deleteRegionalExpenseRequest,
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

// ---------------------------------------------------------------------------
// Expense approval workflow
// ---------------------------------------------------------------------------

describe("Expense approval workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createTransactionClient(queryResults) {
    const client = {
      query: vi.fn(),
    };

    for (const result of queryResults) {
      client.query.mockResolvedValueOnce(result);
    }

    db.withTransaction.mockImplementation((callback) => callback(client));

    return client;
  }

  it("creates an expense and records its submission in the same transaction", async () => {
    const expense = {
      id: "expense-id",
      title: "School outreach transport",
      amount: "150000",
      status: "pending",
      requested_by: "treasurer-id",
    };

    const client = createTransactionClient([{ rows: [expense] }, { rows: [] }]);

    await expect(
      createExpense({
        title: "School outreach transport",
        amount: 150000,
        category: "Transport",
        description: "Transport for the outreach team.",
        requestedBy: "treasurer-id",
        actorRole: "treasurer",
      }),
    ).resolves.toMatchObject(expense);

    expect(client.query).toHaveBeenCalledTimes(2);

    expect(client.query.mock.calls[0][0]).toContain("INSERT INTO expenses");

    expect(client.query.mock.calls[1][0]).toContain(
      "INSERT INTO expense_approval_history",
    );

    expect(client.query.mock.calls[1][1]).toContain("treasurer");
    expect(client.query.mock.calls[1][0]).toContain("'submitted'");
  });

  it("allows the Projects Manager to approve a Regional Outreach expense", async () => {
    const client = createTransactionClient([
      {
        rows: [
          {
            id: "expense-id",
            requested_by: "regional-officer-id",
            status: "pending",
            approval_stage: "projects_manager",
            submitted_role: "regional_outreach_officer",
          },
        ],
      },
      {
        rows: [
          {
            id: "expense-id",
            status: "pending",
            approval_stage: "treasurer",
          },
        ],
      },
      { rows: [] },
    ]);

    const result = await setExpenseStatus(
      "expense-id",
      "approved",
      "projects-manager-id",
      { actorRole: "projects_manager" },
    );

    expect(result).toMatchObject({
      previousStatus: "pending",
      status: "pending",
      approvalStage: "treasurer",
    });

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[2][1]).toContain(
      "projects_manager_approved",
    );
  });

  it("allows the Treasurer to approve an expense awaiting Treasurer review", async () => {
    const client = createTransactionClient([
      {
        rows: [
          {
            id: "expense-id",
            requested_by: "projects-manager-id",
            status: "pending",
            approval_stage: "treasurer",
            submitted_role: "projects_manager",
          },
        ],
      },
      {
        rows: [
          {
            id: "expense-id",
            status: "pending",
            approval_stage: "chairperson",
          },
        ],
      },
      { rows: [] },
    ]);

    const result = await setExpenseStatus(
      "expense-id",
      "approved",
      "treasurer-id",
      { actorRole: "treasurer" },
    );

    expect(result).toMatchObject({
      previousStatus: "pending",
      status: "pending",
      approvalStage: "chairperson",
    });

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[2][1]).toContain("treasurer_approved");
  });

  it("allows the Chairperson to approve an expense at the chairperson stage", async () => {
    const client = createTransactionClient([
      {
        rows: [
          {
            id: "expense-id",
            requested_by: "treasurer-id",
            status: "pending",
            approval_stage: "chairperson",
          },
        ],
      },
      {
        rows: [
          {
            id: "expense-id",
            status: "pending",
            approval_stage: "super_admin",
          },
        ],
      },
      { rows: [] },
    ]);

    const result = await setExpenseStatus(
      "expense-id",
      "approved",
      "chairperson-id",
      { actorRole: "chairperson" },
    );

    expect(result).toMatchObject({
      previousStatus: "pending",
      status: "pending",
      approvalStage: "super_admin",
    });

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[0][0]).toContain("FOR UPDATE");
    expect(client.query.mock.calls[1][0]).toContain("chairperson_approved_by");
    expect(client.query.mock.calls[2][0]).toContain(
      "INSERT INTO expense_approval_history",
    );
  });

  it("prevents the Super Admin from approving before Chairperson approval", async () => {
    const client = createTransactionClient([
      {
        rows: [
          {
            id: "expense-id",
            requested_by: "treasurer-id",
            status: "pending",
            approval_stage: "treasurer",
          },
        ],
      },
    ]);

    await expect(
      setExpenseStatus("expense-id", "approved", "super-admin-id", {
        actorRole: "super_admin",
      }),
    ).resolves.toBeNull();

    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("prevents the requester from approving their own expense", async () => {
    const client = createTransactionClient([
      {
        rows: [
          {
            id: "expense-id",
            requested_by: "chairperson-id",
            status: "pending",
            approval_stage: "chairperson",
          },
        ],
      },
    ]);

    await expect(
      setExpenseStatus("expense-id", "approved", "chairperson-id", {
        actorRole: "chairperson",
      }),
    ).resolves.toBeNull();

    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("prevents the requester from rejecting their own expense", async () => {
    const client = createTransactionClient([
      {
        rows: [
          {
            id: "expense-id",
            requested_by: "chairperson-id",
            status: "pending",
            approval_stage: "chairperson",
          },
        ],
      },
    ]);

    await expect(
      setExpenseStatus("expense-id", "rejected", "chairperson-id", {
        actorRole: "chairperson",
        reason: "I submitted this request.",
      }),
    ).resolves.toBeNull();

    // Only the initial row-locking query should execute.
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("allows the Super Admin to give final approval after Chairperson approval", async () => {
    const client = createTransactionClient([
      {
        rows: [
          {
            id: "expense-id",
            requested_by: "treasurer-id",
            status: "pending",
            approval_stage: "super_admin",
            chairperson_approved_by: "chairperson-id",
          },
        ],
      },
      {
        rows: [
          {
            id: "expense-id",
            status: "approved",
          },
        ],
      },
      { rows: [] },
    ]);

    const result = await setExpenseStatus(
      "expense-id",
      "approved",
      "super-admin-id",
      { actorRole: "super_admin" },
    );

    expect(result).toMatchObject({
      previousStatus: "pending",
      status: "approved",
      approvalStage: "payment",
    });

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[1][0]).toContain("approved_by");
    expect(client.query.mock.calls[2][1]).toContain("super_admin_approved");
  });

  it("allows the Treasurer to mark an approved expense as paid", async () => {
    const client = createTransactionClient([
      {
        rows: [
          {
            id: "expense-id",
            requested_by: "another-user",
            status: "approved",
            approval_stage: "payment",
          },
        ],
      },
      {
        rows: [
          {
            id: "expense-id",
            status: "paid",
          },
        ],
      },
      { rows: [] },
    ]);

    const result = await setExpenseStatus(
      "expense-id",
      "paid",
      "treasurer-id",
      { actorRole: "treasurer" },
    );

    expect(result).toMatchObject({
      previousStatus: "approved",
      status: "paid",
    });

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[1][0]).toContain("paid_by");
    expect(client.query.mock.calls[2][0]).toContain("'paid'");
  });

  it("prevents the Treasurer from paying an expense awaiting Super Admin approval", async () => {
    const client = createTransactionClient([
      {
        rows: [
          {
            id: "expense-id",
            requested_by: "another-user",
            status: "pending",
            approval_stage: "super_admin",
          },
        ],
      },
    ]);

    await expect(
      setExpenseStatus("expense-id", "paid", "treasurer-id", {
        actorRole: "treasurer",
      }),
    ).resolves.toBeNull();

    // No payment update or history insertion should occur.
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("prevents the requester from marking their own expense as paid", async () => {
    const client = createTransactionClient([
      {
        rows: [
          {
            id: "expense-id",
            requested_by: "treasurer-id",
            status: "approved",
          },
        ],
      },
    ]);

    await expect(
      setExpenseStatus("expense-id", "paid", "treasurer-id", {
        actorRole: "treasurer",
      }),
    ).resolves.toBeNull();

    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("requires a meaningful rejection reason", async () => {
    await expect(
      setExpenseStatus("expense-id", "rejected", "chairperson-id", {
        actorRole: "chairperson",
        reason: "No",
      }),
    ).resolves.toBeNull();

    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  it("records rejection metadata and history", async () => {
    const client = createTransactionClient([
      {
        rows: [
          {
            id: "expense-id",
            requested_by: "treasurer-id",
            status: "pending",
            approval_stage: "chairperson",
          },
        ],
      },
      {
        rows: [
          {
            id: "expense-id",
            status: "rejected",
          },
        ],
      },
      { rows: [] },
    ]);

    const result = await setExpenseStatus(
      "expense-id",
      "rejected",
      "chairperson-id",
      {
        actorRole: "chairperson",
        reason: "The proposed expenditure needs supporting justification.",
      },
    );

    expect(result).toMatchObject({
      previousStatus: "pending",
      status: "rejected",
    });

    expect(client.query).toHaveBeenCalledTimes(3);

    expect(client.query.mock.calls[1][0]).toContain("rejected_by");
    expect(client.query.mock.calls[1][0]).toContain("rejected_at");
    expect(client.query.mock.calls[2][0]).toContain(
      "INSERT INTO expense_approval_history",
    );
  });

  it("does not allow an unauthorized role to approve an expense", async () => {
    const client = createTransactionClient([
      {
        rows: [
          {
            id: "expense-id",
            requested_by: "treasurer-id",
            status: "pending",
          },
        ],
      },
    ]);

    await expect(
      setExpenseStatus(
        "expense-id",
        "executive_approved",
        "ordinary-member-id",
        { actorRole: "treasurer" },
      ),
    ).resolves.toBeNull();

    expect(client.query).not.toHaveBeenCalled();
    expect(db.withTransaction).not.toHaveBeenCalled();
  });
});

describe("Expense read queries and privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists only Regional Outreach Officer requests awaiting Projects Manager review", async () => {
    const expenses = [
      {
        id: "regional-expense-id",
        title: "Regional outreach transport",
        submitted_role: "regional_outreach_officer",
        approval_stage: "projects_manager",
        status: "pending",
      },
    ];

    db.query.mockResolvedValueOnce({ rows: expenses });

    await expect(
      listRegionalExpensesForProjectsManagerReview({ limit: 25 }),
    ).resolves.toEqual(expenses);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("approval_stage = 'projects_manager'");
    expect(sql).toContain("submitted_role = 'regional_outreach_officer'");
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain("member_profiles");
    expect(params).toEqual([25]);
  });

  it("returns no personal expenses when the requester ID is missing", async () => {
    await expect(listExpensesSubmittedByUser({})).resolves.toEqual([]);

    expect(db.query).not.toHaveBeenCalled();
  });

  it("restricts personal expense queries to the supplied requester", async () => {
    const expenses = [
      {
        id: "my-expense-id",
        title: "School outreach transport",
        rejection_reason: "Insufficient supporting justification.",
      },
    ];

    db.query.mockResolvedValueOnce({ rows: expenses });

    await expect(
      listExpensesSubmittedByUser({
        requestedBy: "member-id",
        limit: 20,
      }),
    ).resolves.toEqual(expenses);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("WHERE e.requested_by = $1");
    expect(sql).toContain("rejection_reason");
    expect(params).toEqual(["member-id", 20]);
  });

  it("returns public expense summaries without private information", async () => {
    const expenses = [
      {
        id: "public-expense-id",
        title: "School outreach transport",
        amount: "150000",
        status: "pending",
      },
    ];

    db.query.mockResolvedValueOnce({ rows: expenses });

    await expect(listPublicExpenseSummaries({ limit: 75 })).resolves.toEqual(
      expenses,
    );

    const [sql, params] = db.query.mock.calls[0];
    const normalizedSql = sql.toLowerCase();

    expect(normalizedSql).toContain("e.title");
    expect(normalizedSql).toContain("e.amount");
    expect(normalizedSql).toContain("e.status");

    expect(normalizedSql).not.toContain("rejection_reason");
    expect(normalizedSql).not.toContain("payment_proof");
    expect(normalizedSql).not.toContain("requester_email");
    expect(normalizedSql).not.toContain("requested_by");

    expect(params).toEqual([75]);
  });

  it("excludes paid-and-closed expenses from active public summaries", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await listPublicExpenseSummaries();

    const [sql] = db.query.mock.calls[0];
    const normalizedSql = sql.toLowerCase();

    expect(normalizedSql).toContain("not (");
    expect(normalizedSql).toContain("e.status = 'paid'");
    expect(normalizedSql).toContain("e.approval_stage = 'completed'");
  });

  it("lists only paid-and-closed expenses in completed public summaries", async () => {
    const expenses = [
      {
        id: "completed-expense-id",
        title: "School outreach transport",
        amount: "150000",
        status: "paid",
        approval_stage: "completed",
        paid_at: new Date("2026-11-20"),
      },
    ];

    db.query.mockResolvedValueOnce({ rows: expenses });

    await expect(
      listPublicCompletedExpenseSummaries({ limit: 50 }),
    ).resolves.toEqual(expenses);

    const [sql, params] = db.query.mock.calls[0];
    const normalizedSql = sql.toLowerCase();

    expect(normalizedSql).toContain("e.status = 'paid'");
    expect(normalizedSql).toContain("e.approval_stage = 'completed'");
    expect(normalizedSql).toContain("e.paid_at");

    expect(normalizedSql).not.toContain("rejection_reason");
    expect(normalizedSql).not.toContain("payment_proof");
    expect(normalizedSql).not.toContain("requested_by");
    expect(normalizedSql).not.toContain("requester_email");

    expect(params).toEqual([50]);
  });

  it("caps completed public expense summaries at 200", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await listPublicCompletedExpenseSummaries({ limit: 5000 });

    expect(db.query.mock.calls[0][1]).toEqual([200]);
  });

  it("caps public expense summary results at 200", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await listPublicExpenseSummaries({ limit: 5000 });

    expect(db.query.mock.calls[0][1]).toEqual([200]);
  });
});

describe("Regional Outreach expense request management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves approval history only for the requesting owner", async () => {
    const history = [
      {
        id: "history-id",
        expense_id: "expense-id",
        actor_role: "projects_manager",
        action: "projects_manager_approved",
      },
    ];

    db.query.mockResolvedValueOnce({ rows: history });

    await expect(
      listExpenseApprovalHistoryForUser({
        expenseId: "expense-id",
        requestedBy: "officer-id",
      }),
    ).resolves.toEqual(history);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("INNER JOIN expenses");
    expect(sql).toContain("mp.first_name AS actor_first_name");
    expect(sql).toContain("mp.last_name AS actor_last_name");
    expect(sql).toContain("e.requested_by = $2");
    expect(sql).toContain("h.expense_id = $1");
    expect(params).toEqual(["expense-id", "officer-id"]);
  });

  it("does not query approval history without an owner", async () => {
    await expect(
      listExpenseApprovalHistoryForUser({
        expenseId: "expense-id",
      }),
    ).resolves.toEqual([]);

    expect(db.query).not.toHaveBeenCalled();
  });

  it("updates only the owner's unapproved Regional Outreach request", async () => {
    const updated = {
      id: "expense-id",
      title: "Regional transport",
      status: "pending",
      approval_stage: "projects_manager",
    };

    db.query.mockResolvedValueOnce({ rows: [updated] });

    await expect(
      updateRegionalExpenseRequest("expense-id", "officer-id", {
        title: "Regional transport",
        amount: 150000,
        category: "Events",
        description: "Transport for regional activities",
      }),
    ).resolves.toEqual(updated);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("requested_by = $6");
    expect(sql).toContain("submitted_role = 'regional_outreach_officer'");
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain("approval_stage = 'projects_manager'");
    expect(params).toEqual([
      "Regional transport",
      150000,
      "Events",
      "Transport for regional activities",
      "expense-id",
      "officer-id",
    ]);
  });

  it("rejects invalid expense updates before querying", async () => {
    await expect(
      updateRegionalExpenseRequest("expense-id", "officer-id", {
        title: "",
        amount: -100,
        category: "Invalid",
      }),
    ).resolves.toBeNull();

    expect(db.query).not.toHaveBeenCalled();
  });

  it("deletes only the owner's unapproved Regional Outreach request", async () => {
    const deleted = {
      id: "expense-id",
      title: "Regional transport",
    };

    db.query.mockResolvedValueOnce({ rows: [deleted] });

    await expect(
      deleteRegionalExpenseRequest("expense-id", "officer-id"),
    ).resolves.toEqual(deleted);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("requested_by = $2");
    expect(sql).toContain("submitted_role = 'regional_outreach_officer'");
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain("approval_stage = 'projects_manager'");
    expect(params).toEqual(["expense-id", "officer-id"]);
  });

  it("returns null when a request cannot be deleted", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      deleteRegionalExpenseRequest("expense-id", "officer-id"),
    ).resolves.toBeNull();
  });
});
