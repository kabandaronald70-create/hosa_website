import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  getProjectById: vi.fn(),
  createProject: vi.fn(),
  updateProjectStatus: vi.fn(),
  listMilestones: vi.fn(),
  createMilestone: vi.fn(),
  updateMilestoneStatus: vi.fn(),
  createAttachment: vi.fn(),
  listAttachments: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  listOutreachOfficers: vi.fn(),
  updateFundsRaised: vi.fn(),
  listProjectApprovalQueue: vi.fn(),
  getProjectApprovalHistory: vi.fn(),
  decideProjectApproval: vi.fn(),
  listRegionalExpensesForProjectsManagerReview: vi.fn(),

  uploadProjectFile: vi.fn(),
  uploadProjectImage: vi.fn(),

  auditLog: vi.fn(),
  notifyProjectProposalSubmitted: vi.fn(),
  notifyProjectApprovalDecision: vi.fn(),
}));

vi.mock("../src/models/projectModel.js", () => ({
  listProjects: mocks.listProjects,
  getProjectById: mocks.getProjectById,
  createProject: mocks.createProject,
  updateProjectStatus: mocks.updateProjectStatus,
  listMilestones: mocks.listMilestones,
  createMilestone: mocks.createMilestone,
  updateMilestoneStatus: mocks.updateMilestoneStatus,
  createAttachment: mocks.createAttachment,
  listAttachments: mocks.listAttachments,
  updateProject: mocks.updateProject,
  deleteProject: mocks.deleteProject,
  listOutreachOfficers: mocks.listOutreachOfficers,
  updateFundsRaised: mocks.updateFundsRaised,
  listProjectApprovalQueue: mocks.listProjectApprovalQueue,
  getProjectApprovalHistory: mocks.getProjectApprovalHistory,
  decideProjectApproval: mocks.decideProjectApproval,
}));

vi.mock("../src/models/financeModel.js", () => ({
  listRegionalExpensesForProjectsManagerReview:
    mocks.listRegionalExpensesForProjectsManagerReview,
}));

vi.mock("../src/services/projectFileService.js", () => ({
  uploadProjectFile: mocks.uploadProjectFile,
  uploadProjectImage: mocks.uploadProjectImage,
}));

vi.mock("../src/services/auditService.js", () => ({
  auditLog: mocks.auditLog,
}));

vi.mock("../src/services/notificationsService.js", () => ({
  notifyProjectProposalSubmitted: mocks.notifyProjectProposalSubmitted,
  notifyProjectApprovalDecision: mocks.notifyProjectApprovalDecision,
}));

import {
  showAdminProjects,
  showProjectApprovalQueue,
  showProjectProposalReview,
  actionDecideProjectProposal,
} from "../src/controllers/projectController.js";

const project = {
  id: "project-123",
  title: "Regional Computer Lab",
  proposal_source: "regional_outreach",
  approval_status: "pending",
  approval_stage: "projects_manager",
  status: "proposed",
  created_by: "regional-officer-id",
  region: "Central",
  created_at: "2026-11-21T10:00:00.000Z",
};

function createMocks({
  userId = "reviewer-id",
  userRoles = ["admin"],
  leadershipRoles = ["Projects Manager"],
  params = { id: project.id },
  body = {},
} = {}) {
  const req = {
    user: { id: userId },
    userRoles,
    leadershipRoles,
    params,
    body,
    flash: vi.fn(),
  };

  const res = {
    render: vi.fn(),
    redirect: vi.fn(),
    status: vi.fn(),
  };

  res.status.mockReturnValue(res);

  return {
    req,
    res,
    next: vi.fn(),
  };
}

