import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = {
  getDocumentById: vi.fn(),
  canAccessDocument: vi.fn((document, permissions = {}) => {
    if (!document) return false;
    if (permissions.isSuperAdmin) return true;

    switch (document.access_level) {
      case "super_admin_only":
        return false;
      case "leadership_only":
        return Boolean(permissions.hasCurrentLeadership);
      case "approved_members":
        return Boolean(permissions.isApprovedMember);
      default:
        return false;
    }
  }),
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
  deleteDocument: vi.fn(),
  updateDocumentAccessLevel: vi.fn(),
  storageDownload: vi.fn(),
  storageFrom: vi.fn(),
  uploadDocumentToStorage: vi.fn(),
  auditLog: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
};

let viewDocumentFile;
let downloadDocumentFile;
let DOCUMENT_ACCESS_LEVELS;
let document;

beforeAll(async () => {
  vi.doMock("../src/models/documentModel.js", () => ({
    DOCUMENT_ACCESS_LEVELS: {
      SUPER_ADMIN_ONLY: "super_admin_only",
      LEADERSHIP_ONLY: "leadership_only",
      APPROVED_MEMBERS: "approved_members",
    },
    getDocumentById: mocks.getDocumentById,
    canAccessDocument: mocks.canAccessDocument,
    listDocuments: mocks.listDocuments,
    createDocument: mocks.createDocument,
    deleteDocument: mocks.deleteDocument,
    updateDocumentAccessLevel: mocks.updateDocumentAccessLevel,
  }));

  vi.doMock("../src/config/supabase.js", () => ({
    supabase: {
      storage: {
        from: mocks.storageFrom,
      },
    },
  }));

  vi.doMock("../src/services/documentService.js", () => ({
    uploadDocumentToStorage: mocks.uploadDocumentToStorage,
  }));

  vi.doMock("../src/services/auditService.js", () => ({
    auditLog: mocks.auditLog,
  }));

  vi.doMock("../src/utils/logger.js", () => ({
    logger: {
      error: mocks.loggerError,
      warn: mocks.loggerWarn,
      info: mocks.loggerInfo,
    },
  }));

  ({
    viewDocumentFile,
    downloadDocumentFile,
  } = await import("../src/controllers/documentController.js"));

  ({ DOCUMENT_ACCESS_LEVELS } = await import(
    "../src/models/documentModel.js"
  ));

  document = {
    id: "document-123",
    title: "HOSA Constitution",
    file_name: "HOSA Constitution.pdf",
    file_path: "documents/hosa-constitution.pdf",
    access_level: DOCUMENT_ACCESS_LEVELS.APPROVED_MEMBERS,
  };
});

function createMocks({
  userRoles = [],
  membershipApproved = false,
  leadershipRoles = [],
} = {}) {
  const req = {
    params: { id: "document-123" },
    userRoles,
    leadershipRoles,
    user: {
      id: "user-123",
      membership_approved_at: membershipApproved
        ? new Date("2026-01-01")
        : null,
    },
  };

  const res = {
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };

  return { req, res, next: vi.fn() };
}

