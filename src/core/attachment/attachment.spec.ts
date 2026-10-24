// @vitest-environment node
import { describe, expect, it } from "vitest";
import { issueCode } from "@/core/validation";
import {
  MAX_FILE_NAME_LENGTH,
  attachmentSchema,
  isAllowedMimeType,
  normalizeMimeType,
  sanitizeFileName,
} from ".";

describe("sanitizeFileName", () => {
  it.each([
    ["QSL IZ1ABC.jpg", "QSL IZ1ABC.jpg"],
    ["  spazi   multipli .pdf ", "spazi multipli .pdf"],
    ["C:\\Users\\me\\scan.png", "C__Users_me_scan.png"],
    ["../../etc/passwd", "_.._etc_passwd"],
    ['a<b>c:d"e|f?g*h.txt', "a_b_c_d_e_f_g_h.txt"],
    ["tab\there\u0000.txt", "tab_here_.txt"],
    [".hidden", "hidden"],
    ["file.txt...", "file.txt"],
    ["Cafe\u0301.txt", "Café.txt"], // NFC
  ])("%j → %j", (input, expected) => {
    expect(sanitizeFileName(input)).toEqual({ ok: true, value: expected });
  });

  it.each(["", "   ", "...", "///", "\u0000"])("rejects %j", (input) => {
    expect(sanitizeFileName(input)).toEqual({
      ok: false,
      error: { code: "attachment.file-name-empty" },
    });
  });

  it("shortens long names keeping the extension", () => {
    const result = sanitizeFileName(`${"a".repeat(300)}.flac`);
    expect(result.ok && result.value.length).toBe(MAX_FILE_NAME_LENGTH);
    expect(result.ok && result.value.endsWith("a.flac")).toBe(true);
  });

  it("is idempotent", () => {
    for (const name of ["../x/y.txt", " a .b. ", "Cafe\u0301.txt"]) {
      const once = sanitizeFileName(name);
      if (!once.ok) throw new Error("unexpected");
      expect(sanitizeFileName(once.value)).toEqual(once);
    }
  });
});

describe("content types", () => {
  it("normalises declared types", () => {
    expect(normalizeMimeType(" Image/JPEG ; q=1")).toBe("image/jpeg");
    expect(normalizeMimeType("")).toBe("");
  });

  it.each([
    ["image/jpeg", true],
    ["image/png", true],
    ["audio/ogg", true],
    ["audio/x-wav", true],
    ["application/pdf", true],
    ["text/plain", true],
    ["image/svg+xml", false],
    ["text/html", false],
    ["application/javascript", false],
    ["application/octet-stream", false],
    ["", false],
  ])("%s allowed: %s", (mimeType, allowed) => {
    expect(isAllowedMimeType(mimeType)).toBe(allowed);
  });
});

describe("attachmentSchema", () => {
  const valid = {
    id: "2b7a1b7e-4a3f-4c2d-9e8f-0a1b2c3d4e5f",
    ownerType: "qso",
    ownerId: "3c8b2c8f-5b4a-4d3e-8f9a-1b2c3d4e5f60",
    fileName: "scan.png",
    mimeType: "image/png",
    sizeBytes: 3,
    sha256: "a".repeat(64),
    blob: new Blob(["abc"], { type: "image/png" }),
    createdAt: "2026-10-24T10:00:00Z",
  };

  it("accepts a consistent record", () => {
    expect(attachmentSchema.safeParse(valid).success).toBe(true);
  });

  it("requires the size to match the Blob", () => {
    const result = attachmentSchema.safeParse({ ...valid, sizeBytes: 4 });
    expect(result.error?.issues.map(issueCode)).toEqual([
      "attachment.size-mismatch",
    ]);
  });

  it("has no updatedAt: attachments are immutable", () => {
    const result = attachmentSchema.safeParse({
      ...valid,
      updatedAt: valid.createdAt,
    });
    expect(result.error?.issues.map(issueCode)).toEqual([
      "zod.unrecognized_keys",
    ]);
  });
});