describe("Project Controller - Approval Queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.listProjectApprovalQueue.mockResolvedValue([]);
  });

  it("denies access to users without an eligible approval role", async () => {
    const { req, res, next } = createMocks({
      userRoles: ["member"],
      leadershipRoles: [],
    });

    await showProjectApprovalQueue(req, res, next);

    expect(req.flash).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("not authorized"),
    );

    expect(res.redirect).toHaveBeenCalledWith("/dashboard");
    expect(mocks.listProjectApprovalQueue).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("loads queues for every eligible approval stage", async () => {
    const pmProject = {
      ...project,
      approval_stage: "projects_manager",
      created_at: "2026-11-20T10:00:00.000Z",
    };

    const chairProject = {
      ...project,
      id: "project-456",
      approval_stage: "chairperson",
      created_at: "2026-11-21T10:00:00.000Z",
    };

    mocks.listProjectApprovalQueue.mockImplementation(async (stage) => {
      if (stage === "projects_manager") return [pmProject];
      if (stage === "chairperson") return [chairProject];
      return [];
    });

    const { req, res, next } = createMocks({
      leadershipRoles: ["Projects Manager", "Chairperson"],
    });

    await showProjectApprovalQueue(req, res, next);

    expect(mocks.listProjectApprovalQueue).toHaveBeenCalledTimes(2);

    expect(mocks.listProjectApprovalQueue).toHaveBeenCalledWith(
      "projects_manager",
      "reviewer-id",
    );

    expect(mocks.listProjectApprovalQueue).toHaveBeenCalledWith(
      "chairperson",
      "reviewer-id",
    );

    expect(res.render).toHaveBeenCalledWith(
      "admin/project-proposals",
      expect.objectContaining({
        projects: [pmProject, chairProject],
        eligibleStages: ["chairperson", "projects_manager"],
        layout: "layouts/app",
      }),
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("forwards queue-loading errors to error middleware", async () => {
    const error = new Error("Queue query failed");

    mocks.listProjectApprovalQueue.mockRejectedValue(error);

    const { req, res, next } = createMocks();

    await showProjectApprovalQueue(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.render).not.toHaveBeenCalled();
  });
});

describe("Project Controller - Proposal Review", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getProjectById.mockResolvedValue(project);

    mocks.listProjectApprovalQueue.mockResolvedValue([project]);

    mocks.getProjectApprovalHistory.mockResolvedValue([]);
  });

  it("renders a proposal and its approval history for an eligible reviewer", async () => {
    const history = [
      {
        actor_name: "Projects Manager",
        actor_role: "projects_manager",
        decision: "approved",
      },
    ];

    mocks.getProjectApprovalHistory.mockResolvedValue(history);

    const { req, res, next } = createMocks();

    await showProjectProposalReview(req, res, next);

    expect(mocks.getProjectById).toHaveBeenCalledWith(project.id);

    expect(mocks.listProjectApprovalQueue).toHaveBeenCalledWith(
      "projects_manager",
      "reviewer-id",
    );

    expect(mocks.getProjectApprovalHistory).toHaveBeenCalledWith(project.id);

    expect(res.render).toHaveBeenCalledWith(
      "admin/project-proposal-review",
      expect.objectContaining({
        project,
        history,
        currentStage: "Projects Manager",
        layout: "layouts/app",
      }),
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("returns a 404 when the proposal does not exist", async () => {
    mocks.getProjectById.mockResolvedValue(null);

    const { req, res, next } = createMocks();

    await showProjectProposalReview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.render).toHaveBeenCalledWith(
      "admin/404",
      expect.objectContaining({
        layout: "layouts/app",
      }),
    );

    expect(mocks.listProjectApprovalQueue).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("prevents a reviewer from opening a proposal at another stage", async () => {
    mocks.getProjectById.mockResolvedValue({
      ...project,
      approval_stage: "chairperson",
    });

    const { req, res, next } = createMocks();

    await showProjectProposalReview(req, res, next);

    expect(req.flash).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("not awaiting review"),
    );

    expect(res.redirect).toHaveBeenCalledWith("/admin/project-proposals");
    expect(mocks.listProjectApprovalQueue).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("prevents a reviewer who already participated from reopening the proposal", async () => {
    mocks.listProjectApprovalQueue.mockResolvedValue([]);

    const { req, res, next } = createMocks();

    await showProjectProposalReview(req, res, next);

    expect(req.flash).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("already participated"),
    );

    expect(res.redirect).toHaveBeenCalledWith("/admin/project-proposals");
    expect(mocks.getProjectApprovalHistory).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});

describe("Project Controller - Proposal Decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getProjectById.mockResolvedValue(project);

    mocks.listProjectApprovalQueue.mockResolvedValue([project]);

    mocks.decideProjectApproval.mockResolvedValue({
      ok: true,
      project: {
        ...project,
        approval_stage: "chairperson",
      },
      nextStage: "chairperson",
      completed: false,
      rejected: false,
    });

    mocks.auditLog.mockResolvedValue(undefined);
    mocks.notifyProjectApprovalDecision.mockResolvedValue(undefined);
  });

  it("rejects an invalid decision before loading the proposal", async () => {
    const { req, res, next } = createMocks({
      body: { decision: "maybe" },
    });

    await actionDecideProjectProposal(req, res, next);

    expect(req.flash).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("valid approval decision"),
    );

    expect(res.redirect).toHaveBeenCalledWith(
      `/admin/project-proposals/${project.id}`,
    );

    expect(mocks.getProjectById).not.toHaveBeenCalled();
    expect(mocks.decideProjectApproval).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("requires a reason when rejecting a proposal", async () => {
    const { req, res, next } = createMocks({
      body: {
        decision: "rejected",
        comments: "   ",
      },
    });

    await actionDecideProjectProposal(req, res, next);

    expect(req.flash).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("reason is required"),
    );

    expect(res.redirect).toHaveBeenCalledWith(
      `/admin/project-proposals/${project.id}`,
    );

    expect(mocks.getProjectById).not.toHaveBeenCalled();
    expect(mocks.decideProjectApproval).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("records approval and notifies the next approval stage", async () => {
    const { req, res, next } = createMocks({
      body: {
        decision: "approved",
        comments: "The proposal meets the requirements.",
      },
    });

    await actionDecideProjectProposal(req, res, next);

    expect(mocks.decideProjectApproval).toHaveBeenCalledWith({
      projectId: project.id,
      actorId: "reviewer-id",
      actorRole: "projects_manager",
      decision: "approved",
      comments: "The proposal meets the requirements.",
    });

    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "project.proposal_stage_approved",
        targetType: "project",
        targetId: project.id,
      }),
    );

    expect(mocks.notifyProjectApprovalDecision).toHaveBeenCalledWith({
      project: expect.objectContaining({
        id: project.id,
      }),
      actorUserId: "reviewer-id",
      decision: "approved",
      nextStage: "chairperson",
    });

    expect(req.flash).toHaveBeenCalledWith(
      "success",
      expect.stringContaining("Chairperson"),
    );

    expect(res.redirect).toHaveBeenCalledWith("/admin/project-proposals");
    expect(next).not.toHaveBeenCalled();
  });

  it("records rejection with the reason and notifies the submitter", async () => {
    const rejectedProject = {
      ...project,
      approval_status: "rejected",
      approval_stage: "rejected",
      rejection_reason: "The budget needs further justification.",
    };

    mocks.decideProjectApproval.mockResolvedValue({
      ok: true,
      project: rejectedProject,
      nextStage: null,
      completed: false,
      rejected: true,
    });

    const { req, res, next } = createMocks({
      body: {
        decision: "rejected",
        comments: "  The budget needs further justification.  ",
      },
    });

    await actionDecideProjectProposal(req, res, next);

    expect(mocks.decideProjectApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "rejected",
        comments: "The budget needs further justification.",
      }),
    );

    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "project.proposal_rejected",
      }),
    );

    expect(mocks.notifyProjectApprovalDecision).toHaveBeenCalledWith({
      project: rejectedProject,
      actorUserId: "reviewer-id",
      decision: "rejected",
      nextStage: null,
    });

    expect(req.flash).toHaveBeenCalledWith(
      "success",
      expect.stringContaining("submitting officer has been notified"),
    );

    expect(res.redirect).toHaveBeenCalledWith("/admin/project-proposals");
    expect(next).not.toHaveBeenCalled();
  });

  it("reports completion when Super Admin gives final approval", async () => {
    const approvedProject = {
      ...project,
      approval_status: "approved",
      approval_stage: "completed",
      status: "approved",
    };

    mocks.getProjectById.mockResolvedValue({
      ...project,
      approval_stage: "super_admin",
    });

    mocks.listProjectApprovalQueue.mockResolvedValue([
      {
        ...project,
        approval_stage: "super_admin",
      },
    ]);

    mocks.decideProjectApproval.mockResolvedValue({
      ok: true,
      project: approvedProject,
      nextStage: "completed",
      completed: true,
      rejected: false,
    });

    const { req, res, next } = createMocks({
      userRoles: ["super_admin"],
      leadershipRoles: [],
      body: { decision: "approved" },
    });

    await actionDecideProjectProposal(req, res, next);

    expect(mocks.decideProjectApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: "super_admin",
        decision: "approved",
      }),
    );

    expect(req.flash).toHaveBeenCalledWith(
      "success",
      expect.stringContaining("now approved for publication"),
    );

    expect(mocks.notifyProjectApprovalDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "approved",
        nextStage: "completed",
      }),
    );

    expect(res.redirect).toHaveBeenCalledWith("/admin/project-proposals");
    expect(next).not.toHaveBeenCalled();
  });

  it("does not make a decision when the reviewer is not in the approval queue", async () => {
    mocks.listProjectApprovalQueue.mockResolvedValue([]);

    const { req, res, next } = createMocks();

    await actionDecideProjectProposal(
      {
        ...req,
        body: { decision: "approved" },
      },
      res,
      next,
    );

    expect(mocks.decideProjectApproval).not.toHaveBeenCalled();
    expect(mocks.auditLog).not.toHaveBeenCalled();
    expect(mocks.notifyProjectApprovalDecision).not.toHaveBeenCalled();

    expect(req.flash).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("already participated"),
    );

    expect(res.redirect).toHaveBeenCalledWith("/admin/project-proposals");
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards unexpected decision errors to error middleware", async () => {
    const error = new Error("Approval database failure");

    mocks.getProjectById.mockRejectedValue(error);

    const { req, res, next } = createMocks({
      body: { decision: "approved" },
    });

    await actionDecideProjectProposal(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.redirect).not.toHaveBeenCalled();
  });
});