describe("Document Controller Access and Downloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.storageFrom.mockReturnValue({
      download: mocks.storageDownload,
    });

    mocks.storageDownload.mockResolvedValue({
      data: {
        type: "application/pdf",
        arrayBuffer: async () => Buffer.from("PDF test content"),
      },
      error: null,
    });
  });

  it("allows a super admin to access a super-admin-only document", async () => {
    const { req, res, next } = createMocks({
      userRoles: ["super_admin"],
    });

    mocks.getDocumentById.mockResolvedValueOnce({
      ...document,
      access_level: DOCUMENT_ACCESS_LEVELS.SUPER_ADMIN_ONLY,
    });

    await viewDocumentFile(req, res, next);

    expect(mocks.getDocumentById).toHaveBeenCalledWith("document-123");
    expect(mocks.storageFrom).toHaveBeenCalledWith("hosa-documents");
    expect(mocks.storageDownload).toHaveBeenCalledWith(document.file_path);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        "Cache-Control": "private, no-store",
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": expect.stringContaining("inline;"),
      }),
    );

    expect(res.send).toHaveBeenCalledWith(
      Buffer.from("PDF test content"),
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("allows current leadership without membership approval", async () => {
    const { req, res, next } = createMocks({
      leadershipRoles: ["Chairperson"],
    });

    mocks.getDocumentById.mockResolvedValueOnce({
      ...document,
      access_level: DOCUMENT_ACCESS_LEVELS.LEADERSHIP_ONLY,
    });

    await downloadDocumentFile(req, res, next);

    expect(mocks.storageDownload).toHaveBeenCalledWith(document.file_path);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        "Content-Disposition": expect.stringContaining("attachment;"),
      }),
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("allows approved members to access approved-member documents", async () => {
    const { req, res, next } = createMocks({
      membershipApproved: true,
    });

    mocks.getDocumentById.mockResolvedValueOnce(document);

    await downloadDocumentFile(req, res, next);

    expect(mocks.storageDownload).toHaveBeenCalledWith(document.file_path);
    expect(res.send).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it("denies unapproved members access to approved-member documents", async () => {
    const { req, res, next } = createMocks();

    mocks.getDocumentById.mockResolvedValueOnce(document);

    await downloadDocumentFile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.type).toHaveBeenCalledWith("text/plain");
    expect(res.send).toHaveBeenCalledWith(
      "You are not authorized to access this document.",
    );

    expect(mocks.storageDownload).not.toHaveBeenCalled();
    expect(mocks.storageFrom).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("denies approved members access to super-admin-only documents", async () => {
    const { req, res, next } = createMocks({
      membershipApproved: true,
    });

    mocks.getDocumentById.mockResolvedValueOnce({
      ...document,
      access_level: DOCUMENT_ACCESS_LEVELS.SUPER_ADMIN_ONLY,
    });

    await viewDocumentFile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.storageDownload).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("denies ordinary members access to leadership-only documents", async () => {
    const { req, res, next } = createMocks({
      membershipApproved: true,
    });

    mocks.getDocumentById.mockResolvedValueOnce({
      ...document,
      access_level: DOCUMENT_ACCESS_LEVELS.LEADERSHIP_ONLY,
    });

    await downloadDocumentFile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.storageDownload).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 when the document does not exist", async () => {
    const { req, res, next } = createMocks({
      userRoles: ["super_admin"],
    });

    mocks.getDocumentById.mockResolvedValueOnce(null);

    await downloadDocumentFile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.type).toHaveBeenCalledWith("text/plain");
    expect(res.send).toHaveBeenCalledWith("Document not found.");

    expect(mocks.storageDownload).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 when the document has no storage file path", async () => {
    const { req, res, next } = createMocks({
      userRoles: ["super_admin"],
    });

    mocks.getDocumentById.mockResolvedValueOnce({
      ...document,
      file_path: null,
    });

    await downloadDocumentFile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.storageDownload).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("passes document lookup errors to the error handler", async () => {
    const { req, res, next } = createMocks();
    const error = new Error("Database unavailable");

    mocks.getDocumentById.mockRejectedValueOnce(error);

    await downloadDocumentFile(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(mocks.storageDownload).not.toHaveBeenCalled();
  });

  it("passes storage download errors to the error handler", async () => {
    const { req, res, next } = createMocks({
      userRoles: ["super_admin"],
    });

    mocks.getDocumentById.mockResolvedValueOnce({
      ...document,
      access_level: DOCUMENT_ACCESS_LEVELS.SUPER_ADMIN_ONLY,
    });

    mocks.storageDownload.mockResolvedValueOnce({
      data: null,
      error: { message: "Storage unavailable" },
    });

    await downloadDocumentFile(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Document storage download failed: Storage unavailable",
      }),
    );
  });
});
