// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../../support/database";
import {
  expectErr,
  expectOk,
  qsoDraft,
  stationProfileDraft,
} from "../../support/records";

async function setup() {
  const test = createTestDatabase();
  const { qsoLogs, stationProfiles } = test.container.repositories;
  const profile = expectOk(await stationProfiles.create(stationProfileDraft()));
  return { test, qsoLogs, stationProfiles, profile };
}

describe("QSO: create and read", () => {
  it("stores the canonical record (callsign, mode, locator, Hz, UTC)", async () => {
    const { qsoLogs, profile } = await setup();
    const qso = expectOk(
      await qsoLogs.create(
        qsoDraft(profile.id, {
          callsign: " ik0aaa/p ",
          mode: "ssb",
          submode: "usb",
          band: "20M",
          rstSent: "59",
          rstRcvd: "57",
          frequencyHz: 14_200_000,
          gridsquare: "jn61FW",
          datetimeOn: "2026-10-24T15:21:00+02:00",
          adifExtra: { MY_RIG: "IC-705" },
        }),
      ),
    );
    expect(qso).toMatchObject({
      callsign: "IK0AAA/P",
      mode: "SSB",
      submode: "USB",
      band: "20m",
      frequencyHz: 14_200_000,
      gridsquare: "JN61fw",
      datetimeOn: "2026-10-24T13:21:00Z",
      adifExtra: { MY_RIG: "IC-705" },
      stationProfileId: profile.id,
    });
    expect(expectOk(await qsoLogs.get(qso.id))).toEqual(qso);
    expect(expectOk(await qsoLogs.count())).toBe(1);
  });

  it("rejects invalid values with stable codes", async () => {
    const { qsoLogs, test, profile } = await setup();
    const error = expectErr(
      await qsoLogs.create(
        qsoDraft(profile.id, {
          callsign: "123",
          frequencyHz: 14_074_000.5,
          datetimeOn: "2026-10-24T13:21:00",
          rstSent: "99",
        }),
      ),
    );
    expect(
      error.code === "persistence.invalid-input" &&
        error.issues.map((issue) => `${issue.path}:${issue.code}`),
    ).toEqual([
      "callsign:callsign.invalid-format",
      "datetimeOn:time.missing-offset",
      "frequencyHz:frequency.not-integer",
      "rstSent:report.out-of-range",
    ]);
    expect(await test.db.qso_logs.count()).toBe(0);
  });

  it("rejects an end before the start and a zero frequency", async () => {
    const { qsoLogs, profile } = await setup();
    const error = expectErr(
      await qsoLogs.create(
        qsoDraft(profile.id, {
          frequencyHz: 0,
          datetimeOff: "2026-10-24T13:20:00Z",
        }),
      ),
    );
    expect(
      error.code === "persistence.invalid-input" &&
        error.issues.map((issue) => issue.code),
    ).toEqual(["qso.off-before-on", "qso.frequency-zero"]);
  });

  it("requires an existing station profile", async () => {
    const { qsoLogs, test } = await setup();
    const missing = crypto.randomUUID();
    expect(expectErr(await qsoLogs.create(qsoDraft(missing)))).toEqual({
      code: "persistence.conflict",
      table: "qso_logs",
      reason: "missing-reference",
      rule: "qso.station-profile-missing",
      key: missing,
      related: "station_profiles",
    });
    expect(await test.db.qso_logs.count()).toBe(0);
  });
});

describe("QSO: update", () => {
  it("applies a patch and re-validates the whole record", async () => {
    const { qsoLogs, profile } = await setup();
    const qso = expectOk(await qsoLogs.create(qsoDraft(profile.id)));
    const updated = expectOk(
      await qsoLogs.update(qso.id, {
        notes: "  bel segnale ",
        rstRcvd: undefined,
      }),
    );
    expect(updated.notes).toBe("bel segnale");
    expect("rstRcvd" in updated).toBe(false);
    expect(updated.createdAt).toBe(qso.createdAt);

    expect(
      expectErr(
        await qsoLogs.update(qso.id, { datetimeOff: "2020-01-01T00:00:00Z" }),
      ),
    ).toMatchObject({ code: "persistence.invalid-input" });
    expect(expectOk(await qsoLogs.get(qso.id))).toEqual(updated);
  });

  it("checks the profile when it changes", async () => {
    const { qsoLogs, stationProfiles, profile } = await setup();
    const qso = expectOk(await qsoLogs.create(qsoDraft(profile.id)));
    const other = expectOk(
      await stationProfiles.create(stationProfileDraft({ name: "Portatile" })),
    );
    expect(
      expectOk(await qsoLogs.update(qso.id, { stationProfileId: other.id }))
        .stationProfileId,
    ).toBe(other.id);
    expect(
      expectErr(
        await qsoLogs.update(qso.id, { stationProfileId: crypto.randomUUID() }),
      ),
    ).toMatchObject({ reason: "missing-reference" });
  });

  it("never changes id or createdAt, and keeps updatedAt ≥ createdAt", async () => {
    const { qsoLogs, profile, test } = await setup();
    const qso = expectOk(await qsoLogs.create(qsoDraft(profile.id)));
    test.clock.set("2020-01-01T00:00:00Z"); // device clock went back
    const updated = expectOk(
      await qsoLogs.update(qso.id, {
        id: crypto.randomUUID(),
        createdAt: "2000-01-01T00:00:00Z",
      } as Record<string, unknown>),
    );
    expect(updated.id).toBe(qso.id);
    expect(updated.createdAt).toBe(qso.createdAt);
    expect(updated.updatedAt).toBe(qso.createdAt);
  });

  it("reports missing records", async () => {
    const { qsoLogs } = await setup();
    const id = crypto.randomUUID();
    expect(expectErr(await qsoLogs.get(id))).toMatchObject({
      code: "persistence.not-found",
    });
    expect(expectErr(await qsoLogs.update(id, {}))).toMatchObject({
      code: "persistence.not-found",
    });
    expect(expectErr(await qsoLogs.delete(id))).toMatchObject({
      code: "persistence.not-found",
    });
  });
});
