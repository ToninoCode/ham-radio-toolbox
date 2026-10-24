import { z } from "zod";
import { err, ok, type DomainError, type Result } from "@/shared/types";
import {
  addDomainIssue,
  domainSchema,
  sha256HexSchema,
  utcDateTimeSchema,
  uuidSchema,
} from "@/core/validation";

/*
 * Attachments stored as Blobs in IndexedDB (ADR-0009, DATABASE.md
 * `attachments`). Every row belongs to exactly one owner record: equal
 * content on two owners is two rows, so deleting one owner never removes the
 * file of the other.
 */

/** Owner kinds. `resource` has no table before schema v5 (M9). */
export const ATTACHMENT_OWNER_TYPES = [
  "qso",
  "swl_reception",
  "qsl",
  "resource",
] as const;
export type AttachmentOwnerType = (typeof ATTACHMENT_OWNER_TYPES)[number];

/** Default per-file limit (ADR-0009): 20 MB. */
export const DEFAULT_MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

/** Longest stored file name, in UTF-16 code units (common FS limit). */
export const MAX_FILE_NAME_LENGTH = 255;

export type AttachmentErrorCode =
  | "attachment.file-name-empty"
  | "attachment.mime-type-not-allowed"
  | "attachment.size-mismatch"
  | "attachment.too-large";

export type AttachmentError = DomainError<AttachmentErrorCode>;

// Control characters, path separators and characters reserved on Windows.
// eslint-disable-next-line no-control-regex
const UNSAFE_FILE_NAME_CHARS = /[\u0000-\u001f\u007f<>:"/\\|?*]/g;

/**
 * Makes a user-supplied file name safe to store and to offer again as a
 * download name: Unicode NFC, unsafe characters replaced by `_`, no leading
 * or trailing dots and spaces, at most 255 characters with the extension
 * kept. A name with nothing left is rejected.
 */
export function sanitizeFileName(
  name: string,
): Result<string, AttachmentError> {
  const cleaned = name
    .normalize("NFC")
    .replace(UNSAFE_FILE_NAME_CHARS, "_")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "");
  if (cleaned === "" || /^_+$/.test(cleaned)) {
    return err({ code: "attachment.file-name-empty" });
  }
  if (cleaned.length <= MAX_FILE_NAME_LENGTH) return ok(cleaned);

  const dot = cleaned.lastIndexOf(".");
  const extension =
    dot > 0 && cleaned.length - dot <= 16 ? cleaned.slice(dot) : "";
  const stem = cleaned.slice(0, MAX_FILE_NAME_LENGTH - extension.length);
  return ok(`${stem.replace(/[\s.]+$/, "")}${extension}`);
}

/**
 * Allowed content types (ADR-0009: images, audio, PDF, text), compared on
 * the media type without parameters, in lower case. SVG is excluded: it can
 * carry scripts. The type is the one declared by the browser for the file;
 * checking the actual content is still open.
 *
 * TODO(M3): fix the precise list and the content check with the first
 * module that uses attachments (ADR-0009, question 2).
 */
export function isAllowedMimeType(mimeType: string): boolean {
  if (mimeType === "image/svg+xml") return false;
  return (
    /^image\/[a-z0-9.+-]+$/.test(mimeType) ||
    /^audio\/[a-z0-9.+-]+$/.test(mimeType) ||
    mimeType === "application/pdf" ||
    mimeType === "text/plain"
  );
}

/** Media type without parameters, lower case (`Text/Plain; charset=x`). */
export function normalizeMimeType(mimeType: string): string {
  return (mimeType.split(";")[0] ?? "").trim().toLowerCase();
}

export const attachmentOwnerTypeSchema = z.enum(ATTACHMENT_OWNER_TYPES);

export const fileNameSchema = domainSchema(z.string(), sanitizeFileName);

export const mimeTypeSchema = z
  .string()
  .transform(normalizeMimeType)
  .refine(isAllowedMimeType, {
    message: "attachment.mime-type-not-allowed",
    params: { code: "attachment.mime-type-not-allowed" },
  });

const attachmentMetadataFields = {
  id: uuidSchema,
  ownerType: attachmentOwnerTypeSchema,
  ownerId: uuidSchema,
  fileName: fileNameSchema,
  mimeType: mimeTypeSchema,
  sizeBytes: z.number().int().nonnegative(),
  sha256: sha256HexSchema,
  createdAt: utcDateTimeSchema,
};

/**
 * Persisted attachment. Attachments are immutable (a new file is a new
 * row), hence `createdAt` only. `sizeBytes` must match the Blob.
 */
export const attachmentSchema = z
  .strictObject({ ...attachmentMetadataFields, blob: z.instanceof(Blob) })
  .superRefine((value, ctx) => {
    if (value.blob.size !== value.sizeBytes) {
      addDomainIssue(ctx, ["sizeBytes"], "attachment.size-mismatch");
    }
  });

export type Attachment = z.infer<typeof attachmentSchema>;

/** Attachment without its content: what lists return (ADR-0009). */
export type AttachmentMetadata = Omit<Attachment, "blob">;
