import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("../src/config/db.js", () => db);

import {
  listProjectApprovalQueue,
  getProjectApprovalHistory,
  decideProjectApproval,
} from "../src/models/projectModel.js";

describe("Project approval queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pending proposals assigned to the requested stage", async () => {
    const proposals = [
      { id: "proposal-1", approval_stage: "projects_manager" },
    ];

    db.query.mockResolvedValueOnce({ rows: proposals });

    await expect(
      listProjectApprovalQueue("projects_manager", "reviewer-id"),
    ).resolves.toEqual(proposals);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("approval_status = 'pending'");
    expect(sql).toContain("approval_stage = $1");
    expect(sql).toContain("p.created_by IS NULL OR p.created_by <> $2");
    expect(sql).toContain("NOT EXISTS");
    expect(sql).toContain("h.actor_user_id = $2");
    expect(params).toEqual(["projects_manager", "reviewer-id"]);
  });

  it("excludes reviewers who already participated in a proposal", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      listProjectApprovalQueue("chairperson", "previous-reviewer"),
    ).resolves.toEqual([]);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("project_approval_history");
    expect(sql).toContain("h.actor_user_id = $2");
    expect(params).toEqual(["chairperson", "previous-reviewer"]);
  });

  it("does not query for an unsupported approval stage", async () => {
    await expect(
      listProjectApprovalQueue("treasurer", "reviewer-id"),
    ).resolves.toEqual([]);

    expect(db.query).not.toHaveBeenCalled();
  });

  it("does not query when the reviewer ID is missing", async () => {
    await expect(
      listProjectApprovalQueue("chairperson", null),
    ).resolves.toEqual([]);

    expect(db.query).not.toHaveBeenCalled();
  });
});

describe("Project approval history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns decisions with reviewer identity and comments", async () => {
    const history = [
      {
        id: "history-1",
        project_id: "proposal-1",
        actor_user_id: "reviewer-1",
        actor_role: "projects_manager",
        decision: "approved",
        comments: "Technically sound.",
        actor_name: "Projects Manager",
      },
    ];

    db.query.mockResolvedValueOnce({ rows: history });

    await expect(
      getProjectApprovalHistory("proposal-1"),
    ).resolves.toEqual(history);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("project_approval_history");
    expect(sql).toContain("LEFT JOIN users");
    expect(sql).toContain("LEFT JOIN member_profiles");
    expect(sql).toContain("ORDER BY h.created_at ASC");
    expect(params).toEqual(["proposal-1"]);
  });

  it("returns an empty history when no decisions exist", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      getProjectApprovalHistory("proposal-1"),
    ).resolves.toEqual([]);
  });
});

function configureApprovalTransaction({
  project,
  roleRows = [{}],
  history = [],
  updatedProject = {},
}) {
  const client = {
    query: vi
      .fn()
      .mockResolvedValueOnce({ rows: [project] })
      .mockResolvedValueOnce({ rows: roleRows })
      .mockResolvedValueOnce({ rows: history })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [updatedProject],
      }),
  };

  db.withTransaction.mockImplementation((callback) => callback(client));

  return client;
}

