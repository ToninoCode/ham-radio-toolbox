/**
 * Inline icon set drawn for this project (24×24 grid, stroke-based).
 * No icon library: only the icons actually used are shipped.
 */

function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

const STAR =
  "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z";

const WIFI = [
  "M2.5 9a14 14 0 0 1 19 0",
  "M5.5 12.5a9.5 9.5 0 0 1 13 0",
  "M8.5 16a5 5 0 0 1 7 0",
  "M12 19.5h.01",
];

export interface IconDefinition {
  readonly paths: readonly string[];
  readonly filled?: boolean;
}

export const ICONS = {
  antenna: {
    paths: [
      circle(12, 8.5, 1.5),
      "M8.5 5a5 5 0 0 0 0 7",
      "M15.5 5a5 5 0 0 1 0 7",
      "M5.5 2.5a9 9 0 0 0 0 12",
      "M18.5 2.5a9 9 0 0 1 0 12",
      "M12 10v11",
      "M9 21h6",
    ],
  },
  home: {
    paths: ["M3 11.5 12 4l9 7.5", "M5.5 10v9.5h13V10", "M10 19.5v-5h4v5"],
  },
  logbook: {
    paths: [
      "M5 17V6.5A2.5 2.5 0 0 1 7.5 4H19v13",
      "M5 17a2.5 2.5 0 0 0 2.5 2.5H19V15H7.5A2.5 2.5 0 0 0 5 17z",
      "M9 8h6",
    ],
  },
  headphones: {
    paths: [
      "M4 15v-3a8 8 0 0 1 16 0v3",
      "M4 15h3v5H5a1 1 0 0 1-1-1z",
      "M20 15h-3v5h2a1 1 0 0 0 1-1z",
    ],
  },
  frequency: {
    paths: ["M2 12c1.5-5 3.5-5 5 0s3.5 5 5 0 3.5-5 5 0 3.5 5 5 0"],
  },
  waveform: {
    paths: ["M4 10v4", "M8 6v12", "M12 3v18", "M16 7v10", "M20 10v4"],
  },
  satellite: {
    paths: [
      "M14.5 3.5l6 6-3 3-6-6z",
      "M3.5 14.5l6 6 3-3-6-6z",
      "M9.5 9.5l5 5",
      "M16 21a5 5 0 0 0 5-5",
    ],
  },
  bookmark: { paths: ["M6 3.5h12v17l-6-4-6 4z"] },
  globe: {
    paths: [
      circle(12, 12, 9),
      "M3 12h18",
      "M12 3c3 3.2 3 14.8 0 18",
      "M12 3c-3 3.2-3 14.8 0 18",
    ],
  },
  card: { paths: ["M3.5 6h17v12h-17z", "M3.5 6.5 12 13l8.5-6.5"] },
  "map-pin": {
    paths: [
      "M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z",
      circle(12, 10, 2.5),
    ],
  },
  tower: {
    paths: [
      "M8 21l4-11 4 11",
      "M9.5 17h5",
      "M8.5 5.5a5 5 0 0 1 7 0",
      "M6 3a8.5 8.5 0 0 1 12 0",
      circle(12, 8.5, 1.5),
    ],
  },
  calculator: {
    paths: [
      "M6 3h12v18H6z",
      "M9 7h6",
      "M9 12h.01M12 12h.01M15 12h.01",
      "M9 16h.01M12 16h.01M15 16h.01",
    ],
  },
  sun: {
    paths: [
      circle(12, 12, 4),
      "M12 2v2M12 20v2M2 12h2M20 12h2",
      "M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
    ],
  },
  moon: { paths: ["M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"] },
  monitor: { paths: ["M3 4.5h18v12H3z", "M8 20.5h8", "M12 16.5v4"] },
  sliders: {
    paths: [
      "M4 6h10M18 6h2",
      circle(16, 6, 2),
      "M4 12h4M12 12h8",
      circle(10, 12, 2),
      "M4 18h12M20 18h0",
      circle(18, 18, 2),
    ],
  },
  star: { paths: [STAR] },
  "star-filled": { paths: [STAR], filled: true },
  menu: { paths: ["M4 7h16", "M4 12h16", "M4 17h16"] },
  grid: {
    paths: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
  },
  close: { paths: ["M6 6l12 12", "M18 6 6 18"] },
  online: { paths: WIFI },
  offline: { paths: [...WIFI, "M3 3l18 18"] },
  clock: { paths: [circle(12, 12, 9), "M12 7v5l3 2"] },
  "arrow-left": { paths: ["M19 12H5", "M11 6l-6 6 6 6"] },
  info: { paths: [circle(12, 12, 9), "M12 11v5", "M12 8h.01"] },
  database: {
    paths: [
      "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z",
      "M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6",
      "M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
    ],
  },
  alert: {
    paths: ["M12 3.5 2.5 20h19z", "M12 10v4.5", "M12 17.5h.01"],
  },
  check: { paths: ["M4.5 12.5l5 5 10-11"] },
  plus: { paths: ["M12 5v14", "M5 12h14"] },
  edit: { paths: ["M4 20h4L19 9l-4-4L4 16z", "M13.5 6.5l4 4"] },
  trash: {
    paths: ["M4 7h16", "M9 7V4h6v3", "M6.5 7l1 13h9l1-13", "M10 11v6M14 11v6"],
  },
  download: { paths: ["M12 4v11", "M7 10.5l5 5 5-5", "M5 20h14"] },
  upload: { paths: ["M12 15V4", "M7 8.5l5-5 5 5", "M5 20h14"] },
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof ICONS;
