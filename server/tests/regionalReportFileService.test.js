import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
  fileTypeFromBuffer: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("../src/config/supabase.js", () => ({
  supabase: {
    storage: {
      from: mocks.from,
    },
  },
}));

vi.mock("../src/config/env.js", () => ({
  env: {
    supabase: {
      regionalReportBucket: "regional-reports",
      signedUrlTtlSeconds: 60,
    },
  },
}));

vi.mock("file-type", () => ({
  fileTypeFromBuffer: mocks.fileTypeFromBuffer,
}));

vi.mock("../src/utils/logger.js", () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  },
}));

import {
  uploadRegionalReportFile,
  createRegionalReportSignedUrl,
  removeRegionalReportFile,
  cleanupRegionalReportFile,
} from "../src/services/regionalReportFileService.js";

describe("Regional Report File Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.from.mockReturnValue({
      upload: mocks.upload,
      createSignedUrl: mocks.createSignedUrl,
      remove: mocks.remove,
    });

    mocks.upload.mockResolvedValue({ error: null });

    mocks.createSignedUrl.mockResolvedValue({
      data: {
        signedUrl: "https://example.com/private-report",
      },
      error: null,
    });

    mocks.remove.mockResolvedValue({ error: null });

    mocks.fileTypeFromBuffer.mockResolvedValue({
      mime: "application/pdf",
      ext: "pdf",
    });
  });

  describe("uploadRegionalReportFile", () => {
    it("rejects an empty file", async () => {
      await expect(
        uploadRegionalReportFile("officer-1", Buffer.alloc(0), "report.pdf"),
      ).rejects.toMatchObject({
        status: 400,
        code: "EMPTY_FILE",
      });

      expect(mocks.fileTypeFromBuffer).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("rejects files larger than 10 MB", async () => {
      const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);

      await expect(
        uploadRegionalReportFile(
          "officer-1",
          oversizedBuffer,
          "large-report.pdf",
        ),
      ).rejects.toMatchObject({
        status: 413,
        code: "FILE_TOO_LARGE",
      });

      expect(mocks.fileTypeFromBuffer).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("rejects files that are not detected as PDFs", async () => {
      mocks.fileTypeFromBuffer.mockResolvedValue({
        mime: "image/png",
        ext: "png",
      });

      await expect(
        uploadRegionalReportFile(
          "officer-1",
          Buffer.from("not a PDF"),
          "report.pdf",
        ),
      ).rejects.toMatchObject({
        status: 400,
        code: "INVALID_FILE_TYPE",
      });

      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("rejects files whose type cannot be detected", async () => {
      mocks.fileTypeFromBuffer.mockResolvedValue(undefined);

      await expect(
        uploadRegionalReportFile(
          "officer-1",
          Buffer.from("unknown file"),
          "report.pdf",
        ),
      ).rejects.toMatchObject({
        status: 400,
        code: "INVALID_FILE_TYPE",
      });

      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("uploads a valid PDF to the private regional reports bucket", async () => {
      const buffer = Buffer.from("%PDF-1.7 test document");

      const result = await uploadRegionalReportFile(
        "officer-1",
        buffer,
        "monthly-report.pdf",
      );

      expect(result.originalName).toBe("monthly-report.pdf");

      expect(result.storagePath).toMatch(/^officer-1\/[0-9a-f-]+\.pdf$/i);

      expect(mocks.from).toHaveBeenCalledWith("regional-reports");

      expect(mocks.upload).toHaveBeenCalledWith(result.storagePath, buffer, {
        contentType: "application/pdf",
        cacheControl: "0",
        upsert: false,
      });
    });

    it("sanitizes the original filename before returning it", async () => {
      const result = await uploadRegionalReportFile(
        "officer-1",
        Buffer.from("%PDF-1.7 test document"),
        "../../monthly\r\nreport.pdf",
      );

      expect(result.originalName).toBe("monthlyreport.pdf");

      expect(result.storagePath).not.toContain("monthly");
      expect(result.storagePath).not.toContain("..");
    });

    it("returns a storage error when the upload fails", async () => {
      mocks.upload.mockResolvedValue({
        error: new Error("Storage unavailable"),
      });

      await expect(
        uploadRegionalReportFile(
          "officer-1",
          Buffer.from("%PDF-1.7 test document"),
          "report.pdf",
        ),
      ).rejects.toMatchObject({
        status: 502,
        code: "STORAGE_UPLOAD_FAILED",
      });

      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe("createRegionalReportSignedUrl", () => {
    it("generates a signed URL with the configured expiry", async () => {
      const result = await createRegionalReportSignedUrl(
        "officer-1/report.pdf",
      );

      expect(result).toBe("https://example.com/private-report");

      expect(mocks.from).toHaveBeenCalledWith("regional-reports");

      expect(mocks.createSignedUrl).toHaveBeenCalledWith(
        "officer-1/report.pdf",
        60,
      );
    });

    it("rejects a missing storage path", async () => {
      await expect(createRegionalReportSignedUrl(null)).rejects.toMatchObject({
        status: 404,
        code: "ATTACHMENT_NOT_FOUND",
      });

      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("handles signed URL generation failures", async () => {
      mocks.createSignedUrl.mockResolvedValue({
        data: null,
        error: new Error("Signed URL unavailable"),
      });

      await expect(
        createRegionalReportSignedUrl("officer-1/report.pdf"),
      ).rejects.toMatchObject({
        status: 502,
        code: "SIGNED_URL_FAILED",
      });

      expect(mocks.loggerError).toHaveBeenCalled();
    });

    it("rejects a response without a signed URL", async () => {
      mocks.createSignedUrl.mockResolvedValue({
        data: {},
        error: null,
      });

      await expect(
        createRegionalReportSignedUrl("officer-1/report.pdf"),
      ).rejects.toMatchObject({
        status: 502,
        code: "SIGNED_URL_FAILED",
      });
    });
  });

  describe("removeRegionalReportFile", () => {
    it("removes the specified file from private storage", async () => {
      await expect(
        removeRegionalReportFile("officer-1/report.pdf"),
      ).resolves.toBeUndefined();

      expect(mocks.from).toHaveBeenCalledWith("regional-reports");

      expect(mocks.remove).toHaveBeenCalledWith(["officer-1/report.pdf"]);
    });

    it("does nothing when the storage path is missing", async () => {
      await expect(removeRegionalReportFile(null)).resolves.toBeUndefined();

      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("reports storage deletion failures", async () => {
      mocks.remove.mockResolvedValue({
        error: new Error("Deletion failed"),
      });

      await expect(
        removeRegionalReportFile("officer-1/report.pdf"),
      ).rejects.toMatchObject({
        status: 502,
        code: "STORAGE_DELETE_FAILED",
      });

      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe("cleanupRegionalReportFile", () => {
    it("does not throw when storage cleanup fails", async () => {
      mocks.remove.mockResolvedValue({
        error: new Error("Cleanup failed"),
      });

      await expect(
        cleanupRegionalReportFile("officer-1/report.pdf"),
      ).resolves.toBeUndefined();

      expect(mocks.loggerWarn).toHaveBeenCalled();
    });

    it("does nothing when the storage path is missing", async () => {
      await expect(cleanupRegionalReportFile(null)).resolves.toBeUndefined();

      expect(mocks.from).not.toHaveBeenCalled();
    });
  });
});
