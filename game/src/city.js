// The city of Tanjung Kaca: its road grid, blocks, buildings, park, beach and
// harbour, generated once from a seed, plus the collision helpers the world uses.
// Nothing here knows about missions or police; it only describes the place.

import { BEACH_Y, ROADS_H, ROADS_V, ROAD_W, WATER_Y, WORLD } from './config.js';

const BUILDING_COLOURS = ['#d9a06b', '#c98d7a', '#a8b8c8', '#d8c08a', '#b08a9e', '#8fb0a0', '#e0b56a', '#9aa78f'];
const ROOF_COLOURS = ['#8a5a3b', '#6e4a3a', '#5d6b7a', '#7a6a4a', '#6b4a5a'];

/** The block of streets between two neighbouring roads (or the map edge). */
function blockBands(roads) {
  const bands = [];
  let low = 70;
  for (const centre of roads) {
    bands.push([low, centre - ROAD_W / 2 - 24]);
    low = centre + ROAD_W / 2 + 24;
  }
  bands.push([low, WORLD.width - 70]);
  return bands;
}

export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const containers = [];
  const lamps = [];

  const vBands = blockBands(ROADS_V);
  const hBands = blockBands(ROADS_H);
  // The park occupies the block between the 1600 and 2200 roads, rows 400-1000.
  const park = { x: vBands[2][0], y: hBands[0][0], w: vBands[2][1] - vBands[2][0], h: hBands[0][1] - hBands[0][0] };
  // The harbour occupies the far east strip, rows 400-1000.
  const harbour = { x: 3180, y: 340, w: WORLD.width - 3250, h: 700 };

  for (let vi = 0; vi < vBands.length; vi += 1) {
    for (let hi = 0; hi < hBands.length; hi += 1) {
      const [x0, x1] = vBands[vi];
      const [y0, y1] = hBands[hi];
      if (y1 > BEACH_Y - 40) continue; // the beach strip stays open
      if (vi === 2 && hi === 0) continue; // the park
      if (x0 > 3100) continue; // the harbour strip
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 140 || bh < 140) continue;
      const count = 3 + Math.floor(random() * 2);
      for (let n = 0; n < count; n += 1) {
        const w = 130 + random() * Math.min(240, bw - 150);
        const h = 110 + random() * Math.min(200, bh - 130);
        const x = x0 + 10 + random() * Math.max(1, bw - w - 20);
        const y = y0 + 10 + random() * Math.max(1, bh - h - 20);
        const colour = BUILDING_COLOURS[Math.floor(random() * BUILDING_COLOURS.length)];
        const roof = ROOF_COLOURS[Math.floor(random() * ROOF_COLOURS.length)];
        const b = { x, y, w, h, colour, roof, floors: 1 + Math.floor(random() * 4), sign: random() < 0.3 };
        // Keep buildings from overlapping each other in the same block.
        if (buildings.some((o) => o.x < b.x + b.w + 18 && o.x + o.w + 18 > b.x && o.y < b.y + b.h + 18 && o.y + o.h + 18 > b.y)) continue;
        buildings.push(b);
      }
    }
  }

  // Park trees and a pond.
  const pond = { x: park.x + park.w * 0.55, y: park.y + park.h * 0.55, rx: 110, ry: 70 };
  for (let i = 0; i < 26; i += 1) {
    const x = park.x + 30 + random() * (park.w - 60);
    const y = park.y + 30 + random() * (park.h - 60);
    if (Math.hypot((x - pond.x) / pond.rx, (y - pond.y) / pond.ry) < 1.2) continue;
    trees.push({ x, y, r: 16 + random() * 10, palm: false });
  }
  // Palms along the beach boardwalk.
  for (let x = 120; x < WORLD.width - 100; x += 130 + random() * 90) {
    trees.push({ x, y: BEACH_Y - 40 + random() * 20, r: 14, palm: true });
  }
  // Street trees on sidewalks.
  for (const cx of ROADS_V) {
    for (const cy of ROADS_H) {
      if (random() < 0.8) trees.push({ x: cx + ROAD_W / 2 + 26, y: cy - 90 + random() * 40, r: 13, palm: false });
      if (random() < 0.8) trees.push({ x: cx - ROAD_W / 2 - 26, y: cy + 60 + random() * 40, r: 13, palm: false });
    }
  }
  // A few trees inside the blocks, between the buildings.
  for (let i = 0; i < 30; i += 1) {
    const x = 120 + random() * (WORLD.width - 240);
    const y = 120 + random() * (BEACH_Y - 300);
    if (isOnRoad(x, y)) continue;
    if (overlapsBuilding(x, y, 30, buildings)) continue;
    trees.push({ x, y, r: 12 + random() * 8, palm: random() < 0.2 });
  }
  // Harbour containers.
  const containerColours = ['#b8542e', '#2e6b8a', '#7a8a2e', '#8a2e5a', '#3a7a5a'];
  for (let i = 0; i < 10; i += 1) {
    containers.push({
      x: harbour.x + 20 + (i % 5) * 62,
      y: harbour.y + 30 + Math.floor(i / 5) * 90,
      w: 54,
      h: 76,
      colour: containerColours[i % containerColours.length],
    });
  }
  // Lamp posts at intersections.
  for (const cx of ROADS_V) {
    for (const cy of ROADS_H) lamps.push({ x: cx + ROAD_W / 2 + 8, y: cy - ROAD_W / 2 - 8 });
  }

  // Named places the missions use (all on or beside roads, never inside a building).
  const places = {
    cafe: { x: 940, y: 700, label: 'Kafe Senja' },
    garage: { x: 700, y: 1900, label: 'Bengkel Pak Darma' },
    kiosk: { x: 1060, y: 1860, label: 'Kios Emas' },
    gunShop: { x: 940, y: 2140, label: 'Toko Senjata' },
    pier: { x: 3350, y: 2280, label: 'Dermaga' },
    sportCar: { x: 2500, y: 430, label: 'Mobil Sport' },
    hospital: { x: 700, y: 700, label: 'Rumah Sakit' },
    taxiStand: { x: 1600, y: 1300, label: 'Pangkalan' },
  };

  return { buildings, trees, containers, lamps, park, pond, harbour, places };
}

