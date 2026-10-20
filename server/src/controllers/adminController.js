import { query } from "../config/db.js";
import {
  getAdminCounts,
  getRecentAudits,
  listMembers,
  getMemberForAdmin,
  setMemberVerified,
  setUserStatus,
  listPendingStories,
  getStoryForModeration,
  setStoryStatus,
  listPendingOpportunities,
  getOpportunityForModeration,
  setOpportunityStatus,
  listAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  setEventStatus,
  getEventRsvpCounts,
  listAuditLogs,
  listAuditLogsForExport,
  getAuditLogById,
  listAuditActions,
  listAuditTargetTypes,
} from "../models/adminModel.js";

import {
  notifyStoryApproved,
  notifyStoryRejected,
  notifyOpportunityApproved,
  notifyOpportunityRejected,
} from "../services/notificationsService.js";

import { redactMetadata, toCsvCell } from "../services/auditRedact.js";
import { auditLog } from "../services/auditService.js";
import { AUDIT_ACTIONS } from "../services/auditActions.js";

import {
  eventSchema,
  flattenZodError as flattenEventError,
  normalizeEventFields,
} from "../validators/eventValidators.js";

import { uniqueEventSlug } from "../services/eventService.js";

export async function showAdminOverview(req, res, next) {
  try {
    const [counts, recentAudits] = await Promise.all([
      getAdminCounts(),
      getRecentAudits(10),
    ]);
    res.render("admin/overview", {
      title: "Admin — HOSA",
      counts,
      recentAudits,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function showMembersList(req, res, next) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = ["active", "suspended", "deactivated"].includes(
      req.query.status,
    )
      ? req.query.status
      : "";
    const role = [
      "member",
      "mentor",
      "moderator",
      "admin",
      "super_admin",
    ].includes(req.query.role)
      ? req.query.role
      : "";
    const verifiedRaw = req.query.verified;
    const verified =
      verifiedRaw === "yes" ? true : verifiedRaw === "no" ? false : undefined;

    const approvalRaw = req.query.approval;
    const approval =
      approvalRaw === "yes" ? true : approvalRaw === "no" ? false : undefined;

    const page = Number.isFinite(Number(req.query.page))
      ? Math.max(1, Number(req.query.page))
      : 1;

    const result = await listMembers({
      q,
      status,
      role,
      verified,
      approval,
      page,
      limit: 25,
    });

    res.render("admin/members-list", {
      title: "Members — Admin",
      result,
      filters: {
        q,
        status,
        role,
        verified: verifiedRaw || "",
        approval: approvalRaw || "",
      },
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function showMemberDetail(req, res, next) {
  try {
    const member = await getMemberForAdmin(req.params.id);
    if (!member) {
      return res.status(404).render("admin/member-detail", {
        title: "Member not found",
        member: null,
        layout: "layouts/app",
      });
    }
    res.render("admin/member-detail", {
      title: `Member: ${member.email} — Admin`,
      member,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionVerifyMember(req, res, next) {
  try {
    const { id } = req.params;
    const member = await getMemberForAdmin(id);
    if (!member)
      return res
        .status(404)
        .render("admin/member-detail", { member: null, layout: "layouts/app" });

    await setMemberVerified(id, true);
    await auditLog({
      req,
      action: AUDIT_ACTIONS.MEMBER_VERIFY,
      targetType: "user",
      targetId: id,
      metadata: { email: member.email },
    });

    req.flash("success", `Verified ${member.email}.`);
    res.redirect(`/admin/members/${id}`);
  } catch (err) {
    next(err);
  }
}

export async function actionUnverifyMember(req, res, next) {
  try {
    const { id } = req.params;
    const member = await getMemberForAdmin(id);
    if (!member)
      return res
        .status(404)
        .render("admin/member-detail", { member: null, layout: "layouts/app" });

    await setMemberVerified(id, false);
    await auditLog({
      req,
      action: AUDIT_ACTIONS.MEMBER_UNVERIFY,
      targetType: "user",
      targetId: id,
      metadata: { email: member.email },
    });

    req.flash("success", `Removed verification from ${member.email}.`);
    res.redirect(`/admin/members/${id}`);
  } catch (err) {
    next(err);
  }
}

export async function actionSuspendMember(req, res, next) {
  try {
    const { id } = req.params;
    const reason = (req.body.reason || "").trim().slice(0, 500);

    if (id === req.user.id) {
      req.flash("error", "You cannot suspend your own account.");
      return res.redirect(`/admin/members/${id}`);
    }

    const member = await getMemberForAdmin(id);
    if (!member)
      return res
        .status(404)
        .render("admin/member-detail", { member: null, layout: "layouts/app" });

    await setUserStatus(id, "suspended");
    await auditLog({
      req,
      action: AUDIT_ACTIONS.MEMBER_SUSPEND,
      targetType: "user",
      targetId: id,
      metadata: { email: member.email, reason: reason || null },
    });

    req.flash("success", `Suspended ${member.email}.`);
    res.redirect(`/admin/members/${id}`);
  } catch (err) {
    next(err);
  }
}

export async function actionReactivateMember(req, res, next) {
  try {
    const { id } = req.params;
    const member = await getMemberForAdmin(id);
    if (!member)
      return res
        .status(404)
        .render("admin/member-detail", { member: null, layout: "layouts/app" });

    await setUserStatus(id, "active");
    await auditLog({
      req,
      action: AUDIT_ACTIONS.MEMBER_REACTIVATE,
      targetType: "user",
      targetId: id,
      metadata: { email: member.email },
    });
    req.flash("success", `Reactivated ${member.email}.`);
    res.redirect(`/admin/members/${id}`);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Membership Approval
// ---------------------------------------------------------------------------

export async function actionApproveMembership(req, res, next) {
  try {
    const { id } = req.params;
    const member = await getMemberForAdmin(id);
    if (!member) {
      return res.status(404).render("error", { message: "Member not found" });
    }

    await query(
      `UPDATE users SET membership_approved_at = now(), membership_approved_by = $1 WHERE id = $2`,
      [req.user.id, id],
    );

    await auditLog({
      req,
      action: "member.approve_membership",
      targetType: "user",
      targetId: id,
      metadata: { email: member.email },
    });

    req.flash("success", `Approved membership for ${member.email}.`);
    res.redirect(`/admin/members/${id}`);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Moderation queue
// ---------------------------------------------------------------------------

export async function showModerationQueue(req, res, next) {
  try {
    const [stories, opportunities] = await Promise.all([
      listPendingStories({ page: 1, limit: 50 }),
      listPendingOpportunities({ page: 1, limit: 50 }),
    ]);
    res.render("admin/moderation-queue", {
      title: "Moderation — Admin",
      stories,
      opportunities,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------- Stories --------------------------------------

export async function actionApproveStory(req, res, next) {
  try {
    const { id } = req.params;
    const story = await getStoryForModeration(id);
    if (!story) {
      req.flash("error", "Story not found.");
      return res.redirect("/admin/moderation");
    }

    await setStoryStatus(id, "published", { moderatorId: req.user.id });
    await auditLog({
      req,
      action: AUDIT_ACTIONS.STORY_APPROVE,
      targetType: "story",
      targetId: id,
      metadata: { title: story.title, slug: story.slug },
    });

    if (story.author_user_id) {
      await notifyStoryApproved({
        userId: story.author_user_id,
        storyTitle: story.title,
      });
    }

    req.flash("success", `Published "${story.title}".`);
    res.redirect("/admin/moderation");
  } catch (err) {
    next(err);
  }
}

export async function actionRejectStory(req, res, next) {
  try {
    const { id } = req.params;
    const reason = (req.body.reason || "").trim().slice(0, 500);
    if (!reason) {
      req.flash("error", "A rejection reason is required.");
      return res.redirect("/admin/moderation");
    }
    const story = await getStoryForModeration(id);
    if (!story) {
      req.flash("error", "Story not found.");
      return res.redirect("/admin/moderation");
    }

    await setStoryStatus(id, "rejected", { reason, moderatorId: req.user.id });
    await auditLog({
      req,
      action: AUDIT_ACTIONS.STORY_REJECT,
      targetType: "story",
      targetId: id,
      metadata: { title: story.title, reason },
    });

    if (story.author_user_id) {
      await notifyStoryRejected({
        userId: story.author_user_id,
        storyTitle: story.title,
        reason,
      });
    }

    req.flash("success", `Rejected "${story.title}".`);
    res.redirect("/admin/moderation");
  } catch (err) {
    next(err);
  }
}

// ------------------------ Opportunities -------------------------------------

export async function actionApproveOpportunity(req, res, next) {
  try {
    const { id } = req.params;
    const opp = await getOpportunityForModeration(id);
    if (!opp) {
      req.flash("error", "Opportunity not found.");
      return res.redirect("/admin/moderation");
    }

    await setOpportunityStatus(id, "approved", { moderatorId: req.user.id });
    await auditLog({
      req,
      action: AUDIT_ACTIONS.OPPORTUNITY_APPROVE,
      targetType: "opportunity",
      targetId: id,
      metadata: { title: opp.title, slug: opp.slug },
    });

    if (opp.submitted_by) {
      await notifyOpportunityApproved({
        userId: opp.submitted_by,
        oppTitle: opp.title,
      });
    }

    req.flash("success", `Approved "${opp.title}".`);
    res.redirect("/admin/moderation");
  } catch (err) {
    next(err);
  }
}

export async function actionRejectOpportunity(req, res, next) {
  try {
    const { id } = req.params;
    const reason = (req.body.reason || "").trim().slice(0, 500);
    if (!reason) {
      req.flash("error", "A rejection reason is required.");
      return res.redirect("/admin/moderation");
    }
    const opp = await getOpportunityForModeration(id);
    if (!opp) {
      req.flash("error", "Opportunity not found.");
      return res.redirect("/admin/moderation");
    }

    await setOpportunityStatus(id, "rejected", {
      reason,
      moderatorId: req.user.id,
    });
    await auditLog({
      req,
      action: AUDIT_ACTIONS.OPPORTUNITY_REJECT,
      targetType: "opportunity",
      targetId: id,
      metadata: { title: opp.title, reason },
    });

    if (opp.submitted_by) {
      await notifyOpportunityRejected({
        userId: opp.submitted_by,
        oppTitle: opp.title,
        reason,
      });
    }

    req.flash("success", `Rejected "${opp.title}".`);
    res.redirect("/admin/moderation");
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function showEventsList(req, res, next) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = ["draft", "published", "cancelled", "archived"].includes(
      req.query.status,
    )
      ? req.query.status
      : "";
    const when = ["upcoming", "past"].includes(req.query.when)
      ? req.query.when
      : "";
    const page = Number.isFinite(Number(req.query.page))
      ? Math.max(1, Number(req.query.page))
      : 1;

    const result = await listAllEvents({ q, status, when, page, limit: 25 });

    res.render("admin/events-list", {
      title: "Events — Admin",
      result,
      filters: { q, status, when },
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function showEventDetail(req, res, next) {
  try {
    const event = await getEventById(req.params.id);
    if (!event) {
      return res.status(404).render("admin/event-detail", {
        title: "Event not found",
        event: null,
        rsvps: { going: 0, maybe: 0, cancelled: 0 },
        layout: "layouts/app",
      });
    }
    const rsvps = await getEventRsvpCounts(event.id);
    res.render("admin/event-detail", {
      title: `Event: ${event.title}`,
      event,
      rsvps,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export function showNewEventForm(req, res) {
  res.render("admin/event-edit", {
    title: "New event — Admin",
    event: null,
    values: { timezone: "Africa/Kampala" },
    fieldErrors: {},
    isNew: true,
    layout: "layouts/app",
  });
}

export async function actionCreateEvent(req, res, next) {
  const parsed = eventSchema.safeParse(req.body);

  if (!parsed.success) {
    const { fieldErrors } = flattenEventError(parsed.error);
    return res.status(400).render("admin/event-edit", {
      title: "New event — Admin",
      event: null,
      values: req.body,
      fieldErrors,
      isNew: true,
      layout: "layouts/app",
    });
  }

  try {
    const fields = normalizeEventFields(parsed.data);
    fields.slug = await uniqueEventSlug(fields.title);

    const created = await createEvent(fields, req.user.id);
    await auditLog({
      req,
      action: AUDIT_ACTIONS.EVENT_CREATE,
      targetType: "event",
      targetId: created.id,
      metadata: { title: created.title, slug: created.slug },
    });
    req.flash("success", `Created event "${created.title}" as draft.`);
    res.redirect(`/admin/events/${created.id}`);
  } catch (err) {
    next(err);
  }
}

export async function showEditEventForm(req, res, next) {
  try {
    const event = await getEventById(req.params.id);
    if (!event) {
      return res.status(404).render("admin/event-detail", {
        title: "Event not found",
        event: null,
        rsvps: { going: 0, maybe: 0, cancelled: 0 },
        layout: "layouts/app",
      });
    }

    const localFor = (d) => {
      if (!d) return "";
      const dt = new Date(d);
      const pad = (n) => String(n).padStart(2, "0");
      return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    };

    res.render("admin/event-edit", {
      title: `Edit event: ${event.title}`,
      event,
      values: {
        ...event,
        starts_at: localFor(event.starts_at),
        ends_at: localFor(event.ends_at),
        registration_deadline: localFor(event.registration_deadline),
      },
      fieldErrors: {},
      isNew: false,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function actionUpdateEvent(req, res, next) {
  const parsed = eventSchema.safeParse(req.body);

  if (!parsed.success) {
    const { fieldErrors } = flattenEventError(parsed.error);
    return res.status(400).render("admin/event-edit", {
      title: "Edit event — Admin",
      event: { id: req.params.id },
      values: req.body,
      fieldErrors,
      isNew: false,
      layout: "layouts/app",
    });
  }

  try {
    const fields = normalizeEventFields(parsed.data);
    const updated = await updateEvent(req.params.id, fields);
    if (!updated) {
      req.flash("error", "Event not found.");
      return res.redirect("/admin/events");
    }

    await auditLog({
      req,
      action: AUDIT_ACTIONS.EVENT_UPDATE,
      targetType: "event",
      targetId: updated.id,
      metadata: { title: updated.title, slug: updated.slug },
    });
    req.flash("success", `Updated event "${updated.title}".`);
    res.redirect(`/admin/events/${updated.id}`);
  } catch (err) {
    next(err);
  }
}

export async function actionSetEventStatus(req, res, next) {
  try {
    const { id } = req.params;
    const nextStatus = req.body.status;
    const event = await getEventById(id);
    if (!event) {
      req.flash("error", "Event not found.");
      return res.redirect("/admin/events");
    }

    const updated = await setEventStatus(id, nextStatus);

    const actionKey =
      nextStatus === "published"
        ? AUDIT_ACTIONS.EVENT_PUBLISH
        : nextStatus === "cancelled"
          ? AUDIT_ACTIONS.EVENT_CANCEL
          : AUDIT_ACTIONS.EVENT_ARCHIVE;

    await auditLog({
      req,
      action: actionKey,
      targetType: "event",
      targetId: id,
      metadata: { title: event.title, from: event.status, to: nextStatus },
    });
    req.flash("success", `Event "${event.title}" is now ${nextStatus}.`);
    res.redirect(`/admin/events/${id}`);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

function parseAuditFilters(query) {
  return {
    actor: typeof query.actor === "string" ? query.actor.trim() : "",
    action: typeof query.action === "string" ? query.action.trim() : "",
    targetType:
      typeof query.targetType === "string" ? query.targetType.trim() : "",
    from: typeof query.from === "string" ? query.from : "",
    to: typeof query.to === "string" ? query.to : "",
  };
}

export async function showAuditLog(req, res, next) {
  try {
    const filters = parseAuditFilters(req.query);
    const page = Number.isFinite(Number(req.query.page))
      ? Math.max(1, Number(req.query.page))
      : 1;

    const [result, actions, targetTypes] = await Promise.all([
      listAuditLogs({ ...filters, page, limit: 50 }),
      listAuditActions(),
      listAuditTargetTypes(),
    ]);

    result.rows.forEach((row) => {
      row.metadata = redactMetadata(row.metadata);
    });

    res.render("admin/audit-list", {
      title: "Audit log — Admin",
      result,
      filters,
      actions,
      targetTypes,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function showAuditDetail(req, res, next) {
  try {
    const entry = await getAuditLogById(req.params.id);
    if (!entry) {
      req.flash("error", "Audit entry not found.");
      return res.redirect("/admin/audit");
    }
    entry.metadata = redactMetadata(entry.metadata);
    res.render("admin/audit-detail", {
      title: `Audit #${entry.id}`,
      entry,
      layout: "layouts/app",
    });
  } catch (err) {
    next(err);
  }
}

export async function exportAuditCsv(req, res, next) {
  try {
    const filters = parseAuditFilters(req.query);
    const rows = await listAuditLogsForExport(filters, 5000);

    const header = [
      "id",
      "occurred_at",
      "actor_email",
      "action",
      "target_type",
      "target_id",
      "metadata",
    ];
    const lines = [header.map(toCsvCell).join(",")];

    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.occurred_at instanceof Date
            ? r.occurred_at.toISOString()
            : r.occurred_at,
          r.actor_email,
          r.action,
          r.target_type,
          r.target_id,
          redactMetadata(r.metadata),
        ]
          .map(toCsvCell)
          .join(","),
      );
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audit-${stamp}.csv"`,
    );
    res.send(lines.join("\r\n") + "\r\n");
  } catch (err) {
    next(err);
  }
}
