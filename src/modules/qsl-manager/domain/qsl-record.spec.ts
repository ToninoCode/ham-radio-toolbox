// @vitest-environment node
import { describe, expect, it } from "vitest";
import { issueCode } from "@/core/validation";
import { qslRecordSchema } from "./qsl-record";

const valid = {
  id: "2b7a1b7e-4a3f-4c2d-9e8f-0a1b2c3d4e5f",
  subjectType: "qso",
  subjectId: "3c8b2c8f-5b4a-4d3e-8f9a-1b2c3d4e5f60",
  channel: "paper",
  via: "manager",
  managerCallsign: "w3hnk",
  status: "requested",
  requestedAt: "2026-10-24T10:00:00+02:00",
  origin: "manual",
  createdAt: "2026-10-24T10:00:00Z",
  updatedAt: "2026-10-24T10:00:00Z",
};

describe("qslRecordSchema", () => {
  it("normalises callsign and dates, and is idempotent", () => {
    const record = qslRecordSchema.parse(valid);
    expect(record).toMatchObject({
      managerCallsign: "W3HNK",
      requestedAt: "2026-10-24T08:00:00Z",
    });
    expect(qslRecordSchema.parse(record)).toEqual(record);
  });

  it.each([
    ["subjectType", "satellite"],
    ["channel", "fax"],
    ["status", "lost"],
    ["via", "pigeon"],
  ])("rejects an unknown %s", (field, value) => {
    expect(
      qslRecordSchema
        .safeParse({ ...valid, [field]: value })
        .error?.issues.map(issueCode),
    ).toEqual(["zod.invalid_value"]);
  });
});
