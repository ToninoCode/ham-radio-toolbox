// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../../support/database";
import {
  expectErr,
  expectOk,
  receptionInput,
  stationProfileDraft,
} from "../../support/records";

async function setup() {
  const test = createTestDatabase();
  const { swlReceptions, stationProfiles } = test.container.repositories;
  const profile = expectOk(
    await stationProfiles.create(
      stationProfileDraft({ kind: "swl", callsign: undefined }),
    ),
  );
  return { test, swlReceptions, profile };
}

describe("SWL receptions: aggregate with details", () => {
  it("creates reception and details together", async () => {
    const { swlReceptions, profile, test } = await setup();
    const { reception, details } = expectOk(
      await swlReceptions.create(receptionInput(profile.id)),
    );
    expect(reception).toMatchObject({
      category: "broadcast",
      modulation: "AM",
      sinpo: "45444",
      frequencyHz: 6_070_000,
    });
    expect(details).toMatchObject({
      receptionId: reception.id,
      category: "broadcast",
      data: { programme: "Notiziario", qslRequested: true },
    });
    expect(expectOk(await swlReceptions.get(reception.id))).toEqual({
      reception,
      details,
    });
    expect(await test.db.reception_details.count()).toBe(1);
  });

  it("creates a reception without details", async () => {
    const { swlReceptions, profile } = await setup();
    const created = expectOk(
      await swlReceptions.create(receptionInput(profile.id, {}, null)),
    );
    expect(created.details).toBeUndefined();
    expect(expectOk(await swlReceptions.get(created.reception.id))).toEqual(
      created,
    );
  });

  it("validates the details of each category", async () => {
    const { swlReceptions, profile } = await setup();
    expect(
      expectErr(
        await swlReceptions.create(
          receptionInput(
            profile.id,
            { category: "amateur" },
            // Invalid on purpose (required field missing): runtime check.
            { category: "amateur", data: {} as never },
          ),
        ),
      ),
    ).toMatchObject({
      code: "persistence.invalid-input",
      table: "reception_details",
      issues: [{ path: "data.callsignHeard", code: "zod.invalid_type" }],
    });
    const amateur = expectOk(
      await swlReceptions.create(
        receptionInput(
          profile.id,
          { category: "amateur", modulation: "usb" },
          { category: "amateur", data: { callsignHeard: "ea3abc" } },
        ),
      ),
    );
    expect(amateur.details?.data).toEqual({ callsignHeard: "EA3ABC" });
  });

  it.each(["aeronautical", "maritime"] as const)(
    "has no field for the content of %s communications (FR-SWL-04)",
    async (category) => {
      const { swlReceptions, profile, test } = await setup();
      const error = expectErr(
        await swlReceptions.create(
          receptionInput(
            profile.id,
            { category, modulation: "usb" },
            {
              category,
              data: { message: "testo della comunicazione" } as never,
            },
          ),
        ),
      );
      expect(error).toMatchObject({
        code: "persistence.invalid-input",
        issues: [{ path: "data", code: "zod.unrecognized_keys" }],
      });
      expect(await test.db.swl_receptions.count()).toBe(0);
    },
  );

  it("rejects details of another category", async () => {
    const { swlReceptions, profile, test } = await setup();
    expect(
      expectErr(
        await swlReceptions.create(
          receptionInput(
            profile.id,
            { category: "broadcast" },
            { category: "utility", data: { serviceType: "time-signal" } },
          ),
        ),
      ),
    ).toMatchObject({
      code: "persistence.conflict",
      table: "reception_details",
      reason: "invariant",
      rule: "reception-details.category-mismatch",
    });
    expect(await test.db.swl_receptions.count()).toBe(0);
  });

  it("requires an existing station profile", async () => {
    const { swlReceptions } = await setup();
    expect(
      expectErr(
        await swlReceptions.create(receptionInput(crypto.randomUUID())),
      ),
    ).toMatchObject({
      reason: "missing-reference",
      rule: "swl.station-profile-missing",
    });
  });
});

describe("SWL receptions: atomic update of related records", () => {
  it("changes category and details in one update", async () => {
    const { swlReceptions, profile } = await setup();
    const created = expectOk(
      await swlReceptions.create(receptionInput(profile.id)),
    );
    const updated = expectOk(
      await swlReceptions.update(created.reception.id, {
        reception: {
          category: "utility",
          modulation: "usb",
          stationName: "DCF77",
        },
        details: { category: "utility", data: { serviceType: "time-signal" } },
      }),
    );
    expect(updated.reception.category).toBe("utility");
    expect(updated.details).toMatchObject({
      id: created.details?.id,
      createdAt: created.details?.createdAt,
      category: "utility",
      data: { serviceType: "time-signal" },
    });
    expect(expectOk(await swlReceptions.get(created.reception.id))).toEqual(
      updated,
    );
  });

  it("refuses a category change that would leave stale details", async () => {
    const { swlReceptions, profile } = await setup();
    const created = expectOk(
      await swlReceptions.create(receptionInput(profile.id)),
    );
    expect(
      expectErr(
        await swlReceptions.update(created.reception.id, {
          reception: { category: "digital" },
        }),
      ),
    ).toMatchObject({
      reason: "invariant",
      rule: "reception-details.category-mismatch",
    });
    // Nothing changed: reception and details are still consistent.
    expect(expectOk(await swlReceptions.get(created.reception.id))).toEqual(
      created,
    );
  });

  it("removes the details with null and keeps them when absent", async () => {
    const { swlReceptions, profile, test } = await setup();
    const created = expectOk(
      await swlReceptions.create(receptionInput(profile.id)),
    );
    const kept = expectOk(
      await swlReceptions.update(created.reception.id, {
        reception: { notes: "ottima ricezione" },
      }),
    );
    expect(kept.details).toEqual(created.details);
    const removed = expectOk(
      await swlReceptions.update(created.reception.id, {
        reception: { category: "digital" },
        details: null,
      }),
    );
    expect(removed.details).toBeUndefined();
    expect(await test.db.reception_details.count()).toBe(0);
  });

  it("leaves both records unchanged when the details are invalid", async () => {
    const { swlReceptions, profile } = await setup();
    const created = expectOk(
      await swlReceptions.create(receptionInput(profile.id)),
    );
    expect(
      expectErr(
        await swlReceptions.update(created.reception.id, {
          reception: { stationName: "Altro nome" },
          details: { category: "broadcast", data: { powerKw: -1 } },
        }),
      ),
    ).toMatchObject({ code: "persistence.invalid-input" });
    expect(expectOk(await swlReceptions.get(created.reception.id))).toEqual(
      created,
    );
  });
});
