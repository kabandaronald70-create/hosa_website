import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  query: vi.fn(),
};

let canAccessDocument;
let createDocument;
let listAccessibleDocuments;
let listDocuments;
let updateDocumentAccessLevel;
let DOCUMENT_ACCESS_LEVELS;

beforeAll(async () => {
  vi.doMock("../src/config/db.js", () => db);

  ({
    canAccessDocument,
    createDocument,
    listAccessibleDocuments,
    listDocuments,
    updateDocumentAccessLevel,
    DOCUMENT_ACCESS_LEVELS,
  } = await import("../src/models/documentModel.js"));
});

describe("Document access permissions", () => {
  const superAdminDocument = {
    id: "doc-1",
    access_level: "super_admin_only",
  };

  const leadershipDocument = {
    id: "doc-2",
    access_level: "leadership_only",
  };

  const memberDocument = {
    id: "doc-3",
    access_level: "approved_members",
  };

  it("allows super admins to access every document category", () => {
    const permissions = { isSuperAdmin: true };

    expect(canAccessDocument(superAdminDocument, permissions)).toBe(true);
    expect(canAccessDocument(leadershipDocument, permissions)).toBe(true);
    expect(canAccessDocument(memberDocument, permissions)).toBe(true);
  });

  it("allows current leaders to access leadership documents", () => {
    expect(
      canAccessDocument(leadershipDocument, {
        hasCurrentLeadership: true,
      }),
    ).toBe(true);
  });

  it("denies leaders access to super-admin-only documents", () => {
    expect(
      canAccessDocument(superAdminDocument, {
        hasCurrentLeadership: true,
      }),
    ).toBe(false);
  });

  it("allows approved members to access approved-member documents", () => {
    expect(
      canAccessDocument(memberDocument, {
        isApprovedMember: true,
      }),
    ).toBe(true);
  });

  it("denies approved members access to leadership-only documents", () => {
    expect(
      canAccessDocument(leadershipDocument, {
        isApprovedMember: true,
      }),
    ).toBe(false);
  });

  it("denies ordinary members access to super-admin-only documents", () => {
    expect(
      canAccessDocument(superAdminDocument, {
        isApprovedMember: true,
      }),
    ).toBe(false);
  });

  it("denies access when the document is missing or has an unknown access level", () => {
    expect(canAccessDocument(null, { isSuperAdmin: true })).toBe(false);

    expect(
      canAccessDocument(
        { access_level: "unknown" },
        {
          isSuperAdmin: false,
          isApprovedMember: true,
          hasCurrentLeadership: true,
        },
      ),
    ).toBe(false);
  });
});

describe("Accessible document queries", () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it("queries all documents for a super admin", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: "doc-1" }] });

    await expect(
      listAccessibleDocuments({ isSuperAdmin: true }),
    ).resolves.toEqual([{ id: "doc-1" }]);

    expect(db.query.mock.calls[0][1]).toEqual([true, false, false]);

    const archiveSql = db.query.mock.calls[0][0];
    const selectedColumns = archiveSql
      .split(/FROM\s+documents/i)[0]
      .replace(/^.*SELECT/i, "");

    expect(selectedColumns).toContain("file_name");
    expect(selectedColumns).toContain("access_level");
    expect(selectedColumns).toContain("created_at");
    expect(selectedColumns).not.toContain("file_path");

    expect(db.query.mock.calls[0][0]).toContain(
      "access_level = 'approved_members'",
    );
    expect(db.query.mock.calls[0][0]).toContain(
      "access_level = 'leadership_only'",
    );
  });

  it("queries only approved-member documents for an ordinary approved member", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await listAccessibleDocuments({
      isApprovedMember: true,
    });

    expect(db.query.mock.calls[0][1]).toEqual([false, true, false]);
  });

  it("queries leadership and approved-member documents for a current leader", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await listAccessibleDocuments({
      isApprovedMember: true,
      hasCurrentLeadership: true,
    });

    expect(db.query.mock.calls[0][1]).toEqual([false, true, true]);
  });

  it("does not grant access to any restricted category by default", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await listAccessibleDocuments();

    expect(db.query.mock.calls[0][1]).toEqual([false, false, false]);
  });
});

describe("Super-admin document listing", () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it("retains file_path for document management", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await listDocuments();

    const sql = db.query.mock.calls[0][0];
    const selectedColumns = sql
      .split(/FROM\s+documents/i)[0]
      .replace(/^.*SELECT/i, "");

    expect(selectedColumns).toContain("file_path");
  });
});

describe("Document creation", () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it("defaults newly uploaded documents to super-admin-only", async () => {
    const document = {
      id: "doc-10",
      title: "HOSA Constitution",
      access_level: "super_admin_only",
    };

    db.query.mockResolvedValueOnce({ rows: [document] });

    await expect(
      createDocument({
        title: "HOSA Constitution",
        description: "Official association document",
        fileName: "constitution.pdf",
        filePath: "doc-1-constitution.pdf",
        uploadedBy: "admin-1",
      }),
    ).resolves.toEqual(document);

    expect(db.query.mock.calls[0][1]).toEqual([
      "HOSA Constitution",
      "Official association document",
      "constitution.pdf",
      "doc-1-constitution.pdf",
      "admin-1",
      DOCUMENT_ACCESS_LEVELS.SUPER_ADMIN_ONLY,
    ]);
  });

  it("accepts an explicitly selected valid access level", async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: "doc-11",
          access_level: "approved_members",
        },
      ],
    });

    await createDocument({
      title: "Member Handbook",
      description: null,
      fileName: "handbook.pdf",
      filePath: "doc-1-handbook.pdf",
      uploadedBy: "admin-1",
      accessLevel: DOCUMENT_ACCESS_LEVELS.APPROVED_MEMBERS,
    });

    expect(db.query.mock.calls[0][1][5]).toBe("approved_members");
  });

  it("rejects an invalid access level without querying the database", async () => {
    await expect(
      createDocument({
        title: "Invalid Document",
        fileName: "invalid.pdf",
        filePath: "invalid.pdf",
        uploadedBy: "admin-1",
        accessLevel: "everyone",
      }),
    ).rejects.toThrow("Invalid document access level.");

    expect(db.query).not.toHaveBeenCalled();
  });
});

describe("Document access-level updates", () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it("updates a document to a valid access level", async () => {
    const updatedDocument = {
      id: "doc-20",
      title: "HOSA Constitution",
      access_level: "leadership_only",
    };

    db.query.mockResolvedValueOnce({
      rows: [updatedDocument],
    });

    await expect(
      updateDocumentAccessLevel(
        "doc-20",
        DOCUMENT_ACCESS_LEVELS.LEADERSHIP_ONLY,
      ),
    ).resolves.toEqual(updatedDocument);

    expect(db.query.mock.calls[0][1]).toEqual(["doc-20", "leadership_only"]);

    expect(db.query.mock.calls[0][0]).toContain("UPDATE documents");
    expect(db.query.mock.calls[0][0]).toContain("RETURNING");
  });

  it("rejects an invalid access level without querying the database", async () => {
    await expect(updateDocumentAccessLevel("doc-20", "public")).rejects.toThrow(
      "Invalid document access level.",
    );

    expect(db.query).not.toHaveBeenCalled();
  });

  it("returns null when the document does not exist", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      updateDocumentAccessLevel(
        "missing-document",
        DOCUMENT_ACCESS_LEVELS.APPROVED_MEMBERS,
      ),
    ).resolves.toBeNull();
  });
});
