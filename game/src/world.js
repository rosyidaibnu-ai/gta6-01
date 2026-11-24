// The living world: the player on foot and in cars, traffic, pedestrians, crime
// and the wanted level, combat, pickups, the mission engine and the side job.
// One fixed step advances everything; the renderer only paints the state.

import { BEACH_Y, CAR, PLAYER, ROADS_H, ROADS_V, ROAD_W, SAVE_KEY, WATER_Y, WEAPONS, WORLD } from './config.js';
import { buildCity, collideBuildings, onSand, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { MISSIONS, SIDE_JOB_REWARD, startMission, startSideJob, updateMission, updateSideJob } from './missions.js';
import { updatePolice } from './police.js';

export const EVENT_WASTED = 1;
export const EVENT_MISSION_DONE = 2;
export const EVENT_MISSION_FAIL = 4;

const TRAFFIC_COLOURS = ['#c94f42', '#4f7ec9', '#e8e4d8', '#5a5f66', '#7a9e4f', '#c9a24f', '#8a5a9e'];
const PED_COLOURS = ['#e8b04f', '#7ab8e8', '#e87ab0', '#9ed07a', '#d08a5a', '#b08ae8', '#e8e8e8'];

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = {
    random,
    time: 0,
    city: null,
    player: null,
    cars: [],
    peds: [],
    particles: [],
    pickups: [],
    wanted: { stars: 0, hideTimer: 0 },
    mission: { index: 0, step: 0, timer: 0, robTimer: 0, wantedPhase: 0, checkpoint: 0, targetCarId: null, active: false },
    sideJob: { active: false, x: 0, y: 0, label: '' },
    camera: { x: 0, y: 0 },
    heli: null,
    roadblock: null,
    nextCarId: 1,
    dialog: null,
    banner: null,
    bannerTimer: 0,
    toast: null,
    toastTimer: 0,
    prompt: '',
    aimX: 0,
    aimY: 0,
    shootCooldown: 0,
    punchCooldown: 0,
    hurtTimer: 0,
    ramTimer: 0,
    pendingMission: null,
    stats: { shots: 0, hits: 0, carsStolen: 0, missionsDone: 0, moneyEarned: 0 },
  };

  function spawnTrafficCar() {
    const pt = randomRoadPoint(random);
    const vertical = ROADS_V.some((cx) => Math.abs(pt.x - cx) < ROAD_W / 2);
    const axis = vertical ? 'v' : 'h';
    const dir = random() < 0.5 ? -1 : 1;
    const taxi = random() < 0.12;
    return {
      id: state.nextCarId++,
      kind: taxi ? 'taxi' : 'sedan',
      x: pt.x,
      y: pt.y,
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: 150 + random() * 110,
      hp: CAR.hp,
      police: false,
      parked: false,
      driver: true,
      colour: taxi ? '#f2c230' : TRAFFIC_COLOURS[Math.floor(random() * TRAFFIC_COLOURS.length)],
      axis,
      dir,
      tx: pt.x,
      ty: pt.y,
      cruise: 150 + random() * 110,
    };
  }

  function nextIntersection(car) {
    // Pick the next intersection along the grid from the car's current road.
    const cx = ROADS_V.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
    const cy = ROADS_H.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
    const options = [];
    const vi = ROADS_V.indexOf(cx);
    const hi = ROADS_H.indexOf(cy);
    if (hi > 0) options.push({ x: cx, y: ROADS_H[hi - 1], axis: 'v', dir: -1 });
    if (hi < ROADS_H.length - 1) options.push({ x: cx, y: ROADS_H[hi + 1], axis: 'v', dir: 1 });
    if (vi > 0) options.push({ x: ROADS_V[vi - 1], y: cy, axis: 'h', dir: -1 });
    if (vi < ROADS_V.length - 1) options.push({ x: ROADS_V[vi + 1], y: cy, axis: 'h', dir: 1 });
    // Prefer going straight most of the time.
    const straight = options.find((o) => o.axis === car.axis && o.dir === car.dir);
    if (straight && random() < 0.6) return straight;
    return options[Math.floor(random() * options.length)];
  }

  function spawnPed() {
    const pt = randomSidewalkPoint(random);
    return {
      x: pt.x,
      y: pt.y,
      angle: random() * Math.PI * 2,
      speed: 0,
      hp: 40,
      cop: false,
      colour: PED_COLOURS[Math.floor(random() * PED_COLOURS.length)],
      targetX: pt.x,
      targetY: pt.y,
      flee: false,
      fleeX: 0,
      fleeY: 0,
      shootTimer: 0,
      walkPhase: random() * 10,
    };
  }

  function addParticles(x, y, colour, count, speed, life = 0.7, size = 4) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const s = speed * (0.3 + random() * 0.7);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.5 + random() * 0.5),
        maxLife: life,
        colour,
        size: size * (0.6 + random() * 0.8),
      });
    }
  }

  function hurtPlayer(amount) {
    const p = state.player;
    if (state.hurtTimer > 0 || p.hp <= 0) return;
    p.hp -= amount;
    state.hurtTimer = 0.6;
    if (p.hp <= 0) p.hp = 0;
  }

  function explode(x, y) {
    addParticles(x, y, '#ff9a3d', 26, 260, 0.8, 6);
    addParticles(x, y, '#5a5f66', 18, 120, 1.4, 8);
    addParticles(x, y, '#ffd23f', 12, 340, 0.4, 5);
    const p = state.player;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < 160) hurtPlayer(Math.round(60 * (1 - d / 160)) + 10);
    for (const car of [...state.cars]) {
      const cd = Math.hypot(car.x - x, car.y - y);
      if (cd < 140 && cd > 1) damageCar(car, Math.round(70 * (1 - cd / 140)));
    }
  }

  function damageCar(car, amount) {
    if (car.hp <= 0) return;
    car.hp -= amount;
    if (car.hp <= 0) {
      car.hp = 0;
      explode(car.x, car.y);
      if (state.player.inCar === car.id) {
        state.player.inCar = null;
        hurtPlayer(25);
        state.player.x = car.x + 50;
        state.player.y = car.y + 50;
      }
      const i = state.cars.indexOf(car);
      if (i >= 0) state.cars.splice(i, 1);
    }
  }

  function addWanted(stars) {
    state.wanted.stars = Math.min(5, state.wanted.stars + stars);
    state.wanted.hideTimer = 0;
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    const p = state.player;
    if (car.driver && !car.police) {
      // The driver bails out and runs.
      const driver = spawnPed();
      driver.x = car.x + 40;
      driver.y = car.y + 40;
      driver.flee = true;
      driver.fleeX = car.x;
      driver.fleeY = car.y;
      state.peds.push(driver);
      car.driver = false;
      addWanted(1);
      state.stats.carsStolen += 1;
      state.toast = 'Mobil dicuri! Polisi mengejarmu.';
      state.toastTimer = 3;
    } else if (car.police) {
      addWanted(2);
      state.toast = 'Kamu mencuri mobil polisi!';
      state.toastTimer = 3;
    }
    car.parked = false;
    car.playerOwned = true;
    p.inCar = car.id;
    p.x = car.x;
    p.y = car.y;
  }

  function exitCar() {
    const p = state.player;
    const car = state.cars.find((c) => c.id === p.inCar);
    if (!car) {
      p.inCar = null;
      return;
    }
    car.speed = 0;
    car.parked = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 46;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 46;
    p.inCar = null;
    p.vx = 0;
    p.vy = 0;
  }

  /** Distance along the ray (x1,y1)->(x2,y2) to the circle, or null. */
  function rayHit(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return null;
    let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const d2 = dist2(px, py, cx, cy);
    if (d2 > r * r) return null;
    return Math.sqrt(len2) * t;
  }

  function shoot() {
    const p = state.player;
    const weapon = WEAPONS[p.weapon];
    if (state.shootCooldown > 0 || p.hp <= 0) return;
    if (p.weapon !== 'pistol' && p.weapon !== 'fists') {
      if ((p.ammo[p.weapon] ?? 0) <= 0) {
        state.toast = `${weapon.name} kehabisan peluru! Beli di Toko Senjata.`;
        state.toastTimer = 2.5;
        state.shootCooldown = 0.3;
        return;
      }
      p.ammo[p.weapon] -= 1;
    }
    state.shootCooldown = weapon.cooldown;
    state.stats.shots += 1;
    const pellets = weapon.pellets ?? 1;
    for (let i = 0; i < pellets; i += 1) {
      const spread = (random() - 0.5) * 0.16;
      const angle = p.angle + spread;
      const range = weapon.range;
      const ex = p.x + Math.cos(angle) * range;
      const ey = p.y + Math.sin(angle) * range;
      let bestD = range;
      let bestTarget = null;
      let bestKind = '';
      for (const pd of state.peds) {
        const d = rayHit(p.x, p.y, ex, ey, pd.x, pd.y, 20);
        if (d !== null && d < bestD) {
          bestD = d;
          bestTarget = pd;
          bestKind = 'ped';
        }
      }
      for (const car of state.cars) {
        if (p.inCar === car.id) continue;
        const d = rayHit(p.x, p.y, ex, ey, car.x, car.y, 34);
        if (d !== null && d < bestD) {
          bestD = d;
          bestTarget = car;
          bestKind = 'car';
        }
      }
      const hx = p.x + Math.cos(angle) * bestD;
      const hy = p.y + Math.sin(angle) * bestD;
      addParticles(hx, hy, '#ffd23f', 3, 120, 0.25, 3);
      if (bestTarget) {
        state.stats.hits += 1;
        if (bestKind === 'ped') {
          bestTarget.hp -= weapon.damage;
          bestTarget.flee = true;
          bestTarget.fleeX = p.x;
          bestTarget.fleeY = p.y;
          if (bestTarget.hp <= 0) {
            addParticles(bestTarget.x, bestTarget.y, '#c94f42', 14, 180, 0.6, 4);
            const i = state.peds.indexOf(bestTarget);
            if (i >= 0) state.peds.splice(i, 1);
            addWanted(bestTarget.cop ? 2 : 1);
          }
        } else {
          damageCar(bestTarget, weapon.damage);
          addParticles(hx, hy, '#9aa0a8', 5, 140, 0.4, 3);
        }
      }
    }
    addParticles(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30, '#ffe9a0', 4, 90, 0.12, 5);
    for (const pd of state.peds) {
      if (!pd.cop && dist2(pd.x, pd.y, p.x, p.y) < 320 * 320) {
        pd.flee = true;
        pd.fleeX = p.x;
        pd.fleeY = p.y;
      }
    }
  }

  function punch() {
    const p = state.player;
    if (state.punchCooldown > 0 || p.hp <= 0) return;
    state.punchCooldown = WEAPONS.fists.cooldown;
    for (const pd of [...state.peds]) {
      const d = Math.hypot(pd.x - p.x, pd.y - p.y);
      if (d > PLAYER.punchRange) continue;
      const diff = Math.abs(angleDiff(Math.atan2(pd.y - p.y, pd.x - p.x), p.angle));
      if (diff > PLAYER.punchArc) continue;
      pd.hp -= PLAYER.punchDamage;
      pd.flee = true;
      pd.fleeX = p.x;
      pd.fleeY = p.y;
      addParticles(pd.x, pd.y, '#ffffff', 6, 160, 0.3, 3);
      if (pd.hp <= 0) {
        const i = state.peds.indexOf(pd);
        if (i >= 0) state.peds.splice(i, 1);
        addWanted(pd.cop ? 2 : 1);
      }
    }
    const car = nearestCar(p.x, p.y, 60);
    if (car && !p.inCar) damageCar(car, 8);
  }

  function buyWeapon() {
    const p = state.player;
    if (!p.weaponsOwned.includes('shotgun')) {
      if (p.money >= 300) {
        p.money -= 300;
        p.weaponsOwned.push('shotgun');
        p.ammo.shotgun = 24;
        state.toast = 'Shotgun dibeli! Q untuk ganti senjata.';
      } else {
        state.toast = 'Shotgun $300 — uangmu belum cukup.';
      }
    } else if (!p.weaponsOwned.includes('smg')) {
      if (p.money >= 600) {
        p.money -= 600;
        p.weaponsOwned.push('smg');
        p.ammo.smg = 120;
        state.toast = 'SMG dibeli! Q untuk ganti senjata.';
      } else {
        state.toast = 'SMG $600 — uangmu belum cukup.';
      }
    } else if (p.money >= 50) {
      p.money -= 50;
      p.ammo.shotgun = (p.ammo.shotgun ?? 0) + 12;
      p.ammo.smg = (p.ammo.smg ?? 0) + 60;
      state.toast = 'Peluru dibeli (+12 shotgun, +60 SMG).';
    } else {
      state.toast = 'Peluru $50 — uangmu belum cukup.';
    }
    state.toastTimer = 3;
  }

  function contextualPrompt() {
    const p = state.player;
    const city = state.city;
    if (p.inCar) return 'E — Keluar mobil · Klik — Tembak dari mobil';
    const car = nearestCar(p.x, p.y, 78);
    if (car) return car.police ? 'E — Curi mobil polisi (!)' : car.driver ? 'E — Curi mobil' : 'E — Masuk mobil';
    if (Math.hypot(p.x - city.places.gunShop.x, p.y - city.places.gunShop.y) < 80) {
      if (!p.weaponsOwned.includes('shotgun')) return 'E — Beli Shotgun ($300)';
      if (!p.weaponsOwned.includes('smg')) return 'E — Beli SMG ($600)';
      return 'E — Beli peluru ($50)';
    }
    if (Math.hypot(p.x - city.places.taxiStand.x, p.y - city.places.taxiStand.y) < 80) {
      return state.sideJob.active ? 'Antar paket ke penanda kuning' : 'E — Kerja antar paket (+$80)';
    }
    return 'WASD — Jalan · E — Interaksi · F — Pukul · Klik — Tembak · Q — Senjata';
  }

  function reset() {
    state.time = 0;
    state.city = buildCity(random);
    state.cars = [];
    state.peds = [];
    state.particles = [];
    state.pickups = [];
    state.wanted = { stars: 0, hideTimer: 0 };
    state.mission = { index: 0, step: 0, timer: 0, robTimer: 0, wantedPhase: 0, checkpoint: 0, targetCarId: null, active: false };
    state.sideJob = { active: false, x: 0, y: 0, label: '' };
    state.heli = null;
    state.roadblock = null;
    state.nextCarId = 1;
    state.dialog = null;
    state.banner = null;
    state.bannerTimer = 0;
    state.toast = null;
    state.toastTimer = 0;
    state.prompt = '';
    state.hurtTimer = 0;
    state.ramTimer = 0;
    state.pendingMission = null;
    state.stats = { shots: 0, hits: 0, carsStolen: 0, missionsDone: 0, moneyEarned: 0 };
    state.player = {
      x: 700, y: 700, angle: 0, vx: 0, vy: 0,
      hp: PLAYER.hp, money: 50, weapon: 'pistol',
      weaponsOwned: ['fists', 'pistol'], ammo: { shotgun: 0, smg: 0 },
      inCar: null,
    };
    for (let i = 0; i < 14; i += 1) state.cars.push(spawnTrafficCar());
    // The red sports car the third mission needs, parked on the north road.
    state.cars.push({
      id: state.nextCarId++, kind: 'sport', x: 2500, y: 430, angle: 0, speed: 0,
      hp: CAR.hp, police: false, parked: true, driver: false, colour: '#c92a2a',
      axis: 'h', dir: 1, tx: 2500, ty: 430, cruise: 0,
    });
    for (let i = 0; i < 4; i += 1) {
      const pt = randomRoadPoint(random);
      state.cars.push({
        id: state.nextCarId++, kind: 'sedan', x: pt.x, y: pt.y, angle: random() * Math.PI * 2, speed: 0,
        hp: CAR.hp, police: false, parked: true, driver: false,
        colour: TRAFFIC_COLOURS[Math.floor(random() * TRAFFIC_COLOURS.length)],
        axis: 'h', dir: 1, tx: pt.x, ty: pt.y, cruise: 0,
      });
    }
    for (let i = 0; i < 24; i += 1) state.peds.push(spawnPed());
    state.pickups.push({ kind: 'health', x: 760, y: 760, timer: 0 });
    state.pickups.push({ kind: 'shells', x: 1000, y: 2140, timer: 0 });
    state.pickups.push({ kind: 'health', x: 2200, y: 700, timer: 0 });
    state.camera.x = state.player.x - 640;
    state.camera.y = state.player.y - 360;
  }

  function step(dt, input) {
    const p = state.player;
    const city = state.city;
    state.time += dt;
    state.shootCooldown = Math.max(0, state.shootCooldown - dt);
    state.punchCooldown = Math.max(0, state.punchCooldown - dt);
    state.hurtTimer = Math.max(0, state.hurtTimer - dt);
    state.ramTimer = Math.max(0, state.ramTimer - dt);
    state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    state.toastTimer = Math.max(0, state.toastTimer - dt);
    if (state.bannerTimer === 0) state.banner = null;
    if (state.toastTimer === 0) state.toast = null;

    if (!p.inCar) p.angle = Math.atan2(state.aimY - p.y, state.aimX - p.x);

    // --- Player on foot ---
    if (!p.inCar) {
      const sand = onSand(p.x, p.y);
      const speed = 260 * (sand ? 0.6 : 1);
      p.vx += input.move.x * PLAYER.accel * dt;
      p.vy += input.move.y * PLAYER.accel * dt;
      const v = Math.hypot(p.vx, p.vy);
      if (v > speed) {
        p.vx = (p.vx / v) * speed;
        p.vy = (p.vy / v) * speed;
      }
      if (input.move.x === 0 && input.move.y === 0) {
        p.vx *= Math.max(0, 1 - 10 * dt);
        p.vy *= Math.max(0, 1 - 10 * dt);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = Math.max(30, Math.min(WORLD.width - 30, p.x));
      p.y = Math.max(30, Math.min(WATER_Y - 16, p.y));
      collideBuildings(p, PLAYER.radius, city.buildings);
      // The player cannot walk through a car: step around it.
      for (const car of state.cars) {
        const dx = p.x - car.x;
        const dy = p.y - car.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 42) {
          p.x = car.x + (dx / d) * 42;
          p.y = car.y + (dy / d) * 42;
        }
      }
      if (state.wanted.stars === 0 && p.hp > 0) p.hp = Math.min(PLAYER.hp, p.hp + 2 * dt);
    }

    // --- Player driving ---
    let playerCar = null;
    if (p.inCar) {
      playerCar = state.cars.find((c) => c.id === p.inCar);
      if (!playerCar) {
        p.inCar = null;
      } else {
        const sand = onSand(playerCar.x, playerCar.y);
        const maxSpeed = CAR.maxSpeed * (sand ? 0.55 : 1);
        const steer = input.move.x;
        const throttle = -input.move.y;
        if (throttle > 0) playerCar.speed += CAR.accel * dt;
        else if (throttle < 0) {
          if (playerCar.speed > 20) playerCar.speed -= CAR.brake * dt;
          else playerCar.speed -= CAR.reverseAccel * dt;
        } else {
          playerCar.speed *= Math.max(0, 1 - 0.8 * dt);
        }
        playerCar.speed = Math.max(-CAR.maxReverse, Math.min(maxSpeed, playerCar.speed));
        const steerAuthority = Math.min(1, Math.abs(playerCar.speed) / 120 + 0.25);
        playerCar.angle += steer * CAR.turnRate * steerAuthority * dt * Math.sign(playerCar.speed || 1);
        playerCar.x += Math.cos(playerCar.angle) * playerCar.speed * dt;
        playerCar.y += Math.sin(playerCar.angle) * playerCar.speed * dt;
        playerCar.x = Math.max(30, Math.min(WORLD.width - 30, playerCar.x));
        playerCar.y = Math.max(30, Math.min(WATER_Y - 20, playerCar.y));
        p.x = playerCar.x;
        p.y = playerCar.y;
        p.angle = playerCar.angle;
        p.vx = Math.cos(playerCar.angle) * playerCar.speed;
        p.vy = Math.sin(playerCar.angle) * playerCar.speed;
        if (collideBuildings(playerCar, CAR.radius, city.buildings)) {
          if (Math.abs(playerCar.speed) > 240) {
            damageCar(playerCar, Math.round((Math.abs(playerCar.speed) - 240) / 12));
            hurtPlayer(6);
          }
          playerCar.speed *= -0.25;
        }
      }
    }

    // --- Interact (E) ---
    if (input.actions & 4) {
      if (p.inCar) {
        exitCar();
      } else {
        const car = nearestCar(p.x, p.y, 78);
        const shop = city.places.gunShop;
        const stand = city.places.taxiStand;
        if (car) enterCar(car);
        else if (Math.hypot(p.x - shop.x, p.y - shop.y) < 80) buyWeapon();
        else if (Math.hypot(p.x - stand.x, p.y - stand.y) < 80 && !state.sideJob.active) {
          state.toast = startSideJob(state);
          state.toastTimer = 4;
        } else if (Math.hypot(p.x - stand.x, p.y - stand.y) < 80 && state.sideJob.active) {
          state.toast = 'Paket sudah di tangan — antar ke tujuan di peta.';
          state.toastTimer = 3;
        }
      }
    }
    if (input.actions & 8) punch();
    if (input.actions & 16) {
      const owned = p.weaponsOwned;
      const i = owned.indexOf(p.weapon);
      p.weapon = owned[(i + 1) % owned.length];
      state.toast = `Senjata: ${WEAPONS[p.weapon].name}`;
      state.toastTimer = 1.5;
    }
    if (input.mouseDown && !p.inCar) shoot();
    else if (input.mouseDown && p.inCar && p.weapon !== 'fists') shoot();

    // --- Traffic ---
    for (const car of state.cars) {
      if (car.police || car.parked || car.playerOwned) continue;
      const dTarget = Math.hypot(car.tx - car.x, car.ty - car.y);
      if (dTarget < 46) {
        const next = nextIntersection(car);
        car.tx = next.x;
        car.ty = next.y;
        car.axis = next.axis;
        car.dir = next.dir;
      }
      const wantAngle = Math.atan2(car.ty - car.y, car.tx - car.x);
      const diff = angleDiff(wantAngle, car.angle);
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      let ahead = false;
      for (const other of state.cars) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along > 0 && along < 80 && side < 40) {
          ahead = true;
          break;
        }
      }
      const targetSpeed = ahead ? 0 : car.cruise;
      car.speed += Math.max(-CAR.brake * dt, Math.min(CAR.accel * 0.5 * dt, targetSpeed - car.speed));
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
      car.y = Math.max(30, Math.min(WATER_Y - 20, car.y));
    }

    // --- Car-to-car collisions ---
    for (const car of state.cars) {
      if (car.dmgTimer > 0) car.dmgTimer -= dt;
    }
    for (let i = 0; i < state.cars.length; i += 1) {
      for (let j = i + 1; j < state.cars.length; j += 1) {
        const a = state.cars[i];
        const b = state.cars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = 58;
        if (d > 0.01 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const rel = Math.abs(a.speed - b.speed);
          // Crash damage, but only once per half second per car: a long
          // overlap is one crash, not a hundred.
          if (rel > 140 && ((a.dmgTimer ?? 0) <= 0 || (b.dmgTimer ?? 0) <= 0)) {
            damageCar(a, Math.round(rel / 40));
            damageCar(b, Math.round(rel / 40));
            a.dmgTimer = 0.6;
            b.dmgTimer = 0.6;
            addParticles((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffd23f', 4, 120, 0.3, 3);
          }
          if ((a.police && b === playerCar) || (b.police && a === playerCar)) {
            // A ram hurts, but only once a second: constant contact is not
            // constant damage.
            if (playerCar && state.ramTimer <= 0) {
              damageCar(playerCar, 6);
              hurtPlayer(4);
              state.ramTimer = 1;
            }
          }
        }
      }
    }

    // --- Pedestrians ---
    for (const pd of [...state.peds]) {
      pd.walkPhase += dt * 6;
      if (pd.cop) {
        const d = Math.hypot(p.x - pd.x, p.y - pd.y);
        if (d < 460) {
          pd.angle = Math.atan2(p.y - pd.y, p.x - pd.x);
          pd.shootTimer -= dt;
          if (pd.shootTimer <= 0 && p.hp > 0) {
            pd.shootTimer = 1.1 + random() * 0.7;
            if (random() < 0.55) {
              hurtPlayer(5);
              addParticles(p.x, p.y, '#ff6a5a', 4, 120, 0.3, 3);
            }
          }
          if (d > 140) {
            pd.x += Math.cos(pd.angle) * 150 * dt;
            pd.y += Math.sin(pd.angle) * 150 * dt;
          }
        }
        continue;
      }
      if (pd.flee) {
        const away = Math.atan2(pd.y - pd.fleeY, pd.x - pd.fleeX);
        pd.angle = away;
        pd.x += Math.cos(away) * 300 * dt;
        pd.y += Math.sin(away) * 300 * dt;
        if (dist2(pd.x, pd.y, pd.fleeX, pd.fleeY) > 500 * 500) pd.flee = false;
      } else {
        const d = Math.hypot(pd.targetX - pd.x, pd.targetY - pd.y);
        if (d < 30) {
          const pt = randomSidewalkPoint(random);
          pd.targetX = pt.x;
          pd.targetY = pt.y;
        }
        const a = Math.atan2(pd.targetY - pd.y, pd.targetX - pd.x);
        pd.angle = a;
        const speed = 55 + (pd.walkPhase % 1) * 10;
        pd.x += Math.cos(a) * speed * dt;
        pd.y += Math.sin(a) * speed * dt;
      }
      pd.x = Math.max(30, Math.min(WORLD.width - 30, pd.x));
      pd.y = Math.max(30, Math.min(WATER_Y - 16, pd.y));
      collideBuildings(pd, 14, city.buildings);
      for (const car of [...state.cars]) {
        if (Math.abs(car.speed) < 120) continue;
        if (dist2(pd.x, pd.y, car.x, car.y) < 34 * 34) {
          addParticles(pd.x, pd.y, '#c94f42', 10, 200, 0.5, 4);
          const i = state.peds.indexOf(pd);
          if (i >= 0) state.peds.splice(i, 1);
          if (car.playerOwned || car.id === p.inCar) addWanted(1);
          break;
        }
      }
    }
    while (state.peds.length < 22) state.peds.push(spawnPed());
    while (state.cars.filter((c) => !c.police && !c.parked).length < 12) state.cars.push(spawnTrafficCar());

    // --- Police ---
    updatePolice(state, dt);

    // --- Wanted decay: hide until no police can see you. ---
    const policeNear = state.cars.some((c) => c.police && dist2(c.x, c.y, p.x, p.y) < 520 * 520)
      || state.peds.some((pd) => pd.cop && dist2(pd.x, pd.y, p.x, p.y) < 460 * 460);
    if (state.wanted.stars > 0) {
      if (!policeNear) {
        state.wanted.hideTimer += dt;
        if (state.wanted.hideTimer >= 7) {
          state.wanted.stars -= 1;
          state.wanted.hideTimer = 0;
          if (state.wanted.stars === 0) {
            state.toast = 'Kamu lolos dari polisi.';
            state.toastTimer = 3;
          }
        }
      } else {
        state.wanted.hideTimer = 0;
      }
    }

    // --- Pickups ---
    for (const pk of state.pickups) {
      if (pk.timer > 0) {
        pk.timer -= dt;
        continue;
      }
      if (dist2(p.x, p.y, pk.x, pk.y) < 46 * 46) {
        if (pk.kind === 'health') {
          p.hp = Math.min(PLAYER.hp, p.hp + 40);
          state.toast = '+40 HP';
        } else {
          p.ammo.shotgun = (p.ammo.shotgun ?? 0) + 12;
          if (!p.weaponsOwned.includes('shotgun')) p.weaponsOwned.push('shotgun');
          state.toast = 'Shotgun didapat! (+12 peluru, Q untuk ganti senjata)';
        }
        state.toastTimer = 2.5;
        pk.timer = 30;
      }
    }

    // --- Particles ---
    for (const pt of [...state.particles]) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.max(0, 1 - 2 * dt);
      pt.vy *= Math.max(0, 1 - 2 * dt);
      if (pt.life <= 0) state.particles.splice(state.particles.indexOf(pt), 1);
    }

    // --- Missions and side job ---
    if (state.mission.active) {
      const result = updateMission(state, dt);
      if (result.completed) {
        const mission = MISSIONS[state.mission.index];
        p.money += mission.reward;
        state.stats.moneyEarned += mission.reward;
        state.stats.missionsDone += 1;
        state.banner = `Misi selesai: ${mission.title}  +$${mission.reward}`;
        state.bannerTimer = 4;
        state.dialog = { lines: mission.outro, index: 0 };
        const next = state.mission.index + 1;
        state.mission.index = next;
        state.mission.active = false;
        if (next < MISSIONS.length) state.pendingMission = next;
        return EVENT_MISSION_DONE;
      }
      if (result.failed) {
        state.toast = `${result.note} Misi diulang.`;
        state.toastTimer = 3;
        startMission(state, state.mission.index);
        return EVENT_MISSION_FAIL;
      }
    }
    if (state.sideJob.active && updateSideJob(state)) {
      p.money += SIDE_JOB_REWARD;
      state.stats.moneyEarned += SIDE_JOB_REWARD;
      state.banner = `Paket diantar!  +$${SIDE_JOB_REWARD}`;
      state.bannerTimer = 3;
    }

    state.prompt = contextualPrompt();

    // --- Camera ---
    const tx = Math.max(0, Math.min(WORLD.width - 1280, p.x - 640));
    const ty = Math.max(0, Math.min(WORLD.height - 720, p.y - 360));
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);

    if (p.hp <= 0) return EVENT_WASTED;
    return 0;
  }

  function save() {
    try {
      const p = state.player;
      const data = {
        money: p.money,
        missionIndex: state.mission.active ? state.mission.index : (state.pendingMission ?? state.mission.index),
        hp: p.hp,
        x: p.x,
        y: p.y,
        weaponsOwned: p.weaponsOwned,
        ammo: p.ammo,
        missionsDone: state.stats.missionsDone,
        moneyEarned: state.stats.moneyEarned,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function applySave(data) {
    const p = state.player;
    p.money = data.money ?? 50;
    p.hp = data.hp ?? PLAYER.hp;
    p.x = data.x ?? 700;
    p.y = data.y ?? 700;
    p.weaponsOwned = data.weaponsOwned ?? ['fists', 'pistol'];
    p.ammo = data.ammo ?? { shotgun: 0, smg: 0 };
    state.stats.missionsDone = data.missionsDone ?? 0;
    state.stats.moneyEarned = data.moneyEarned ?? 0;
    state.mission.index = data.missionIndex ?? 0;
    state.mission.active = false;
    state.pendingMission = state.mission.index;
    state.camera.x = Math.max(0, Math.min(WORLD.width - 1280, p.x - 640));
    state.camera.y = Math.max(0, Math.min(WORLD.height - 720, p.y - 360));
  }

  reset();

  return {
    state,
    reset,
    step,
    save,
    loadSave,
    applySave,
    startMission: (index) => startMission(state, index),
    addWanted,
    hurtPlayer,
  };
}
