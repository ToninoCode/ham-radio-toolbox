// @vitest-environment node
import { describe, expect, it } from "vitest";
import { stationProfileSchema } from "../domain/station-profile";
import {
  emptyProfileForm,
  formErrorsOf,
  profileFormOf,
  profilePatchOf,
} from "./profile-form";

describe("profile form", () => {
  it("turns blank fields into absent ones and reads numbers", () => {
    const { patch, errors } = profilePatchOf({
      ...emptyProfileForm(),
      name: " Casa ",
      callsign: "iz1abc",
      cqZone: "15",
      altitudeM: "123,5",
      rig: "IC-7300",
    });
    expect(errors).toEqual({});
    expect(patch).toMatchObject({
      name: " Casa ",
      kind: "ham",
      callsign: "iz1abc",
      cqZone: 15,
      altitudeM: 123.5,
      equipment: { rig: "IC-7300" },
    });
    expect(patch.locator).toBeUndefined();
    expect(patch.dxcc).toBeUndefined();
    expect(patch.equipment?.powerW).toBeUndefined();
  });

  it("omits the equipment when every field is blank", () => {
    expect(profilePatchOf(emptyProfileForm()).patch.equipment).toBeUndefined();
  });

  it("flags text that is not a number before the repository", () => {
    expect(
      profilePatchOf({ ...emptyProfileForm(), dxcc: "abc", powerW: "1e3" })
        .errors,
    ).toEqual({ dxcc: "number.invalid", powerW: "number.invalid" });
  });

  it("round-trips a stored profile through the form", () => {
    const profile = stationProfileSchema.parse({
      id: "8e0c3f4a-3c1d-4f4e-9a3b-0c2d1e4f5a6b",
      name: "Portatile",
      kind: "both",
      callsign: "IZ1ABC/P",
      locator: "JN45dl",
      dxcc: 248,
      equipment: { antenna: "Dipolo", powerW: 5 },
      isDefault: 1,
      createdAt: "2026-10-24T10:00:00Z",
      updatedAt: "2026-10-24T10:00:00Z",
    });
    const { patch } = profilePatchOf(profileFormOf(profile));
    expect(patch).toMatchObject({
      name: "Portatile",
      kind: "both",
      callsign: "IZ1ABC/P",
      locator: "JN45dl",
      dxcc: 248,
      equipment: { antenna: "Dipolo", powerW: 5 },
    });
  });

  it("places schema issues on the form fields", () => {
    expect(
      formErrorsOf([
        { path: "callsign", code: "station-profile.callsign-required" },
        { path: "callsign", code: "callsign.invalid-format" },
        { path: "equipment.powerW", code: "zod.too_small" },
        { path: "lat", code: "fields.incomplete-group" },
      ]),
    ).toEqual({
      fields: {
        callsign: "station-profile.callsign-required",
        powerW: "zod.too_small",
      },
      other: [{ path: "lat", code: "fields.incomplete-group" }],
    });
  });
});
