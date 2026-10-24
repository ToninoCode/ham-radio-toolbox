import {
  DEFAULT_MAX_ATTACHMENT_BYTES,
  attachmentSchema,
  type Attachment,
  type AttachmentMetadata,
  type AttachmentOwnerType,
} from "@/core/attachment";
import {
  conflict,
  invalidInput,
  notFound,
  type AttachmentRepository,
  type DeletionReport,
  type NewAttachment,
  type PersistenceError,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";
import type { AppDatabase } from "../app-database";
import { guard } from "../errors";
import { ATTACHMENT_OWNER_TABLES, SCOPES, recordExists } from "../integrity";
import {
  byCreation,
  parseRecord,
  type RepositoryDeps,
} from "../repository-support";

const TABLE = "attachments";

export interface AttachmentRepositoryOptions {
  /** Per-file limit in bytes (ADR-0009, default 20 MB). */
  readonly maxBytes?: number;
}

function metadataOf(attachment: Attachment): AttachmentMetadata {
  const { blob: _blob, ...metadata } = attachment;
  return metadata;
}

/**
 * Dexie adapter of AttachmentRepository (ADR-0009): owner-scoped
 * deduplication, Blob read only by `getContent`.
 */
export class DexieAttachmentRepository implements AttachmentRepository {
  readonly #db: AppDatabase;
  readonly #deps: RepositoryDeps;
  readonly #maxBytes: number;

  constructor(
    db: AppDatabase,
    deps: RepositoryDeps,
    options: AttachmentRepositoryOptions = {},
  ) {
    this.#db = db;
    this.#deps = deps;
    this.#maxBytes = options.maxBytes ?? DEFAULT_MAX_ATTACHMENT_BYTES;
  }

  create(
    input: NewAttachment,
  ): Promise<Result<AttachmentMetadata, PersistenceError>> {
    return guard(TABLE, async () => {
      const parsed = parseRecord(TABLE, attachmentSchema, {
        ...input,
        sizeBytes: (input.blob as Blob | undefined)?.size,
        id: this.#deps.ids.newId(),
        createdAt: this.#deps.clock.now(),
      });
      if (!parsed.ok) return parsed;
      const attachment = parsed.value;
      if (attachment.sizeBytes > this.#maxBytes) {
        return err(
          invalidInput(TABLE, [
            { path: "sizeBytes", code: "attachment.too-large" },
          ]),
        );
      }

      return this.#db.transaction("rw", SCOPES.attachmentWrite, async () => {
        const ownerTable = ATTACHMENT_OWNER_TABLES[attachment.ownerType];
        if (!ownerTable) {
          return err(
            conflict(
              TABLE,
              "missing-reference",
              "attachment.owner-type-unavailable",
              { key: attachment.ownerId },
            ),
          );
        }
        if (!(await recordExists(this.#db, ownerTable, attachment.ownerId))) {
          return err(
            conflict(TABLE, "missing-reference", "attachment.owner-missing", {
              key: attachment.ownerId,
              related: ownerTable,
            }),
          );
        }
        const same = await this.#db.attachments
          .where("sha256")
          .equals(attachment.sha256)
          .filter(
            (other) =>
              other.ownerType === attachment.ownerType &&
              other.ownerId === attachment.ownerId,
          )
          .first();
        if (same) {
          return err(
            conflict(TABLE, "duplicate", "attachment.same-content", {
              key: same.id,
            }),
          );
        }
        await this.#db.attachments.add(attachment);
        return ok(metadataOf(attachment));
      });
    });
  }

  getMetadata(
    id: string,
  ): Promise<Result<AttachmentMetadata, PersistenceError>> {
    return guard(TABLE, async () => {
      const attachment = await this.#db.attachments.get(id);
      return attachment ? ok(metadataOf(attachment)) : err(notFound(TABLE, id));
    });
  }

  getContent(id: string): Promise<Result<Blob, PersistenceError>> {
    return guard(TABLE, async () => {
      const attachment = await this.#db.attachments.get(id);
      return attachment ? ok(attachment.blob) : err(notFound(TABLE, id));
    });
  }

  listByOwner(
    ownerType: AttachmentOwnerType,
    ownerId: string,
  ): Promise<Result<AttachmentMetadata[], PersistenceError>> {
    return guard(TABLE, async () => {
      const attachments = await this.#db.attachments
        .where("[ownerType+ownerId]")
        .equals([ownerType, ownerId])
        .toArray();
      return ok(attachments.map(metadataOf).sort(byCreation));
    });
  }

  delete(id: string): Promise<Result<DeletionReport, PersistenceError>> {
    return guard(TABLE, () =>
      this.#db.transaction("rw", [this.#db.attachments], async () => {
        if (!(await recordExists(this.#db, TABLE, id))) {
          return err(notFound(TABLE, id));
        }
        await this.#db.attachments.delete(id);
        return ok({ [TABLE]: 1 });
      }),
    );
  }
}