/** True when the point is on a road (including the sidewalk edge). */
export function isOnRoad(x, y) {
  for (const cx of ROADS_V) if (Math.abs(x - cx) <= ROAD_W / 2 + 14) return true;
  for (const cy of ROADS_H) if (Math.abs(y - cy) <= ROAD_W / 2 + 14) return true;
  return false;
}

/** A random point on a road, for spawning traffic and police. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    const cx = ROADS_V[Math.floor(random() * ROADS_V.length)];
    return { x: cx + (random() - 0.5) * (ROAD_W - 40), y: 100 + random() * (BEACH_Y - 260) };
  }
  const cy = ROADS_H[Math.floor(random() * ROADS_H.length)];
  return { x: 100 + random() * (WORLD.width - 200), y: cy + (random() - 0.5) * (ROAD_W - 40) };
}

/** A random point on a sidewalk, for spawning pedestrians. */
export function randomSidewalkPoint(random) {
  const p = randomRoadPoint(random);
  const onVertical = ROADS_V.some((cx) => Math.abs(p.x - cx) < ROAD_W / 2);
  if (onVertical) return { x: p.x + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 22), y: p.y };
  return { x: p.x, y: p.y + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 22) };
}

/** Push a circle out of every building it overlaps; returns true if it hit one. */
export function collideBuildings(entity, radius, buildings) {
  let hit = false;
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(entity.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(entity.y, b.y + b.h));
    const dx = entity.x - cx;
    const dy = entity.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 < 0.0001) {
      entity.y = b.y - radius;
      continue;
    }
    const d = Math.sqrt(d2);
    entity.x = cx + (dx / d) * radius;
    entity.y = cy + (dy / d) * radius;
  }
  return hit;
}

/** True when the circle overlaps any building. */
export function overlapsBuilding(x, y, radius, buildings) {
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < radius * radius) return true;
  }
  return false;
}

/** The water blocks movement; the sand only slows it. */
export function inWater(x, y) {
  return y >= WATER_Y;
}
export function onSand(x, y) {
  return y >= BEACH_Y && y < WATER_Y;
}
