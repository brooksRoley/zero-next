// Court zone taxonomy for the NBA TFT simulation engine.
// Zones mirror the basketball-platform.jsx shot chart exactly.

export interface CourtZone {
  id: string;
  label: string;
  makePct: number;
  pts: 2 | 3;
  color: string;
  poly: string; // SVG points "x1,y1 x2,y2 ..."
  edu: string;
}

export const ZONES: CourtZone[] = [
  {
    id: "paint",
    label: "Paint",
    makePct: 0.62,
    pts: 2,
    color: "#552583",
    poly: "170,108 290,108 290,258 170,258",
    edu: "High efficiency zone. Close proximity makes this a high percentage shot despite heavy interior defense.",
  },
  {
    id: "left-mid",
    label: "Left Mid",
    makePct: 0.42,
    pts: 2,
    color: "#166534",
    poly: "44,108 170,108 170,258 44,258",
    edu: "Lower efficiency. Mid-range jump shots analytically yield fewer points per possession.",
  },
  {
    id: "right-mid",
    label: "Right Mid",
    makePct: 0.42,
    pts: 2,
    color: "#166534",
    poly: "290,108 416,108 416,258 290,258",
    edu: "Lower efficiency. Mid-range jump shots analytically yield fewer points per possession.",
  },
  {
    id: "left-corner-3",
    label: "Left Corner 3",
    makePct: 0.39,
    pts: 3,
    color: "#1e40af",
    poly: "0,178 44,178 44,258 0,258",
    edu: "Most valuable shot analytically. Shorter distance (22ft) to the basket than other 3-pointers.",
  },
  {
    id: "right-corner-3",
    label: "Right Corner 3",
    makePct: 0.39,
    pts: 3,
    color: "#1e40af",
    poly: "416,178 460,178 460,258 416,258",
    edu: "Most valuable shot analytically. Shorter distance (22ft) to the basket than other 3-pointers.",
  },
  {
    id: "left-wing-3",
    label: "Left Wing 3",
    makePct: 0.35,
    pts: 3,
    color: "#1d4ed8",
    poly: "0,12 230,12 170,108 44,108 44,178 0,178",
    edu: "Standard 3pt range. Essential for spacing the floor and opening driving lanes.",
  },
  {
    id: "right-wing-3",
    label: "Right Wing 3",
    makePct: 0.35,
    pts: 3,
    color: "#1d4ed8",
    poly: "230,12 460,12 460,178 416,178 416,108 290,108",
    edu: "Standard 3pt range. Essential for spacing the floor and opening driving lanes.",
  },
  {
    id: "top-of-key",
    label: "Top of Key",
    makePct: 0.40,
    pts: 2,
    color: "#166534",
    poly: "170,108 290,108 230,12",
    edu: "Often the result of a pick and pop or an isolation play. High traffic area.",
  },
];

export const ZONE_IDS = ZONES.map((z) => z.id);

function parsePoly(poly: string): [number, number][] {
  return poly.split(" ").map((p) => {
    const [x, y] = p.split(",").map(Number);
    return [x, y];
  });
}

function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findZoneAt(x: number, y: number): CourtZone | null {
  for (const z of ZONES) {
    if (pointInPolygon(x, y, parsePoly(z.poly))) return z;
  }
  return null;
}
