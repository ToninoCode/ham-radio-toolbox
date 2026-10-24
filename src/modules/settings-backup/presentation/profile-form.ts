import type { ValidationIssue } from "@/shared/application";
import type { StationProfilePatch } from "../application/ports";
import type {
  StationProfile,
  StationProfileKind,
} from "../domain/station-profile";

/*
 * Station profile form (FR-SET-01): every field as typed by the user, and
 * the conversion to a repository patch. Text normalisation and validation
 * stay in the entity schema (one rule, one place: ADR-0013); here only the
 * form-specific steps happen: blank fields become absent and numbers are
 * read from text (comma or dot as decimal separator).
 */

export const PROFILE_TEXT_FIELDS = [
  "name",
  "callsign",
  "swlId",
  "operatorName",
  "locator",
  "qth",
  "country",
] as const;

export const PROFILE_NUMBER_FIELDS = [
  "dxcc",
  "cqZone",
  "ituZone",
  "altitudeM",
] as const;

export const EQUIPMENT_TEXT_FIELDS = ["rig", "receiver", "antenna"] as const;

type TextField = (typeof PROFILE_TEXT_FIELDS)[number];
type NumberField = (typeof PROFILE_NUMBER_FIELDS)[number];
type EquipmentField = (typeof EQUIPMENT_TEXT_FIELDS)[number] | "powerW";

export type ProfileFormField = TextField | NumberField | EquipmentField;

export type ProfileFormValues = Record<ProfileFormField, string> & {
  kind: StationProfileKind;
};

/** Field → stable issue code (translated by the view). */
export type ProfileFormErrors = Partial<Record<ProfileFormField, string>>;

export function emptyProfileForm(): ProfileFormValues {
  return {
    name: "",
    kind: "ham",
    callsign: "",
    swlId: "",
    operatorName: "",
    locator: "",
    qth: "",
    country: "",
    dxcc: "",
    cqZone: "",
    ituZone: "",
    altitudeM: "",
    rig: "",
    receiver: "",
    antenna: "",
    powerW: "",
  };
}

const text = (value: string | number | undefined) =>
  value === undefined ? "" : String(value);

export function profileFormOf(profile: StationProfile): ProfileFormValues {
  return {
    name: profile.name,
    kind: profile.kind,
    callsign: text(profile.callsign),
    swlId: text(profile.swlId),
    operatorName: text(profile.operatorName),
    locator: text(profile.locator),
    qth: text(profile.qth),
    country: text(profile.country),
    dxcc: text(profile.dxcc),
    cqZone: text(profile.cqZone),
    ituZone: text(profile.ituZone),
    altitudeM: text(profile.altitudeM),
    rig: text(profile.equipment?.rig),
    receiver: text(profile.equipment?.receiver),
    antenna: text(profile.equipment?.antenna),
    powerW: text(profile.equipment?.powerW),
  };
}

/** `undefined` for a blank field; `NaN` for text that is not a number. */
function parseNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const normalized = trimmed.replace(",", ".");
  return /^[-+]?\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

const optional = (value: string) => (value.trim() === "" ? undefined : value);

export interface ProfileFormResult {
  /** All the fields: absent ones are `undefined`, so a patch clears them. */
  readonly patch: StationProfilePatch & {
    readonly name: string;
    readonly kind: StationProfileKind;
  };
  /** Problems found before the repository (numbers that are not numbers). */
  readonly errors: ProfileFormErrors;
}

export function profilePatchOf(values: ProfileFormValues): ProfileFormResult {
  const errors: ProfileFormErrors = {};
  const number = (field: NumberField | "powerW") => {
    const parsed = parseNumber(values[field]);
    if (Number.isNaN(parsed)) errors[field] = "number.invalid";
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const equipment = {
    rig: optional(values.rig),
    receiver: optional(values.receiver),
    antenna: optional(values.antenna),
    powerW: number("powerW"),
  };
  const hasEquipment = Object.values(equipment).some((v) => v !== undefined);

  return {
    patch: {
      name: values.name,
      kind: values.kind,
      callsign: optional(values.callsign),
      swlId: optional(values.swlId),
      operatorName: optional(values.operatorName),
      locator: optional(values.locator),
      qth: optional(values.qth),
      country: optional(values.country),
      dxcc: number("dxcc"),
      cqZone: number("cqZone"),
      ituZone: number("ituZone"),
      altitudeM: number("altitudeM"),
      equipment: hasEquipment ? equipment : undefined,
    },
    errors,
  };
}

const FORM_FIELDS: ReadonlySet<string> = new Set<ProfileFormField>([
  ...PROFILE_TEXT_FIELDS,
  ...PROFILE_NUMBER_FIELDS,
  ...EQUIPMENT_TEXT_FIELDS,
  "powerW",
]);

/**
 * Issues of `persistence.invalid-input` placed on the form fields
 * (`equipment.rig` → `rig`); issues of fields the form does not show
 * (e.g. `lat`) are returned apart. First issue per field wins.
 */
export function formErrorsOf(issues: readonly ValidationIssue[]): {
  readonly fields: ProfileFormErrors;
  readonly other: readonly ValidationIssue[];
} {
  const fields: ProfileFormErrors = {};
  const other: ValidationIssue[] = [];
  for (const issue of issues) {
    const name = issue.path.startsWith("equipment.")
      ? issue.path.slice("equipment.".length)
      : issue.path;
    if (FORM_FIELDS.has(name)) {
      const field = name as ProfileFormField;
      fields[field] ??= issue.code;
    } else {
      other.push(issue);
    }
  }
  return { fields, other };
}
