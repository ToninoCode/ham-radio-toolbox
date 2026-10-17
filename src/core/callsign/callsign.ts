import {
  err,
  ok,
  type Brand,
  type DomainError,
  type Result,
} from "@/shared/types";

/**
 * Amateur callsign, normalised (upper case, no spaces) and syntactically
 * valid, optionally with a location prefix and/or an operating suffix:
 * `IZ0ABC`, `IZ0ABC/P`, `HB9/IZ0ABC`, `F/IZ0ABC/M`.
 *
 * Syntax only: whether the callsign is actually issued, and its DXCC entity,
 * are not checked here (no lookup to QRZ or other services; DXCC
 * resolution comes with the country files in M10).
 */
export type Callsign = Brand<string, "Callsign">;

export type CallsignErrorCode =
  | "callsign.empty"
  | "callsign.invalid-characters"
  | "callsign.too-long"
  | "callsign.invalid-format";

export type CallsignError = DomainError<CallsignErrorCode>;

/** Operating condition conveyed by common suffixes. */
export type OperatingCondition =
  "portable" | "mobile" | "maritime-mobile" | "aeronautical-mobile";

export interface CallsignParts {
  readonly callsign: Callsign;
  /** The station's own callsign, without prefix and suffix. */
  readonly base: string;
  /** Location prefix written before the callsign (`HB9` in `HB9/IZ0ABC`). */
  readonly prefix?: string;
  /** Anything after the callsign (`P`, `MM`, `QRP`, `2`, `KH6`…). */
  readonly suffix?: string;
  readonly condition?: OperatingCondition;
}

/**
 * Longest accepted callsign, separators included: above the longest valid
 * combination (4 + 1 + 11 + 1 + 4 = 21), it only rejects garbage early.
 */
export const MAX_CALLSIGN_LENGTH = 24;

/*
 * Base callsign, after ITU RR Art. 19 (19.68, 19.68A): a prefix of one to
 * three characters ending in a letter (I, IZ, 2E, 3DA, VP2E reads as VP + 2),
 * one digit, then a suffix of up to seven characters ending in a letter
 * (four for ordinary licences, longer for special events: II2RAI, OL100TT).
 */
const BASE_CALLSIGN = /^[A-Z0-9]{0,2}[A-Z][0-9][A-Z0-9]{0,6}[A-Z]$/;

/** Location prefix or suffix (`F`, `EA8`, `HB0`, `KH6`, `3D2`): needs a letter. */
const LOCATION_TOKEN = /^(?=[A-Z0-9]*[A-Z])[A-Z0-9]{1,4}$/;

const CONDITIONS: Readonly<Record<string, OperatingCondition>> = {
  P: "portable",
  M: "mobile",
  MM: "maritime-mobile",
  AM: "aeronautical-mobile",
};

/** Suffixes that are not location prefixes: operating designators. */
const DESIGNATORS = new Set(["P", "M", "MM", "AM", "A", "QRP", "QRPP", "LH"]);

const isBase = (token: string) => BASE_CALLSIGN.test(token);
const isLocation = (token: string) => LOCATION_TOKEN.test(token);
const isSuffix = (token: string) =>
  DESIGNATORS.has(token) || /^[0-9]$/.test(token) || isLocation(token);

/**
 * Normalises user input: trims, removes inner whitespace, upper-cases and
 * maps the slashed zero `Ø` (used by some loggers) to `0`.
 */
export function normalizeCallsign(text: string): string {
  return text.replace(/\s+/g, "").toUpperCase().replaceAll("Ø", "0");
}

function split(
  normalized: string,
): Pick<CallsignParts, "base" | "prefix" | "suffix"> | undefined {
  const tokens = normalized.split("/");
  if (tokens.length === 1) {
    const [base = ""] = tokens;
    return isBase(base) ? { base } : undefined;
  }
  if (tokens.length === 2) {
    const [first = "", second = ""] = tokens;
    // A designator or a call-area digit after the callsign: IZ0ABC/P, W1AW/4.
    if ((DESIGNATORS.has(second) || /^[0-9]$/.test(second)) && isBase(first)) {
      return { base: first, suffix: second };
    }
    // Prefix form (CEPT T/R 61-01): HB9/IZ0ABC. When both tokens could be a
    // callsign (VP2E/W1AW), the first one is read as the prefix.
    if (isLocation(first) && isBase(second)) {
      return { prefix: first, base: second };
    }
    // Suffix location form: W1AW/KH6.
    if (isBase(first) && isLocation(second)) {
      return { base: first, suffix: second };
    }
    return undefined;
  }
  if (tokens.length === 3) {
    const [prefix = "", base = "", suffix = ""] = tokens;
    if (isLocation(prefix) && isBase(base) && isSuffix(suffix)) {
      return { prefix, base, suffix };
    }
  }
  return undefined;
}

/** Normalises and validates a callsign, returning its parts. */
export function parseCallsign(
  text: string,
): Result<CallsignParts, CallsignError> {
  const normalized = normalizeCallsign(text);
  if (normalized === "") return err({ code: "callsign.empty" });
  if (!/^[A-Z0-9/]+$/.test(normalized)) {
    return err({ code: "callsign.invalid-characters" });
  }
  if (normalized.length > MAX_CALLSIGN_LENGTH) {
    return err({ code: "callsign.too-long" });
  }
  const parts = split(normalized);
  if (!parts) return err({ code: "callsign.invalid-format" });

  const condition = parts.suffix ? CONDITIONS[parts.suffix] : undefined;
  return ok({
    callsign: normalized as Callsign,
    ...parts,
    ...(condition ? { condition } : {}),
  });
}

/** True for a callsign that is valid and already normalised. */
export function isCallsign(value: unknown): value is Callsign {
  if (typeof value !== "string") return false;
  const result = parseCallsign(value);
  return result.ok && result.value.callsign === value;
}
