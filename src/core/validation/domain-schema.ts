import { z } from "zod";
import type { DomainError, Result } from "@/shared/types";

/**
 * Wraps a domain parser as a Zod transform, so that every rule lives once,
 * in the domain function, and the schema only adapts it. A domain failure
 * becomes a `custom` issue whose `message` and `params.code` are the stable
 * domain error code (e.g. `callsign.invalid-format`); extra error fields
 * (`field` of SINPO) are kept in `params`. Codes are translated by
 * presentation, never shown as-is (ARCHITECTURE.md § 5.5).
 */
export function domainSchema<In, Out, E extends DomainError<string>>(
  base: z.ZodType<In>,
  parse: (value: In) => Result<Out, E>,
) {
  return base.transform((value, ctx): Out => {
    const result = parse(value);
    if (result.ok) return result.value;
    ctx.addIssue({
      code: "custom",
      message: result.error.code,
      params: { ...result.error },
    });
    return z.NEVER;
  });
}

/**
 * Stable code of a validation issue, for import reports and i18n lookup:
 * the domain code for domain rules, `zod.<code>` for structural issues
 * (`zod.invalid_type`, `zod.too_small`…).
 */
export function issueCode(issue: z.core.$ZodIssue): string {
  if (issue.code === "custom") {
    const code: unknown = issue.params?.["code"];
    if (typeof code === "string") return code;
  }
  return `zod.${issue.code}`;
}
