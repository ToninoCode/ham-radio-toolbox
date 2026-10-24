import { expect } from "vitest";
import type { AppContainer } from "@/app/container";
import type { QsoLogDraft } from "@/modules/ham-logbook";
import type { QslRecordDraft } from "@/modules/qsl-manager";
import type { StationProfileDraft } from "@/modules/settings-backup";
import type { NewSwlReception } from "@/modules/swl-logbook";
import type { NewAttachment } from "@/shared/application";
import type { Result } from "@/shared/types";

/*
 * Valid drafts for integration tests. Values are synthetic (no real log):
 * callsigns use the I/IZ prefixes with invented suffixes.
 */

/** Value of an `ok` result; fails the test with the error otherwise. */
export function expectOk<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    expect.fail(`expected ok, got ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Error of an `err` result; fails the test otherwise. */
export function expectErr<T, E>(result: Result<T, E>): E {
  if (result.ok)
    expect.fail(`expected err, got ${JSON.stringify(result.value)}`);
  return result.error;
}

export function stationProfileDraft(
  overrides: Partial<StationProfileDraft> = {},
): StationProfileDraft {
  return {
    name: "Casa",
    kind: "ham",
    callsign: "iz1abc",
    locator: "jn45dl",
    ...overrides,
  };
}

export function qsoDraft(
  stationProfileId: string,
  overrides: Partial<QsoLogDraft> = {},
): QsoLogDraft {
  return {
    stationProfileId,
    callsign: "i2xyz",
    datetimeOn: "2026-10-24T13:21:00Z",
    frequencyHz: 14_074_000,
    band: "20m",
    mode: "ft8",
    rstSent: "-10",
    rstRcvd: "-12",
    origin: "manual",
    ...overrides,
  };
}

export function receptionInput(
  stationProfileId: string,
  overrides: Partial<NewSwlReception["reception"]> = {},
  /** `null` for a reception without details. */
  details: NewSwlReception["details"] | null = {
    category: "broadcast",
    data: { programme: "Notiziario", qslRequested: true },
  },
): NewSwlReception {
  return {
    reception: {
      stationProfileId,
      category: "broadcast",
      datetimeStart: "2026-10-24T18:00:00Z",
      frequencyHz: 6_070_000,
      modulation: "am",
      stationName: "Test Radio",
      sinpo: "45444",
      ...overrides,
    },
    ...(details ? { details } : {}),
  };
}

export function qslDraft(
  subjectType: "qso" | "swl",
  subjectId: string,
  overrides: Partial<QslRecordDraft> = {},
): QslRecordDraft {
  return {
    subjectType,
    subjectId,
    channel: "paper",
    status: "pending",
    origin: "manual",
    ...overrides,
  };
}

/** Attachment with a text Blob; `sha256` must be the content's hash. */
export function attachmentInput(
  ownerType: NewAttachment["ownerType"],
  ownerId: string,
  content: string,
  sha256: string,
  overrides: Partial<NewAttachment> = {},
): NewAttachment {
  return {
    ownerType,
    ownerId,
    fileName: "nota.txt",
    mimeType: "text/plain",
    blob: new Blob([content], { type: "text/plain" }),
    sha256,
    ...overrides,
  };
}

/** A profile, a QSO and a reception to hang related records on. */
export async function seedOwners(container: AppContainer) {
  const { repositories } = container;
  const profile = expectOk(
    await repositories.stationProfiles.create(stationProfileDraft()),
  );
  const qso = expectOk(await repositories.qsoLogs.create(qsoDraft(profile.id)));
  const reception = expectOk(
    await repositories.swlReceptions.create(receptionInput(profile.id)),
  ).reception;
  return { profile, qso, reception };
}
