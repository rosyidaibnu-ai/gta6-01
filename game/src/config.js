// Every tuning number and colour in one place. The world is a fixed 3600x2600 logical
// area: a sun-soaked coastal city, Tanjung Kaca, with a road grid, a beach and a
// harbour. The renderer scales the 1280x720 view to the window, so no rule below
// depends on the screen size.

export const WORLD = { width: 3600, height: 2600 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const ROADS_V = [400, 1000, 1600, 2200, 2800];
export const ROADS_H = [400, 1000, 1600, 2200];
export const ROAD_W = 120;

/** The beach strip and the water line, in world y. */
export const BEACH_Y = 2350;
export const WATER_Y = 2490;

export const PLAYER = {
  radius: 16,
  walkSpeed: 230,
  runSpeed: 320,
  accel: 1800,
  hp: 100,
  punchDamage: 25,
  punchRange: 52,
  punchArc: 1.1,
};

export const CAR = {
  length: 66,
  width: 32,
  radius: 30,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  turnRate: 2.6,
  hp: 100,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 25, cooldown: 0.35, range: 52, auto: false },
  pistol: { name: 'Pistol', damage: 26, cooldown: 0.28, range: 520, auto: false, ammo: Infinity },
  shotgun: { name: 'Shotgun', damage: 16, pellets: 6, cooldown: 0.8, range: 320, auto: false, ammo: 24 },
  smg: { name: 'SMG', damage: 13, cooldown: 0.09, range: 460, auto: true, ammo: 120 },
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 7,
  policePerStar: [0, 1, 2, 3, 4, 4],
  heliAtStars: 4,
  roadblockAtStars: 3,
};

export const PALETTE = {
  grass: '#8fb45e',
  grassDark: '#7da34f',
  park: '#6fae52',
  sand: '#e8cf96',
  water: '#2e7f9e',
  waterDeep: '#1f5f7d',
  road: '#3c4149',
  roadEdge: '#565d68',
  sidewalk: '#b9b3a4',
  lane: '#e8c95a',
  buildingRoof: '#c98d5f',
  text: '#f4f1e6',
  muted: '#cfc9b8',
  hudPanel: 'rgba(12, 16, 22, 0.72)',
  player: '#19b5a6',
  playerDark: '#0e7d72',
  police: '#e8eef4',
  policeStripe: '#1d4ed8',
  taxi: '#f2c230',
  marker: '#ffd23f',
  health: '#58d164',
  danger: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save game is kept between visits (this browser only). */
export const SAVE_KEY = 'tanjung-kaca.save.v1';
export const BEST_KEY = 'tanjung-kaca.best';
