import type { FileSaver } from "@/shared/application";
import { err, ok } from "@/shared/types";

/**
 * Time before the Blob URL of a download is revoked. Revoking it at once
 * can cancel the download in some browsers; the Blob is released after.
 */
export const DOWNLOAD_URL_LIFETIME_MS = 60_000;

/**
 * FileSaver as a download: a temporary `blob:` URL clicked through a
 * hidden `<a download>`. Blob URLs never reach the service worker, so the
 * file is not stored in the Cache Storage (ARCHITECTURE.md § 8).
 */
export function createBrowserFileSaver(target?: Document): FileSaver {
  return {
    save({ blob, fileName }) {
      let url: string | undefined;
      try {
        // Resolved on use: the container is also built outside browsers.
        const doc = target ?? document;
        url = URL.createObjectURL(blob);
        const link = doc.createElement("a");
        link.href = url;
        link.download = fileName;
        link.rel = "noopener";
        link.hidden = true;
        doc.body.append(link);
        link.click();
        link.remove();
        const created = url;
        setTimeout(
          () => URL.revokeObjectURL(created),
          DOWNLOAD_URL_LIFETIME_MS,
        );
        return ok(undefined);
      } catch (error) {
        if (url) URL.revokeObjectURL(url);
        return err({
          code: "file.save-failed",
          cause:
            typeof error === "object" && error !== null && "name" in error
              ? String(error.name)
              : String(error),
        });
      }
    },
  };
}
