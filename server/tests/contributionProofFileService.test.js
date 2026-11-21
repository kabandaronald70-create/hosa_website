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
      contributionProofBucket: "contribution-proofs",
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
  uploadContributionProofFile,
  createContributionProofSignedUrl,
  removeContributionProofFile,
  cleanupContributionProofFile,
} from "../src/services/contributionProofFileService.js";

describe("Contribution Proof File Service", () => {
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
        signedUrl: "https://example.com/private-payment-proof",
      },
      error: null,
    });

    mocks.remove.mockResolvedValue({ error: null });

    mocks.fileTypeFromBuffer.mockResolvedValue({
      mime: "image/jpeg",
      ext: "jpg",
    });
  });

  describe("uploadContributionProofFile", () => {
    it("rejects an empty file", async () => {
      await expect(
        uploadContributionProofFile(
          "member-1",
          Buffer.alloc(0),
          "receipt.jpg",
        ),
      ).rejects.toMatchObject({
        status: 400,
        code: "EMPTY_FILE",
      });

      expect(mocks.fileTypeFromBuffer).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("rejects files larger than 5 MB", async () => {
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);

      await expect(
        uploadContributionProofFile(
          "member-1",
          oversizedBuffer,
          "receipt.jpg",
        ),
      ).rejects.toMatchObject({
        status: 413,
        code: "FILE_TOO_LARGE",
      });

      expect(mocks.fileTypeFromBuffer).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
    });

    it.each([
      ["image/jpeg", "jpg"],
      ["image/png", "png"],
      ["image/webp", "webp"],
    ])("accepts genuine %s images", async (mime, extension) => {
      mocks.fileTypeFromBuffer.mockResolvedValue({
        mime,
        ext: extension,
      });

      const buffer = Buffer.from("test image content");

      const result = await uploadContributionProofFile(
        "member-1",
        buffer,
        `receipt.${extension}`,
      );

      expect(result.originalName).toBe(`receipt.${extension}`);

      expect(result.storagePath).toMatch(
        new RegExp(`^member-1/[0-9a-f-]+\\.${extension}$`, "i"),
      );

      expect(mocks.from).toHaveBeenCalledWith("contribution-proofs");

      expect(mocks.upload).toHaveBeenCalledWith(
        result.storagePath,
        buffer,
        {
          contentType: mime,
          cacheControl: "0",
          upsert: false,
        },
      );
    });

    it.each([
      "application/pdf",
      "image/gif",
      "text/plain",
    ])("rejects unsupported detected type %s", async (mime) => {
      mocks.fileTypeFromBuffer.mockResolvedValue({
        mime,
        ext: "unknown",
      });

      await expect(
        uploadContributionProofFile(
          "member-1",
          Buffer.from("test content"),
          "receipt.jpg",
        ),
      ).rejects.toMatchObject({
        status: 400,
        code: "INVALID_FILE_TYPE",
      });

      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("rejects files whose actual type cannot be detected", async () => {
      mocks.fileTypeFromBuffer.mockResolvedValue(undefined);

      await expect(
        uploadContributionProofFile(
          "member-1",
          Buffer.from("not a valid image"),
          "receipt.jpg",
        ),
      ).rejects.toMatchObject({
        status: 400,
        code: "INVALID_FILE_TYPE",
      });

      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("does not trust the original filename for the storage path", async () => {
      const result = await uploadContributionProofFile(
        "member-1",
        Buffer.from("test image"),
        "../../private\r\nreceipt.jpg",
      );

      expect(result.originalName).toBe("privatereceipt.jpg");
      expect(result.storagePath).not.toContain("private");
      expect(result.storagePath).not.toContain("..");
    });

    it("returns a storage error when upload fails", async () => {
      mocks.upload.mockResolvedValue({
        error: new Error("Storage unavailable"),
      });

      await expect(
        uploadContributionProofFile(
          "member-1",
          Buffer.from("test image"),
          "receipt.jpg",
        ),
      ).rejects.toMatchObject({
        status: 502,
        code: "STORAGE_UPLOAD_FAILED",
      });

      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe("createContributionProofSignedUrl", () => {
    it("generates a signed URL with the configured expiry", async () => {
      const result = await createContributionProofSignedUrl(
        "member-1/proof.jpg",
      );

      expect(result).toBe(
        "https://example.com/private-payment-proof",
      );

      expect(mocks.from).toHaveBeenCalledWith("contribution-proofs");

      expect(mocks.createSignedUrl).toHaveBeenCalledWith(
        "member-1/proof.jpg",
        60,
      );
    });

    it("rejects a missing storage path", async () => {
      await expect(
        createContributionProofSignedUrl(null),
      ).rejects.toMatchObject({
        status: 404,
        code: "PAYMENT_PROOF_NOT_FOUND",
      });

      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("handles signed URL generation failures", async () => {
      mocks.createSignedUrl.mockResolvedValue({
        data: null,
        error: new Error("Signed URL unavailable"),
      });

      await expect(
        createContributionProofSignedUrl("member-1/proof.jpg"),
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
        createContributionProofSignedUrl("member-1/proof.jpg"),
      ).rejects.toMatchObject({
        status: 502,
        code: "SIGNED_URL_FAILED",
      });
    });
  });

  describe("removeContributionProofFile", () => {
    it("removes the specified file from private storage", async () => {
      await expect(
        removeContributionProofFile("member-1/proof.jpg"),
      ).resolves.toBeUndefined();

      expect(mocks.from).toHaveBeenCalledWith("contribution-proofs");

      expect(mocks.remove).toHaveBeenCalledWith([
        "member-1/proof.jpg",
      ]);
    });

    it("does nothing when the storage path is missing", async () => {
      await expect(
        removeContributionProofFile(null),
      ).resolves.toBeUndefined();

      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("reports storage deletion failures", async () => {
      mocks.remove.mockResolvedValue({
        error: new Error("Deletion failed"),
      });

      await expect(
        removeContributionProofFile("member-1/proof.jpg"),
      ).rejects.toMatchObject({
        status: 502,
        code: "STORAGE_DELETE_FAILED",
      });

      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe("cleanupContributionProofFile", () => {
    it("does not throw when storage cleanup fails", async () => {
      mocks.remove.mockResolvedValue({
        error: new Error("Cleanup failed"),
      });

      await expect(
        cleanupContributionProofFile("member-1/proof.jpg"),
      ).resolves.toBeUndefined();

      expect(mocks.loggerWarn).toHaveBeenCalled();
    });

    it("does nothing when the storage path is missing", async () => {
      await expect(
        cleanupContributionProofFile(null),
      ).resolves.toBeUndefined();

      expect(mocks.from).not.toHaveBeenCalled();
    });
  });
});