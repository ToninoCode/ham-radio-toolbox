import type { IdGenerator } from "@/shared/application";

/** UUID v4 from the Web Crypto API (ADR-0005). */
export const cryptoIdGenerator: IdGenerator = {
  newId: () => crypto.randomUUID(),
};