describe("Project approval decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("advances a regional proposal from Projects Manager to Chairperson", async () => {
    const project = {
      id: "regional-project",
      created_by: "regional-officer",
      proposal_source: "regional_outreach",
      approval_status: "pending",
      approval_stage: "projects_manager",
      status: "proposed",
    };

    const updatedProject = {
      ...project,
      approval_stage: "chairperson",
    };

    const client = configureApprovalTransaction({
      project,
      updatedProject,
    });

    const result = await decideProjectApproval({
      projectId: project.id,
      actorId: "projects-manager",
      actorRole: "projects_manager",
      decision: "approved",
      comments: "Proposal reviewed.",
    });

    expect(result.ok).toBe(true);
    expect(result.nextStage).toBe("chairperson");
    expect(result.completed).toBe(false);
    expect(result.project).toEqual(updatedProject);

    expect(client.query).toHaveBeenCalledTimes(5);
    expect(client.query.mock.calls[0][0]).toContain("FOR UPDATE");
    expect(client.query.mock.calls[3][0]).toContain(
      "INSERT INTO project_approval_history",
    );
    expect(client.query.mock.calls[4][0]).toContain(
      "UPDATE projects",
    );

    expect(client.query.mock.calls[3][1]).toEqual([
      project.id,
      "projects-manager",
      "projects_manager",
      "approved",
      "Proposal reviewed.",
    ]);
  });

  it("advances a Projects Manager proposal from Chairperson to Super Admin", async () => {
    const project = {
      id: "pm-project",
      created_by: "projects-manager-submitter",
      proposal_source: "projects_manager",
      approval_status: "pending",
      approval_stage: "chairperson",
      status: "proposed",
    };

    const updatedProject = {
      ...project,
      approval_stage: "super_admin",
    };

    configureApprovalTransaction({
      project,
      updatedProject,
    });

    const result = await decideProjectApproval({
      projectId: project.id,
      actorId: "independent-chairperson",
      actorRole: "chairperson",
      decision: "approved",
    });

    expect(result.ok).toBe(true);
    expect(result.nextStage).toBe("super_admin");
    expect(result.completed).toBe(false);
  });

  it("completes a regional proposal only after Super Admin approval", async () => {
    const project = {
      id: "regional-project",
      created_by: "regional-officer",
      proposal_source: "regional_outreach",
      approval_status: "pending",
      approval_stage: "super_admin",
      status: "proposed",
    };

    const history = [
      {
        actor_user_id: "projects-manager",
        actor_role: "projects_manager",
        decision: "approved",
      },
      {
        actor_user_id: "chairperson",
        actor_role: "chairperson",
        decision: "approved",
      },
    ];

    const updatedProject = {
      ...project,
      approval_status: "approved",
      approval_stage: "completed",
      status: "approved",
    };

    const client = configureApprovalTransaction({
      project,
      history,
      updatedProject,
    });

    const result = await decideProjectApproval({
      projectId: project.id,
      actorId: "super-admin",
      actorRole: "super_admin",
      decision: "approved",
      comments: "Final approval granted.",
    });

    expect(result.ok).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.nextStage).toBe("completed");
    expect(result.project.approval_status).toBe("approved");
    expect(result.project.status).toBe("approved");

    expect(client.query.mock.calls[1][0]).toContain("user_roles");
    expect(client.query.mock.calls[4][1][0]).toBe("approved");
    expect(client.query.mock.calls[4][1][1]).toBe("completed");
    expect(client.query.mock.calls[4][1][5]).toBe("approved");
  });

  it("prevents a proposal creator from approving their own proposal", async () => {
    const project = {
      id: "pm-project",
      created_by: "same-user",
      proposal_source: "projects_manager",
      approval_status: "pending",
      approval_stage: "chairperson",
      status: "proposed",
    };

    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [project],
      }),
    };

    db.withTransaction.mockImplementation((callback) => callback(client));

    const result = await decideProjectApproval({
      projectId: project.id,
      actorId: "same-user",
      actorRole: "chairperson",
      decision: "approved",
    });

    expect(result).toEqual({
      ok: false,
      reason: "submitter_cannot_approve",
    });

    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("prevents a reviewer from participating twice", async () => {
    const project = {
      id: "regional-project",
      created_by: "regional-officer",
      proposal_source: "regional_outreach",
      approval_status: "pending",
      approval_stage: "chairperson",
      status: "proposed",
    };

    const history = [
      {
        actor_user_id: "same-reviewer",
        actor_role: "projects_manager",
        decision: "approved",
      },
    ];

    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [project] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: history }),
    };

    db.withTransaction.mockImplementation((callback) => callback(client));

    const result = await decideProjectApproval({
      projectId: project.id,
      actorId: "same-reviewer",
      actorRole: "chairperson",
      decision: "approved",
    });

    expect(result).toEqual({
      ok: false,
      reason: "already_participated",
    });

    expect(client.query).toHaveBeenCalledTimes(3);
  });

  it("rejects a proposal and records the rejection reason", async () => {
    const project = {
      id: "regional-project",
      created_by: "regional-officer",
      proposal_source: "regional_outreach",
      approval_status: "pending",
      approval_stage: "projects_manager",
      status: "proposed",
    };

    const updatedProject = {
      ...project,
      approval_status: "rejected",
      approval_stage: "rejected",
      rejection_reason: "Insufficient supporting information.",
      rejected_by: "projects-manager",
    };

    const client = configureApprovalTransaction({
      project,
      updatedProject,
    });

    const result = await decideProjectApproval({
      projectId: project.id,
      actorId: "projects-manager",
      actorRole: "projects_manager",
      decision: "rejected",
      comments: "  Insufficient supporting information.  ",
    });

    expect(result.ok).toBe(true);
    expect(result.rejected).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.nextStage).toBe("rejected");

    expect(client.query.mock.calls[3][1]).toEqual([
      project.id,
      "projects-manager",
      "projects_manager",
      "rejected",
      "Insufficient supporting information.",
    ]);

    expect(client.query.mock.calls[4][1][0]).toBe("rejected");
    expect(client.query.mock.calls[4][1][1]).toBe("rejected");
  });

  it("does not start a transaction when a rejection reason is missing", async () => {
    await expect(
      decideProjectApproval({
        projectId: "regional-project",
        actorId: "projects-manager",
        actorRole: "projects_manager",
        decision: "rejected",
        comments: "   ",
      }),
    ).rejects.toThrow("A rejection reason is required.");

    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  it("rejects a decision when the required earlier approval is missing", async () => {
    const project = {
      id: "regional-project",
      created_by: "regional-officer",
      proposal_source: "regional_outreach",
      approval_status: "pending",
      approval_stage: "chairperson",
      status: "proposed",
    };

    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [project] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    db.withTransaction.mockImplementation((callback) => callback(client));

    const result = await decideProjectApproval({
      projectId: project.id,
      actorId: "chairperson",
      actorRole: "chairperson",
      decision: "approved",
    });

    expect(result).toEqual({
      ok: false,
      reason: "incomplete_approval_history",
    });

    expect(client.query).toHaveBeenCalledTimes(3);
  });
});
