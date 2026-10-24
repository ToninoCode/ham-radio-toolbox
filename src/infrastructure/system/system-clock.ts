import { fromDate } from "@/core/time";
import type { Clock } from "@/shared/application";

/** Clock on the device time, truncated to the second (UTC). */
export const systemClock: Clock = {
  now() {
    const now = fromDate(new Date());
    if (!now.ok)
      throw new Error(`Device clock out of range: ${now.error.code}`);
    return now.value;
  },
};
