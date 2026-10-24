// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PersistenceError } from "@/shared/application";
import type { Result } from "@/shared/types";
import { createTestDatabase } from "../../support/database";
import {
  expectErr,
  expectOk,
  qsoDraft,
  receptionInput,
  stationProfileDraft,
} from "../../support/records";

/*
 * Station profiles: CRUD, validation and the invariants of DATABASE.md
 * `station_profiles` and § 6 (exactly one default, deletion blocked when
 * referenced or last).
 */

async function setup() {
  const test = createTestDatabase();
  const profiles = test.container.repositories.stationProfiles;
  const defaults = async () =>
    expectOk(await profiles.list())
      .filter((profile) => profile.isDefault === 1)
      .map((profile) => profile.name);
  return { test, profiles, defaults };
}

describe("station profiles: CRUD and validation", () => {
  it("creates a normalised profile with id and timestamps", async () => {
    const { profiles } = await setup();
    const profile = expectOk(
      await profiles.create(
        stationProfileDraft({
          name: "  Casa ",
          equipment: { rig: "IC-7300", powerW: 100 },
        }),
      ),
    );
    expect(profile).toMatchObject({
      name: "Casa",
      kind: "ham",
      callsign: "IZ1ABC",
      locator: "JN45dl",
      isDefault: 1,
      createdAt: "2026-10-24T10:00:00Z",
      updatedAt: "2026-10-24T10:00:00Z",
      equipment: { rig: "IC-7300", powerW: 100 },
    });
    expect(profile.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(expectOk(await profiles.get(profile.id))).toEqual(profile);
  });

  it("rejects invalid input with its issues and writes nothing", async () => {
    const { profiles, test } = await setup();
    const issues = async (draft: Parameters<typeof profiles.create>[0]) => {
      const error = expectErr(await profiles.create(draft));
      expect(error).toMatchObject({
        code: "persistence.invalid-input",
        table: "station_profiles",
      });
      return error.code === "persistence.invalid-input"
        ? error.issues.map((issue) => `${issue.path}:${issue.code}`)
        : [];
    };
    // Field issues first; cross-field rules run once the fields are valid.
    expect(
      await issues(stationProfileDraft({ name: "", locator: "ZZ99" })),
    ).toEqual(["name:text.empty", "locator:locator.invalid-format"]);
    expect(
      await issues(stationProfileDraft({ callsign: undefined, lat: 45 })),
    ).toEqual([
      "lon:fields.incomplete-group",
      "callsign:station-profile.callsign-required",
    ]);
    expect(await test.db.station_profiles.count()).toBe(0);
  });

  it("rejects fields that are not in the schema", async () => {
    const { profiles } = await setup();
    const draft = { ...stationProfileDraft(), password: "x" };
    expect(expectErr(await profiles.create(draft))).toMatchObject({
      code: "persistence.invalid-input",
      issues: [{ path: "", code: "zod.unrecognized_keys" }],
    });
  });

  it("allows an SWL profile without callsign", async () => {
    const { profiles } = await setup();
    const profile = expectOk(
      await profiles.create(
        stationProfileDraft({
          kind: "swl",
          callsign: undefined,
          swlId: "I-12345",
        }),
      ),
    );
    expect(profile.callsign).toBeUndefined();
  });

  it("updates fields, keeps id and createdAt, removes fields set to undefined", async () => {
    const { profiles } = await setup();
    const created = expectOk(
      await profiles.create(stationProfileDraft({ qth: "Torino" })),
    );
    const updated = expectOk(
      await profiles.update(created.id, {
        name: "Stazione fissa",
        qth: undefined,
      }),
    );
    expect(updated).toMatchObject({
      id: created.id,
      name: "Stazione fissa",
      createdAt: created.createdAt,
    });
    expect("qth" in updated).toBe(false);
    expect(updated.updatedAt > created.updatedAt).toBe(true);
  });

  it("reports missing records", async () => {
    const { profiles } = await setup();
    const id = crypto.randomUUID();
    const results: Result<unknown, PersistenceError>[] = [
      await profiles.get(id),
      await profiles.update(id, { name: "x" }),
      await profiles.setDefault(id),
      await profiles.delete(id),
    ];
    for (const result of results) {
      expect(expectErr(result)).toEqual({
        code: "persistence.not-found",
        table: "station_profiles",
        key: id,
      });
    }
  });
});

describe("station profiles: exactly one default", () => {
  it("makes the first profile the default, later ones not", async () => {
    const { profiles, defaults } = await setup();
    expect(expectOk(await profiles.getDefault())).toBeUndefined();
    expectOk(await profiles.create(stationProfileDraft({ name: "Casa" })));
    expectOk(await profiles.create(stationProfileDraft({ name: "Portatile" })));
    expect(await defaults()).toEqual(["Casa"]);
  });

  it("moves the default to a new profile created as default", async () => {
    const { profiles, defaults } = await setup();
    expectOk(await profiles.create(stationProfileDraft({ name: "Casa" })));
    expectOk(
      await profiles.create(
        stationProfileDraft({ name: "SOTA", isDefault: 1 }),
      ),
    );
    expect(await defaults()).toEqual(["SOTA"]);
  });

  it("switches the default with setDefault and ignores isDefault in updates", async () => {
    const { profiles, defaults } = await setup();
    const casa = expectOk(
      await profiles.create(stationProfileDraft({ name: "Casa" })),
    );
    const sota = expectOk(
      await profiles.create(stationProfileDraft({ name: "SOTA" })),
    );
    expectOk(await profiles.setDefault(sota.id));
    expect(await defaults()).toEqual(["SOTA"]);
    // isDefault is not part of the patch type; at runtime it is ignored.
    expectOk(
      await profiles.update(casa.id, { isDefault: 1 } as Record<
        string,
        unknown
      >),
    );
    expect(await defaults()).toEqual(["SOTA"]);
    expect(expectOk(await profiles.getDefault())?.id).toBe(sota.id);
  });

  it("keeps exactly one default under concurrent setDefault calls", async () => {
    const { profiles, defaults } = await setup();
    const created = [];
    for (const name of ["A", "B", "C", "D"]) {
      created.push(
        expectOk(await profiles.create(stationProfileDraft({ name }))),
      );
    }
    const results = await Promise.all(
      created.map((profile) => profiles.setDefault(profile.id)),
    );
    results.forEach((result) => expectOk(result));
    expect((await defaults()).length).toBe(1);
  });

  it("promotes the oldest remaining profile when the default is deleted", async () => {
    const { profiles, defaults } = await setup();
    const casa = expectOk(
      await profiles.create(stationProfileDraft({ name: "Casa" })),
    );
    expectOk(await profiles.create(stationProfileDraft({ name: "Portatile" })));
    expectOk(await profiles.create(stationProfileDraft({ name: "SOTA" })));
    expect(expectOk(await profiles.delete(casa.id))).toEqual({
      station_profiles: 1,
    });
    expect(await defaults()).toEqual(["Portatile"]);
  });
});

describe("station profiles: deletion rules (DATABASE.md § 6)", () => {
  it("cannot delete the last profile", async () => {
    const { profiles } = await setup();
    const only = expectOk(await profiles.create(stationProfileDraft()));
    expect(expectErr(await profiles.delete(only.id))).toEqual({
      code: "persistence.conflict",
      table: "station_profiles",
      reason: "invariant",
      rule: "station-profile.last",
      key: only.id,
    });
  });

  it("cannot delete a profile referenced by QSO or receptions", async () => {
    const { profiles, test } = await setup();
    const { qsoLogs, swlReceptions } = test.container.repositories;
    const ham = expectOk(await profiles.create(stationProfileDraft()));
    const swl = expectOk(
      await profiles.create(
        stationProfileDraft({ name: "SWL", kind: "swl", callsign: undefined }),
      ),
    );
    expectOk(await profiles.create(stationProfileDraft({ name: "Spare" })));
    expectOk(await qsoLogs.create(qsoDraft(ham.id)));
    expectOk(await swlReceptions.create(receptionInput(swl.id)));

    expect(expectErr(await profiles.delete(ham.id))).toMatchObject({
      code: "persistence.conflict",
      reason: "referenced",
      rule: "station-profile.referenced",
      related: "qso_logs",
    });
    expect(expectErr(await profiles.delete(swl.id))).toMatchObject({
      reason: "referenced",
      related: "swl_receptions",
    });
    expect(expectOk(await profiles.list())).toHaveLength(3);
  });
});