describe("Project Controller - Projects Management Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.listProjects.mockResolvedValue([]);
    mocks.listOutreachOfficers.mockResolvedValue([]);
    mocks.listRegionalExpensesForProjectsManagerReview.mockResolvedValue([]);
  });

  it("loads Regional expense requests for an active Projects Manager", async () => {
    const regionalExpenses = [
      {
        id: "expense-123",
        title: "Regional Outreach Transport",
        amount: 250000,
        category: "Projects",
        description: "Transport for regional activities.",
        status: "pending",
        approval_stage: "projects_manager",
        submitted_office: "Regional Outreach",
        submitted_role: "regional_outreach_officer",
        first_name: "Regional",
        last_name: "Officer",
      },
    ];

    mocks.listRegionalExpensesForProjectsManagerReview.mockResolvedValue(
      regionalExpenses,
    );

    const { req, res, next } = createMocks({
      userRoles: ["admin"],
      leadershipRoles: ["Projects Manager"],
    });

    await showAdminProjects(req, res, next);

    expect(
      mocks.listRegionalExpensesForProjectsManagerReview,
    ).toHaveBeenCalledWith({ limit: 50 });

    expect(res.render).toHaveBeenCalledWith(
      "admin/projects",
      expect.objectContaining({
        canManageProjects: true,
        canReviewRegionalExpenses: true,
        regionalExpenses,
      }),
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("does not grant Projects Manager expense approval to Super Admin", async () => {
    const { req, res, next } = createMocks({
      userRoles: ["super_admin"],
      leadershipRoles: [],
    });

    await showAdminProjects(req, res, next);

    expect(
      mocks.listRegionalExpensesForProjectsManagerReview,
    ).not.toHaveBeenCalled();

    expect(res.render).toHaveBeenCalledWith(
      "admin/projects",
      expect.objectContaining({
        canManageProjects: true,
        canReviewRegionalExpenses: false,
        regionalExpenses: [],
      }),
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("does not grant Projects Manager expense approval to Chairperson", async () => {
    const { req, res, next } = createMocks({
      userRoles: ["admin"],
      leadershipRoles: ["Chairperson"],
    });

    await showAdminProjects(req, res, next);

    expect(
      mocks.listRegionalExpensesForProjectsManagerReview,
    ).not.toHaveBeenCalled();

    expect(res.render).toHaveBeenCalledWith(
      "admin/projects",
      expect.objectContaining({
        canManageProjects: false,
        canReviewRegionalExpenses: false,
        regionalExpenses: [],
      }),
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("recognizes Projects Manager titles case-insensitively", async () => {
    const { req, res, next } = createMocks({
      userRoles: ["admin"],
      leadershipRoles: ["  PROJECTS MANAGER  "],
    });

    await showAdminProjects(req, res, next);

    expect(
      mocks.listRegionalExpensesForProjectsManagerReview,
    ).toHaveBeenCalledWith({ limit: 50 });

    expect(res.render).toHaveBeenCalledWith(
      "admin/projects",
      expect.objectContaining({
        canReviewRegionalExpenses: true,
      }),
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("forwards dashboard loading errors to error middleware", async () => {
    const error = new Error("Regional expense review query failed");

    mocks.listRegionalExpensesForProjectsManagerReview.mockRejectedValue(error);

    const { req, res, next } = createMocks();

    await showAdminProjects(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.render).not.toHaveBeenCalled();
  });
});
