import { CATALOGS, DEFAULT_LOCALE } from "./catalogs";
import { hasMessage } from "./translate";
import type { ParamValue } from "./types";
import { t } from "./use-i18n";

/*
 * Messages for stable technical codes (ARCHITECTURE.md § 5.5): error codes
 * of the use cases (`backup.checksum-mismatch`, `persistence.quota-exceeded`),
 * validation issue codes (`callsign.invalid-format`, `zod.too_big`) and
 * conflict rules (`station-profile.referenced`). Codes are never the main
 * text shown to the user: every lookup falls back to a generic message, and
 * the code may only appear as a secondary technical detail.
 *
 * Catalog layout: error `<area>.<name>` → `<area>.errors.<name>`; issue
 * `<code>` → `validation.<code>`; rule `<rule>` → `persistence.rules.<rule>`.
 */

type DynamicTranslate = (
  key: string,
  params?: Readonly<Record<string, ParamValue>>,
) => string;

const translate = t as unknown as DynamicTranslate;
const catalog = CATALOGS[DEFAULT_LOCALE];

/** Catalog key of an error code, e.g. `backup.errors.checksum-mismatch`. */
export function errorKey(code: string): string {
  const dot = code.indexOf(".");
  return dot < 0
    ? `errors.${code}`
    : `${code.slice(0, dot)}.errors.${code.slice(dot + 1)}`;
}

/** Whether an error code has its own message. */
export function hasErrorMessage(code: string): boolean {
  return hasMessage(catalog, errorKey(code));
}

/** Message of an error code (generic message for unknown codes). */
export function errorMessage(
  code: string,
  params?: Readonly<Record<string, ParamValue>>,
): string {
  const key = errorKey(code);
  return hasMessage(catalog, key)
    ? translate(key, params)
    : translate("errors.unknown");
}

/** Whether a validation issue code has its own message. */
export function hasIssueMessage(code: string): boolean {
  return hasMessage(catalog, `validation.${code}`);
}

/** Message of a validation issue code. */
export function issueMessage(code: string): string {
  const key = `validation.${code}`;
  return hasMessage(catalog, key)
    ? translate(key)
    : translate("validation.generic");
}

/** Whether a conflict rule has its own message. */
export function hasRuleMessage(rule: string): boolean {
  return hasMessage(catalog, `persistence.rules.${rule}`);
}

/** Message of a conflict rule (generic conflict for unknown rules). */
export function ruleMessage(rule: string): string {
  const key = `persistence.rules.${rule}`;
  return hasMessage(catalog, key)
    ? translate(key)
    : translate("persistence.errors.conflict");
}

/** Message of a code found in a report: an issue, a rule or an error. */
export function reportMessage(code: string): string {
  if (hasIssueMessage(code)) return issueMessage(code);
  if (hasRuleMessage(code)) return ruleMessage(code);
  if (hasErrorMessage(code)) return errorMessage(code);
  return translate("validation.generic");
}

/** The fields of a PersistenceError that select its message. */
export interface PersistenceErrorLike {
  readonly code: string;
  readonly reason?: string;
  readonly rule?: string;
}

/**
 * Message of a persistence error: the reason of `unavailable` and the rule
 * of `conflict` are more specific than the code.
 */
export function persistenceMessage(error: PersistenceErrorLike): string {
  if (error.code === "persistence.unavailable" && error.reason) {
    const key = `persistence.unavailable.${error.reason}`;
    if (hasMessage(catalog, key)) return translate(key);
  }
  if (error.code === "persistence.conflict" && error.rule) {
    return ruleMessage(error.rule);
  }
  return errorMessage(error.code);
}

/** Secondary technical detail: code plus reason or rule, never the main text. */
export function technicalDetail(error: PersistenceErrorLike): string {
  const extra = error.reason ?? error.rule;
  return translate("format.technicalCode", {
    code: extra ? `${error.code} (${extra})` : error.code,
  });
}
