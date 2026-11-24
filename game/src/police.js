// The police response: patrol cars spawn to match the wanted level, chase the
// player with simple pursuit steering, ram to stop them, set roadblocks at three
// stars and bring a helicopter at four. Nothing here decides the wanted level —
// the world does that when the player commits a crime or hides long enough.

import { CAR, WANTED } from './config.js';
import { collideBuildings, randomRoadPoint } from './city.js';

function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Spawn one police car on a road some distance from the player. */
function spawnPoliceCar(state) {
  const p = state.player;
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 12; tries += 1) {
    const pt = randomRoadPoint(state.random);
    const d = Math.hypot(pt.x - p.x, pt.y - p.y);
    if (d > 500 && d < 1100) {
      x = pt.x;
      y = pt.y;
      break;
    }
    x = pt.x;
    y = pt.y;
  }
  return {
    id: state.nextCarId++,
    kind: 'police',
    x,
    y,
    angle: angleTo(x, y, p.x, p.y),
    speed: 0,
    hp: CAR.hp,
    police: true,
    parked: false,
    driver: null,
    colour: '#e8eef4',
    sirenPhase: state.random() * Math.PI * 2,
  };
}

/** Park two police cars across the road ahead of the player. */
function setRoadblock(state) {
  const p = state.player;
  const ahead = p.inCar ? state.cars.find((c) => c.id === p.inCar) : null;
  const heading = ahead ? ahead.angle : p.angle;
  const cx = p.x + Math.cos(heading) * 420;
  const cy = p.y + Math.sin(heading) * 420;
  const perp = heading + Math.PI / 2;
  state.roadblock = { x: cx, y: cy, until: state.time + 25 };
  for (const side of [-1, 1]) {
    state.cars.push({
      id: state.nextCarId++,
      kind: 'police',
      x: cx + Math.cos(perp) * side * 42,
      y: cy + Math.sin(perp) * side * 42,
      angle: perp,
      speed: 0,
      hp: CAR.hp,
      police: true,
      parked: true,
      roadblock: true,
      driver: null,
      colour: '#e8eef4',
      sirenPhase: 0,
    });
  }
}

export function updatePolice(state, dt) {
  const stars = state.wanted.stars;
  const p = state.player;

  // Keep the number of chasing cars matched to the wanted level.
  const chasers = state.cars.filter((c) => c.police && !c.roadblock);
  const want = WANTED.policePerStar[Math.min(stars, WANTED.maxStars)];
  if (chasers.length < want && stars > 0) {
    state.cars.push(spawnPoliceCar(state));
  } else if (chasers.length > want) {
    // Drop the farthest chaser when the heat falls.
    let far = null;
    let farD = 0;
    for (const c of chasers) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d > farD) {
        farD = d;
        far = c;
      }
    }
    if (far && farD > 900) state.cars.splice(state.cars.indexOf(far), 1);
  }

  // Roadblocks at three stars, refreshed while the chase lasts.
  if (stars >= WANTED.roadblockAtStars && (!state.roadblock || state.time > state.roadblock.until)) {
    setRoadblock(state);
  }
  if (stars < WANTED.roadblockAtStars) {
    state.cars = state.cars.filter((c) => !c.roadblock);
    state.roadblock = null;
  }

  // Helicopter at four stars: it hovers over the player and never lands.
  if (stars >= WANTED.heliAtStars) {
    if (!state.heli) state.heli = { x: p.x, y: p.y - 200, angle: 0 };
    state.heli.x += (p.x - state.heli.x) * Math.min(1, dt * 2.6);
    state.heli.y += (p.y - state.heli.y) * Math.min(1, dt * 2.6);
    state.heli.angle += dt * 0.6;
  } else {
    state.heli = null;
  }

  // Chase: steer toward a point just ahead of the player and ram them.
  for (const car of state.cars) {
    if (!car.police || car.roadblock) continue;
    const targetX = p.x + (p.vx || 0) * 0.4;
    const targetY = p.y + (p.vy || 0) * 0.4;
    const wantAngle = angleTo(car.x, car.y, targetX, targetY);
    const diff = angleDiff(wantAngle, car.angle);
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    const dist = Math.hypot(targetX - car.x, targetY - car.y);
    const targetSpeed = dist > 120 ? 520 : 300;
    car.speed += Math.max(-CAR.brake * dt, Math.min(CAR.accel * dt, targetSpeed - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Police cars go around buildings, never through them.
    if (collideBuildings(car, 30, state.city.buildings)) car.speed *= 0.5;
    car.sirenPhase += dt * 6;
  }

  // Cops on foot appear at two stars and shoot at the player.
  const footCops = state.peds.filter((pd) => pd.cop);
  if (stars >= 2 && footCops.length < 2) {
    const pt = randomRoadPoint(state.random);
    state.peds.push({
      x: Math.max(60, Math.min(3540, p.x + (state.random() < 0.5 ? -1 : 1) * (260 + state.random() * 120))),
      y: Math.max(60, Math.min(2540, p.y + (state.random() < 0.5 ? -1 : 1) * (260 + state.random() * 120))),
      angle: 0,
      speed: 0,
      hp: 60,
      cop: true,
      colour: '#1d4ed8',
      shootTimer: 1 + state.random(),
      targetX: pt.x,
      targetY: pt.y,
      flee: false,
    });
  }
  if (stars === 0) {
    state.peds = state.peds.filter((pd) => !pd.cop);
  }
}
