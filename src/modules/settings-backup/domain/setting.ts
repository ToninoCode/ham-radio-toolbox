import { z } from "zod";
import { catalogKeySchema, utcDateTimeSchema } from "@/core/validation";

/*
 * Application preferences as key → value (DATABASE.md `settings`). Each key
 * has its own schema and default, declared once with `defineSetting` by the
 * module that owns the preference; the stored value is any JSON value and
 * is validated against the key's schema on every read and write.
 */

export const settingRecordSchema = z.strictObject({
  key: catalogKeySchema,
  value: z.json(),
  updatedAt: utcDateTimeSchema,
});

export type SettingRecord = z.infer<typeof settingRecordSchema>;

/** A preference: catalog key, schema of its value and default value. */
export interface SettingDefinition<T> {
  readonly key: string;
  readonly schema: z.ZodType<T>;
  readonly defaultValue: T;
}

/**
 * Declares a preference. The key must be a catalog key and the default must
 * satisfy the schema: both are programming errors, checked at definition.
 */
export function defineSetting<T>(
  key: string,
  schema: z.ZodType<T>,
  defaultValue: T,
): SettingDefinition<T> {
  if (!catalogKeySchema.safeParse(key).success) {
    throw new Error(`Invalid setting key: ${key}`);
  }
  if (!schema.safeParse(defaultValue).success) {
    throw new Error(`Default value of setting "${key}" fails its schema`);
  }
  return { key, schema, defaultValue };
}
