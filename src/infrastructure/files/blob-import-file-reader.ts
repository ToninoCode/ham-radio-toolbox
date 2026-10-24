import type {
  ImportFileError,
  ImportFileReader,
  TextEncodingName,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";

function unreadable(error: unknown): Result<never, ImportFileError> {
  const cause = error instanceof Error ? error.name : String(error);
  return err({ code: "import.file-unreadable", cause });
}

/**
 * ImportFileReader on the Blob API. A `File` chosen by the user becomes
 * unreadable (`NotReadableError`) if it changes on disk after the choice;
 * that is reported as `import.file-unreadable`. UTF-8 is decoded strictly:
 * a file in another encoding is an error, never silently altered.
 */
export const blobImportFileReader: ImportFileReader = {
  async readHead(file: Blob, maxBytes: number) {
    try {
      const bytes = await file.slice(0, maxBytes).arrayBuffer();
      // Lenient: the slice may cut a multi-byte character at the end.
      return ok(new TextDecoder("utf-8").decode(bytes));
    } catch (error) {
      return unreadable(error);
    }
  },

  async readText(file: Blob, encoding: TextEncodingName) {
    let bytes: ArrayBuffer;
    try {
      bytes = await file.arrayBuffer();
    } catch (error) {
      return unreadable(error);
    }
    try {
      return ok(
        new TextDecoder(encoding, { fatal: encoding === "utf-8" }).decode(
          bytes,
        ),
      );
    } catch {
      return err({ code: "import.encoding-invalid" });
    }
  },
};
