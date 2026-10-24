import type {
  AttachmentMetadata,
  AttachmentOwnerType,
} from "@/core/attachment";
import type { Result } from "@/shared/types";
import type { PersistenceError } from "./persistence-error";
import type { DeletionReport } from "./repository";

/**
 * A file to attach. `sha256` is computed beforehand with `ContentHasher`
 * (outside any transaction); `sizeBytes` is taken from the Blob.
 */
export interface NewAttachment {
  readonly ownerType: AttachmentOwnerType;
  readonly ownerId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly blob: Blob;
  readonly sha256: string;
}

/**
 * Attachments of QSO, SWL receptions and QSL (ADR-0009). Metadata and
 * content are read separately: lists never return Blobs.
 *
 * Rules: the owner must exist (`conflict/missing-reference`); the same
 * content (`sha256`) cannot be attached twice to the same owner
 * (`conflict/duplicate`, `key` = existing attachment); size within the
 * configured limit (`invalid-input`, `attachment.too-large`). Attachments of
 * an owner are deleted with it (owner repositories, DATABASE.md § 6).
 */
export interface AttachmentRepository {
  create(
    input: NewAttachment,
  ): Promise<Result<AttachmentMetadata, PersistenceError>>;
  getMetadata(
    id: string,
  ): Promise<Result<AttachmentMetadata, PersistenceError>>;
  /** Content of one attachment. */
  getContent(id: string): Promise<Result<Blob, PersistenceError>>;
  /** Attachments of one owner, oldest first. */
  listByOwner(
    ownerType: AttachmentOwnerType,
    ownerId: string,
  ): Promise<Result<AttachmentMetadata[], PersistenceError>>;
  delete(id: string): Promise<Result<DeletionReport, PersistenceError>>;
}
