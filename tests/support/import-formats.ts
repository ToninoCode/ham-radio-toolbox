import { dataSourceSchema, type DataSource } from "@/core/data-source";
import {
  callsignSchema,
  frequencyHzSchema,
  issueCode,
  utcDateTimeSchema,
} from "@/core/validation";
import type { AppContainer } from "@/app/container";
import type {
  ImportFormat,
  ImportIssue,
  ImportMatch,
  ImportTarget,
  ParsedRecord,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";

/*
 * Synthetic formats and targets that exercise the generic import pipeline
 * (BL-M2-07) with the real repositories. They are test doubles, not
 * importers: ADIF, EiBi, HFCC and Raindrop arrive with their milestones.
 *
 * - "sources": `key;accessMode;datasetVersion` lines → data_sources, keyed
 *   by `key` (duplicates and conflicts against the database).
 * - "qso": `callsign;datetimeOn;frequencyHz;mode;band` lines → qso_logs,
 *   insert only, identity callsign + time within the file.
 */

export function textFile(name: string, text: string) {
  return { name, content: new Blob([text], { type: "text/plain" }) };
}

function lines(text: string): ParsedRecord[] {
  return text
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line, index): ParsedRecord[] => {
      const location = `line ${index + 2}`;
      if (line.trim() === "") return [];
      if (line.startsWith("#"))
        return [{ kind: "ignored", location, code: "test.comment" }];
      return [{ kind: "record", location, data: line.split(";") }];
    });
}

function issues(error: {
  issues: readonly { path: PropertyKey[] }[];
}): ImportIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join("."),
    code: issueCode(issue as never),
    message: "",
  }));
}

export const sourcesFormat: ImportFormat<DataSource> = {
  id: "test-sources",
  kind: "csv",
  maxBytes: 64 * 1024,
  encoding: "utf-8",
  matches: (_file, head) => head.startsWith("#hrt-test-sources"),
  parse(text) {
    if (text.split("\n")[1]?.startsWith("#version 2")) {
      return err({ code: "test.unsupported-version", location: "line 2" });
    }
    return ok({ records: lines(text), datasetVersion: "T1" });
  },
  normalize(data) {
    const [key, accessMode, datasetVersion] = data as string[];
    const parsed = dataSourceSchema.safeParse({
      key,
      accessMode,
      datasetVersion,
    });
    return parsed.success ? ok(parsed.data) : err(issues(parsed.error));
  },
};

/** Target on DataSourceRepository: same key and content → duplicate. */
export function sourcesTarget(
  container: AppContainer,
): ImportTarget<DataSource> {
  const repository = container.repositories.dataSources;
  return {
    identity: (value) => value.key,
    async match(values) {
      const matches: ImportMatch[] = [];
      for (const value of values) {
        const stored = await repository.get(value.key);
        if (!stored.ok) {
          if (stored.error.code !== "persistence.not-found") return stored;
          matches.push({ status: "new" });
          continue;
        }
        const same = JSON.stringify(stored.value) === JSON.stringify(value);
        matches.push({
          status: same ? "duplicate" : "conflict",
          existingId: value.key,
        });
      }
      return ok(matches);
    },
    async write(value) {
      const saved = await repository.save(value);
      return saved.ok ? ok(undefined) : saved;
    },
  };
}

export interface QsoLine {
  readonly callsign: string;
  readonly datetimeOn: string;
  readonly frequencyHz: number;
  readonly mode: string;
  readonly band: string;
}

export const qsoFormat: ImportFormat<QsoLine> = {
  id: "test-qso",
  kind: "adif",
  maxBytes: 64 * 1024,
  encoding: "utf-8",
  matches: (file, head) =>
    file.name.endsWith(".qso") && head.startsWith("#hrt-test-qso"),
  parse: (text) => ok({ records: lines(text) }),
  normalize(data): Result<QsoLine, ImportIssue[]> {
    const [callsign, datetimeOn, frequency, mode = "", band = ""] =
      data as string[];
    const found: ImportIssue[] = [];
    const check = <T>(
      field: string,
      result: { success: boolean; data?: T; error?: unknown },
    ) => {
      if (!result.success) {
        found.push(
          ...issues(result.error as never).map((issue) => ({
            ...issue,
            field,
          })),
        );
      }
      return result.data as T;
    };
    const value = {
      callsign: check<string>("callsign", callsignSchema.safeParse(callsign)),
      datetimeOn: check<string>(
        "datetimeOn",
        utcDateTimeSchema.safeParse(datetimeOn),
      ),
      frequencyHz: check<number>(
        "frequencyHz",
        frequencyHzSchema.safeParse(Number(frequency)),
      ),
      mode,
      band,
    };
    return found.length > 0 ? err(found) : ok(value);
  },
};

/**
 * Insert-only target on QsoLogRepository. `failOn` makes `write` throw for
 * that callsign (an unexpected exception inside the unit of work).
 */
export function qsoTarget(
  container: AppContainer,
  stationProfileId: string,
  options: { readonly failOn?: string } = {},
): ImportTarget<QsoLine> {
  return {
    identity: (value) => `${value.callsign}|${value.datetimeOn}`,
    match: async (values) => ok(values.map(() => ({ status: "new" as const }))),
    async write(value, _decision, { importJobId }) {
      if (value.callsign === options.failOn) throw new TypeError("target bug");
      const created = await container.repositories.qsoLogs.create({
        ...value,
        stationProfileId,
        origin: "adif-import",
        importJobId,
      });
      return created.ok ? ok(undefined) : created;
    },
  };
}
