import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  createNotification: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../src/config/db.js", () => ({
  query: mocks.query,
}));

vi.mock("../src/models/notificationModel.js", () => ({
  createNotification: mocks.createNotification,
}));

vi.mock("../src/utils/logger.js", () => ({
  logger: mocks.logger,
}));

import {
  notifyProjectProposalSubmitted,
  notifyProjectApprovalDecision,
} from "../src/services/notificationsService.js";

describe("Project proposal notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createNotification.mockResolvedValue({ id: "notification-id" });
    mocks.query.mockResolvedValue({ rows: [] });
  });

  it("notifies Projects Managers when a regional proposal is submitted", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "projects-manager" }],
    });

    await notifyProjectProposalSubmitted({
      id: "regional-project",
      title: "Regional Library Project",
      region: "Central",
      created_by: "regional-officer",
      proposal_source: "regional_outreach",
      approval_stage: "projects_manager",
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][0]).toContain(
      "TRIM(office_title) = $1",
    );
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "Projects Manager",
      "regional-officer",
    ]);

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "projects-manager",
        type: "project.approval_required",
        link: "/admin/project-proposals",
      }),
    );
  });

  it("notifies eligible Chairpersons when a Projects Manager submits a proposal, excluding the submitter", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        { id: "independent-chairperson" },
      ],
    });

    await notifyProjectProposalSubmitted({
      id: "pm-project",
      title: "School Laboratory Upgrade",
      region: "Central",
      created_by: "projects-manager",
      proposal_source: "projects_manager",
      approval_stage: "chairperson",
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "Chairperson",
      "projects-manager",
    ]);

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "independent-chairperson",
        type: "project.approval_required",
      }),
    );

    expect(mocks.createNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "projects-manager",
      }),
    );
  });

  it("notifies the regional submitter with the rejection reason", async () => {
    await notifyProjectApprovalDecision({
      project: {
        id: "regional-project",
        title: "Regional Library Project",
        created_by: "regional-officer",
        proposal_source: "regional_outreach",
        rejection_reason: "Insufficient supporting information.",
      },
      actorUserId: "projects-manager",
      decision: "rejected",
      nextStage: "rejected",
    });

    expect(mocks.query).not.toHaveBeenCalled();

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createNotification).toHaveBeenCalledWith({
      userId: "regional-officer",
      type: "project.proposal_rejected",
      title: "Project Proposal Not Approved",
      body: expect.stringContaining(
        "Insufficient supporting information.",
      ),
      link: "/regional/dashboard",
    });
  });

  it("notifies the next eligible Chairperson after Projects Manager approval", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "independent-chairperson" }],
    });

    await notifyProjectApprovalDecision({
      project: {
        id: "regional-project",
        title: "Regional Library Project",
        region: "Central",
        created_by: "regional-officer",
        proposal_source: "regional_outreach",
      },
      actorUserId: "projects-manager",
      decision: "approved",
      nextStage: "chairperson",
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "Chairperson",
      "projects-manager",
    ]);

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "independent-chairperson",
        type: "project.approval_required",
      }),
    );
  });

  it("notifies the submitter when final Super Admin approval is granted", async () => {
    await notifyProjectApprovalDecision({
      project: {
        id: "regional-project",
        title: "Regional Library Project",
        created_by: "regional-officer",
        proposal_source: "regional_outreach",
      },
      actorUserId: "super-admin",
      decision: "approved",
      nextStage: "completed",
    });

    expect(mocks.query).not.toHaveBeenCalled();

    expect(mocks.createNotification).toHaveBeenCalledWith({
      userId: "regional-officer",
      type: "project.proposal_approved",
      title: "Project Proposal Approved",
      body: expect.stringContaining(
        "passed all approval stages",
      ),
      link: "/regional/dashboard",
    });
  });

  it("does not throw when a notification cannot be created", async () => {
    mocks.createNotification.mockRejectedValueOnce(
      new Error("Notification database unavailable"),
    );

    await expect(
      notifyProjectApprovalDecision({
        project: {
          id: "regional-project",
          title: "Regional Library Project",
          created_by: "regional-officer",
          proposal_source: "regional_outreach",
          rejection_reason: "Missing documents.",
        },
        actorUserId: "projects-manager",
        decision: "rejected",
        nextStage: "rejected",
      }),
    ).resolves.toBeUndefined();

    expect(mocks.logger.error).toHaveBeenCalled();
  });
});
