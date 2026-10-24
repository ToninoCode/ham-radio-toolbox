import type { FrequencyHz } from "./frequency";

/**
 * Whether the band has an ITU allocation to the amateur service in the
 * plan's region, or exists only where national administrations grant it.
 * Informative only: neither value is a permission to transmit.
 */
export type BandAllocation = "itu" | "national";

/** One amateur band as written in a band plan's data file (limits in Hz). */
export interface BandData {
  /** ADIF `BAND` enumeration value, e.g. "20m", "70cm". */
  readonly id: string;
  readonly lowerHz: number;
  readonly upperHz: number;
  readonly allocation: BandAllocation;
}

export interface BandPlanData {
  readonly id: string;
  /** Documents the edges were checked against. */
  readonly sources: readonly string[];
  /** Date of the last verification (YYYY-MM-DD). */
  readonly verifiedOn: string;
  readonly bands: readonly BandData[];
}

export interface Band {
  readonly id: string;
  /** Inclusive lower edge. */
  readonly lowerHz: FrequencyHz;
  /** Inclusive upper edge. */
  readonly upperHz: FrequencyHz;
  readonly allocation: BandAllocation;
}

/**
 * Classification of a frequency against a band plan. `out-of-band` carries
 * the nearest bands below and above, useful to explain the result.
 */
export type BandMatch =
  | { readonly kind: "in-band"; readonly band: Band }
  | {
      readonly kind: "out-of-band";
      readonly below?: Band;
      readonly above?: Band;
    };

export interface BandPlan {
  readonly id: string;
  readonly sources: readonly string[];
  readonly verifiedOn: string;
  /** Bands ordered by frequency. */
  readonly bands: readonly Band[];
  /** Band containing `hz` (edges included), or `undefined` if out of band. */
  findBand(hz: FrequencyHz): Band | undefined;
  classify(hz: FrequencyHz): BandMatch;
  /** Band with the given ADIF id, or `undefined`. */
  getBand(id: string): Band | undefined;
}

/**
 * Builds a band plan from its data, checking that every band has safe
 * integer edges, lower ≤ upper, unique ids and no overlap. Invalid data is a
 * programming error and throws.
 */
export function createBandPlan(data: BandPlanData): BandPlan {
  const bands = [...data.bands]
    .sort((a, b) => a.lowerHz - b.lowerHz)
    .map((band): Band => {
      if (
        !Number.isSafeInteger(band.lowerHz) ||
        !Number.isSafeInteger(band.upperHz) ||
        band.lowerHz < 0 ||
        band.lowerHz > band.upperHz
      ) {
        throw new Error(`Invalid edges for band ${band.id} in ${data.id}`);
      }
      return {
        id: band.id,
        lowerHz: band.lowerHz as FrequencyHz,
        upperHz: band.upperHz as FrequencyHz,
        allocation: band.allocation,
      };
    });

  const byId = new Map<string, Band>();
  bands.forEach((band, index) => {
    if (byId.has(band.id)) {
      throw new Error(`Duplicate band ${band.id} in ${data.id}`);
    }
    const previous = bands[index - 1];
    if (previous && previous.upperHz >= band.lowerHz) {
      throw new Error(
        `Bands ${previous.id} and ${band.id} overlap in ${data.id}`,
      );
    }
    byId.set(band.id, band);
  });

  const findBand = (hz: FrequencyHz): Band | undefined =>
    bands.find((band) => hz >= band.lowerHz && hz <= band.upperHz);

  return {
    id: data.id,
    sources: data.sources,
    verifiedOn: data.verifiedOn,
    bands,
    findBand,
    classify(hz) {
      const band = findBand(hz);
      if (band) return { kind: "in-band", band };
      const below = bands.filter((b) => b.upperHz < hz).at(-1);
      const above = bands.find((b) => b.lowerHz > hz);
      return {
        kind: "out-of-band",
        ...(below ? { below } : {}),
        ...(above ? { above } : {}),
      };
    },
    getBand: (id) => byId.get(id),
  };
}
