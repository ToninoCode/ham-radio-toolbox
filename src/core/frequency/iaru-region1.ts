import type { BandPlanData } from "./band-plan";

/**
 * Amateur band edges of the IARU Region 1 band plans (data only; the logic is
 * in band-plan.ts). Limits are inclusive, in hertz.
 *
 * Scope: recognising which amateur band a frequency belongs to (FR-HAM-02).
 * A band plan is a voluntary agreement among IARU member societies, not a
 * licence: the frequencies, powers and modes a station may actually use are
 * set by national regulations and by its licence class. Nothing in this table
 * implies a permission to transmit.
 *
 * Verified on 2026-10-17 (details in docs/data-sources/SOURCES.md § 4):
 * - IARU Region 1 HF band plan (revision 2016) and the IARU R1 HF wiki (ITU
 *   Region 1 allocations): 135.7 kHz – 29.7 MHz;
 * - IARU Region 1 VHF/UHF band plans (edition 2020, Novi Sad; edges
 *   unchanged from the 2004 San Marino edition): 50 MHz – 2450 MHz.
 *
 * Bands above 2450 MHz are deliberately absent until verified against the
 * current IARU R1 VHF Managers Handbook (ROADMAP backlog): frequencies there
 * are reported as out of band, and the user can set the band by hand.
 *
 * Band ids are ADIF `BAND` enumeration values (DATABASE.md § qso_logs).
 */
export const IARU_REGION_1_BAND_PLAN: BandPlanData = {
  id: "iaru-r1",
  sources: [
    "IARU Region 1 HF band plan, revision 2016",
    "IARU Region 1 VHF/UHF band plan, edition 2020",
  ],
  verifiedOn: "2026-10-17",
  bands: [
    { id: "2190m", lowerHz: 135_700, upperHz: 137_800, allocation: "itu" },
    { id: "630m", lowerHz: 472_000, upperHz: 479_000, allocation: "itu" },
    { id: "160m", lowerHz: 1_810_000, upperHz: 2_000_000, allocation: "itu" },
    { id: "80m", lowerHz: 3_500_000, upperHz: 3_800_000, allocation: "itu" },
    // WRC-15 secondary allocation, 15 W e.i.r.p. maximum.
    { id: "60m", lowerHz: 5_351_500, upperHz: 5_366_500, allocation: "itu" },
    { id: "40m", lowerHz: 7_000_000, upperHz: 7_200_000, allocation: "itu" },
    { id: "30m", lowerHz: 10_100_000, upperHz: 10_150_000, allocation: "itu" },
    { id: "20m", lowerHz: 14_000_000, upperHz: 14_350_000, allocation: "itu" },
    { id: "17m", lowerHz: 18_068_000, upperHz: 18_168_000, allocation: "itu" },
    { id: "15m", lowerHz: 21_000_000, upperHz: 21_450_000, allocation: "itu" },
    { id: "12m", lowerHz: 24_890_000, upperHz: 24_990_000, allocation: "itu" },
    { id: "10m", lowerHz: 28_000_000, upperHz: 29_700_000, allocation: "itu" },
    // WRC-19 allocation in Region 1: 50–52 MHz.
    { id: "6m", lowerHz: 50_000_000, upperHz: 52_000_000, allocation: "itu" },
    // No ITU allocation: available only in countries that grant it nationally.
    {
      id: "4m",
      lowerHz: 70_000_000,
      upperHz: 70_500_000,
      allocation: "national",
    },
    { id: "2m", lowerHz: 144_000_000, upperHz: 146_000_000, allocation: "itu" },
    {
      id: "70cm",
      lowerHz: 430_000_000,
      upperHz: 440_000_000,
      allocation: "itu",
    },
    {
      id: "23cm",
      lowerHz: 1_240_000_000,
      upperHz: 1_300_000_000,
      allocation: "itu",
    },
    {
      id: "13cm",
      lowerHz: 2_300_000_000,
      upperHz: 2_450_000_000,
      allocation: "itu",
    },
  ],
};
