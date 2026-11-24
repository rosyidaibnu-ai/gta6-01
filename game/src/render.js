// Drawing only: the world's state and the current screen in, pixels out. The
// camera follows the player across the 3600x2600 city; the 1280x720 view is
// scaled to fit the window. Flat shapes and canvas text: buildings, roads, the
// beach and harbour, cars, people, the HUD with its minimap, and the menus.

import { BEACH_Y, CAR, FONT, PALETTE, ROADS_H, ROADS_V, ROAD_W, WATER_Y, WEAPONS, WORLD } from './config.js';
import { currentStep, missionObjectiveText } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const VIEW_W = 1280;
const VIEW_H = 720;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_W, height / VIEW_H);
    view.x = (width - VIEW_W * view.scale) / 2;
    view.y = (height - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function plainText(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(`p${size}`)) fonts.set(`p${size}`, `${size}px ${FONT}`);
    context.font = fonts.get(`p${size}`);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawGround(state) {
    const city = state.city;
    const cam = state.camera;
    const x0 = Math.max(0, cam.x - 80);
    const y0 = Math.max(0, cam.y - 80);
    const x1 = Math.min(WORLD.width, cam.x + VIEW_W + 80);
    const y1 = Math.min(WORLD.height, cam.y + VIEW_H + 80);

    // Grass base, then the beach and the sea.
    context.fillStyle = PALETTE.grass;
    context.fillRect(x0, y0, x1 - x0, y1 - y0);
    context.fillStyle = PALETTE.sand;
    context.fillRect(x0, Math.max(y0, BEACH_Y), x1 - x0, Math.max(0, Math.min(y1, WATER_Y) - Math.max(y0, BEACH_Y)));
    context.fillStyle = PALETTE.water;
    context.fillRect(x0, Math.max(y0, WATER_Y), x1 - x0, Math.max(0, y1 - Math.max(y0, WATER_Y)));
    // Gentle waves on the water line.
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      context.beginPath();
      for (let x = x0; x <= x1; x += 40) {
        const y = WATER_Y + 14 + i * 26 + Math.sin((x + state.time * 40 + i * 90) / 90) * 5;
        if (x === x0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
    // The park.
    context.fillStyle = PALETTE.park;
    context.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
    context.fillStyle = '#3f8fb5';
    context.beginPath();
    context.ellipse(city.pond.x, city.pond.y, city.pond.rx, city.pond.ry, 0, 0, Math.PI * 2);
    context.fill();

    // Roads: asphalt, sidewalks, centre dashes, crosswalks.
    for (const cx of ROADS_V) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(cx - ROAD_W / 2 - 14, y0, ROAD_W + 28, y1 - y0);
      context.fillStyle = PALETTE.road;
      context.fillRect(cx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    }
    for (const cy of ROADS_H) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(x0, cy - ROAD_W / 2 - 14, x1 - x0, ROAD_W + 28);
      context.fillStyle = PALETTE.road;
      context.fillRect(x0, cy - ROAD_W / 2, x1 - x0, ROAD_W);
    }
    context.strokeStyle = PALETTE.lane;
    context.lineWidth = 3;
    context.setLineDash([26, 22]);
    for (const cx of ROADS_V) {
      context.beginPath();
      context.moveTo(cx, y0);
      context.lineTo(cx, y1);
      context.stroke();
    }
    for (const cy of ROADS_H) {
      context.beginPath();
      context.moveTo(x0, cy);
      context.lineTo(x1, cy);
      context.stroke();
    }
    context.setLineDash([]);
    // Crosswalks at every intersection.
    context.fillStyle = 'rgba(255,255,255,0.75)';
    for (const cx of ROADS_V) {
      for (const cy of ROADS_H) {
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(cx + i * 16 - 5, cy - ROAD_W / 2 + 8, 10, 18);
          context.fillRect(cx + i * 16 - 5, cy + ROAD_W / 2 - 26, 10, 18);
        }
      }
    }
    // Harbour docks and containers.
    context.fillStyle = '#8a6a4a';
    context.fillRect(city.harbour.x, city.harbour.y, city.harbour.w, city.harbour.h);
    context.strokeStyle = '#6a4a30';
    context.lineWidth = 3;
    for (let y = city.harbour.y + 20; y < city.harbour.y + city.harbour.h; y += 30) {
      context.beginPath();
      context.moveTo(city.harbour.x, y);
      context.lineTo(city.harbour.x + city.harbour.w, y);
      context.stroke();
    }
    for (const c of city.containers) {
      context.fillStyle = c.colour;
      context.fillRect(c.x, c.y, c.w, c.h);
      context.strokeStyle = 'rgba(0,0,0,0.3)';
      context.lineWidth = 2;
      context.strokeRect(c.x, c.y, c.w, c.h);
    }
    // Boardwalk along the beach.
    context.fillStyle = '#b09a78';
    context.fillRect(x0, BEACH_Y - 26, x1 - x0, 26);
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      if (b.x > state.camera.x + VIEW_W + 60 || b.x + b.w < state.camera.x - 60
        || b.y > state.camera.y + VIEW_H + 60 || b.y + b.h < state.camera.y - 60) continue;
      // Soft shadow, then the block and its roof.
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.colour;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x, b.y, b.w, Math.min(18, b.h * 0.2));
      // Windows.
      context.fillStyle = 'rgba(255,244,200,0.85)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 40));
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          context.fillRect(b.x + 12 + c * 34, b.y + 28 + r * 40, 16, 20);
        }
      }
      if (b.sign) {
        context.fillStyle = '#2e4a6b';
        context.fillRect(b.x + b.w / 2 - 34, b.y + b.h - 26, 68, 18);
        plainText('TOKO', b.x + b.w / 2, b.y + b.h - 12, 12, '#ffd23f', 'center');
      }
    }
    // Trees and palms.
    for (const t of state.city.trees) {
      if (t.x < state.camera.x - 40 || t.x > state.camera.x + VIEW_W + 40
        || t.y < state.camera.y - 40 || t.y > state.camera.y + VIEW_H + 40) continue;
      context.fillStyle = '#6a4a30';
      context.fillRect(t.x - 2, t.y - 4, 4, 14);
      context.fillStyle = t.palm ? '#5aa84f' : '#3f8a3a';
      context.beginPath();
      context.arc(t.x, t.y - 8, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.15)';
      context.beginPath();
      context.arc(t.x - t.r / 3, t.y - 8 - t.r / 3, t.r / 2, 0, Math.PI * 2);
      context.fill();
    }
    // Lamp posts.
    context.fillStyle = '#3a3f47';
    for (const lamp of state.city.lamps) {
      if (lamp.x < state.camera.x - 20 || lamp.x > state.camera.x + VIEW_W + 20
        || lamp.y < state.camera.y - 20 || lamp.y > state.camera.y + VIEW_H + 20) continue;
      context.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    }
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const halfL = CAR.length / 2;
    const halfW = CAR.width / 2;
    // Wheels.
    context.fillStyle = '#14161a';
    context.fillRect(-halfL + 8, -halfW - 3, 14, 6);
    context.fillRect(-halfL + 8, halfW - 3, 14, 6);
    context.fillRect(halfL - 22, -halfW - 3, 14, 6);
    context.fillRect(halfL - 22, halfW - 3, 14, 6);
    // Body.
    context.fillStyle = car.colour;
    roundRect(-halfL, -halfW, CAR.length, CAR.width, 9);
    context.fill();
    // Windshield and roof.
    context.fillStyle = 'rgba(20,30,44,0.85)';
    context.fillRect(halfL - 26, -halfW + 5, 12, CAR.width - 10);
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(-8, -halfW + 4, 20, CAR.width - 8);
    if (car.kind === 'taxi') {
      context.fillStyle = '#14161a';
      for (let i = 0; i < 5; i += 1) context.fillRect(-14 + i * 8, -halfW + 2, 5, 5);
      plainText('TAXI', 0, -halfW - 6, 10, '#14161a', 'center');
    }
    if (car.kind === 'sport') {
      context.fillStyle = '#ffd23f';
      context.fillRect(-halfL + 4, -3, 10, 6);
    }
    if (car.police) {
      context.fillStyle = '#1d4ed8';
      context.fillRect(-10, -halfW, 16, CAR.width);
      plainText('POLISI', 0, -halfW - 6, 10, '#1d4ed8', 'center');
      // Flashing light bar.
      const on = Math.floor(time * 3 + car.sirenPhase) % 2 === 0;
      context.fillStyle = on ? '#ff3b30' : '#2f7bff';
      context.fillRect(-6, -halfW - 2, 7, 5);
      context.fillStyle = on ? '#2f7bff' : '#ff3b30';
      context.fillRect(1, -halfW - 2, 7, 5);
    }
    // Damage smoke.
    if (car.hp < 40) {
      context.fillStyle = 'rgba(90,95,102,0.5)';
      context.beginPath();
      context.arc(-halfL + 6, 0, 8 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    // Health bar over a damaged car.
    if (car.hp < CAR.hp && car.hp > 0) {
      context.fillStyle = 'rgba(0,0,0,0.5)';
      context.fillRect(car.x - 26, car.y - 30, 52, 6);
      context.fillStyle = car.hp > 50 ? '#58d164' : '#e5534b';
      context.fillRect(car.x - 25, car.y - 29, 50 * (car.hp / CAR.hp), 4);
    }
  }

  function drawPed(pd) {
    const bob = Math.sin(pd.walkPhase) * 2;
    context.save();
    context.translate(pd.x, pd.y + bob * 0.3);
    context.rotate(pd.angle);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.2)';
    context.beginPath();
    context.ellipse(0, 8, 12, 5, 0, 0, Math.PI * 2);
    context.fill();
    // Body and head.
    context.fillStyle = pd.cop ? '#1d4ed8' : pd.colour;
    roundRect(-9, -8, 18, 20, 6);
    context.fill();
    context.fillStyle = '#e8c39a';
    context.beginPath();
    context.arc(12, 0, 7, 0, Math.PI * 2);
    context.fill();
    if (pd.cop) {
      context.fillStyle = '#0e2a6b';
      context.fillRect(8, -7, 8, 14);
    }
    context.restore();
    if (pd.hp < 40 && pd.hp > 0) {
      context.fillStyle = 'rgba(0,0,0,0.5)';
      context.fillRect(pd.x - 14, pd.y - 24, 28, 4);
      context.fillStyle = '#e5534b';
      context.fillRect(pd.x - 13, pd.y - 23, 26 * (pd.hp / 40), 2);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.hp <= 0) return;
    if (p.inCar) return; // the car drawing carries the driver
    context.save();
    context.translate(p.x, p.y);
    context.rotate(p.angle);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(0, 10, 14, 6, 0, 0, Math.PI * 2);
    context.fill();
    // Body: teal jacket, dark trousers, facing the aim.
    context.fillStyle = PALETTE.playerDark;
    roundRect(-10, -8, 16, 16, 5);
    context.fill();
    context.fillStyle = PALETTE.player;
    roundRect(-10, -8, 16, 10, 5);
    context.fill();
    context.fillStyle = '#e8c39a';
    context.beginPath();
    context.arc(12, 0, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2b2b2b';
    context.beginPath();
    context.arc(11, -3, 7, Math.PI, Math.PI * 2);
    context.fill();
    // The gun in hand, when armed.
    if (p.weapon !== 'fists') {
      context.fillStyle = '#22252b';
      context.fillRect(14, -2, 16, 4);
    }
    context.restore();
    // Direction tick so the facing reads at a glance.
    context.strokeStyle = 'rgba(255,255,255,0.7)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
    context.lineTo(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30);
    context.stroke();
  }

  function drawMarker(state) {
    const step = currentStep(state);
    let target = null;
    let label = '';
    if (state.sideJob.active) {
      target = { x: state.sideJob.x, y: state.sideJob.y };
      label = 'PAKET';
    } else if (step) {
      if (step.kind === 'race') {
        const cp = step.checkpoints[state.mission.checkpoint];
        if (cp) {
          target = cp;
          label = `TITIK ${state.mission.checkpoint + 1}`;
        }
      } else if (step.x !== undefined) {
        target = { x: step.x, y: step.y };
        label = step.kind === 'steal' ? 'MOBIL' : 'TUJUAN';
      }
    }
    if (!target) return;
    const p = state.player;
    const dist = Math.round(Math.hypot(target.x - p.x, target.y - p.y));
    // A beam of light and a bouncing diamond over the target.
    const bounce = Math.sin(state.time * 4) * 8;
    context.fillStyle = 'rgba(255,210,63,0.18)';
    context.fillRect(target.x - 14, target.y - 120, 28, 120);
    context.save();
    context.translate(target.x, target.y - 46 + bounce);
    context.rotate(Math.PI / 4);
    context.fillStyle = PALETTE.marker;
    context.fillRect(-11, -11, 22, 22);
    context.restore();
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(target.x, target.y, 34, 14, 0, 0, Math.PI * 2);
    context.stroke();
    text(`${label} · ${dist}m`, target.x, target.y - 66 + bounce, 15, '#ffffff', 'center');
    // An edge arrow when the target is off screen.
    const cam = state.camera;
    if (target.x < cam.x || target.x > cam.x + VIEW_W || target.y < cam.y || target.y > cam.y + VIEW_H) {
      const ax = clamp(target.x, cam.x + 40, cam.x + VIEW_W - 40);
      const ay = clamp(target.y, cam.y + 40, cam.y + VIEW_H - 40);
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      context.save();
      context.translate(ax, ay);
      context.rotate(a);
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-10, -12);
      context.lineTo(-10, 12);
      context.closePath();
      context.fill();
      context.restore();
      text(`${dist}m`, ax, ay - 18, 13, '#ffffff', 'center');
    }
  }

  function drawHelicopter(state) {
    const heli = state.heli;
    if (!heli) return;
    // Spotlight cone on the player.
    const p = state.player;
    const grad = context.createRadialGradient(p.x, p.y, 10, p.x, p.y, 150);
    grad.addColorStop(0, 'rgba(255,244,180,0.35)');
    grad.addColorStop(1, 'rgba(255,244,180,0)');
    context.fillStyle = grad;
    context.beginPath();
    context.arc(p.x, p.y, 150, 0, Math.PI * 2);
    context.fill();
    context.save();
    context.translate(heli.x, heli.y);
    context.rotate(heli.angle);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(6, 8, 36, 15, 0, 0, Math.PI * 2);
    context.fill();
    // Tail boom and fin, so it reads as a helicopter, not a car.
    context.fillStyle = '#16357a';
    context.fillRect(-58, -4, 32, 8);
    context.fillRect(-62, -14, 6, 18);
    context.fillStyle = '#1d4ed8';
    roundRect(-30, -12, 60, 24, 10);
    context.fill();
    context.fillStyle = '#bcd8ff';
    context.fillRect(12, -8, 12, 16);
    context.strokeStyle = '#22252b';
    context.lineWidth = 3;
    const rotor = state.time * 22;
    context.beginPath();
    context.moveTo(Math.cos(rotor) * 48, Math.sin(rotor) * 48);
    context.lineTo(-Math.cos(rotor) * 48, -Math.sin(rotor) * 48);
    context.stroke();
    context.beginPath();
    context.moveTo(Math.cos(rotor + Math.PI / 2) * 48, Math.sin(rotor + Math.PI / 2) * 48);
    context.lineTo(-Math.cos(rotor + Math.PI / 2) * 48, -Math.sin(rotor + Math.PI / 2) * 48);
    context.stroke();
    context.restore();
    text('POLISI UDARA', heli.x, heli.y - 40, 13, '#ffffff', 'center');
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      context.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      context.fillStyle = pt.colour;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      if (pk.timer > 0) continue;
      const bob = Math.sin(state.time * 3 + pk.x) * 4;
      context.save();
      context.translate(pk.x, pk.y + bob);
      context.fillStyle = pk.kind === 'health' ? '#ffffff' : '#ffd23f';
      roundRect(-14, -14, 28, 28, 6);
      context.fill();
      context.strokeStyle = pk.kind === 'health' ? '#e5534b' : '#8a6a00';
      context.lineWidth = 2;
      context.strokeRect(-14, -14, 28, 28);
      if (pk.kind === 'health') {
        context.fillStyle = '#e5534b';
        context.fillRect(-3, -9, 6, 18);
        context.fillRect(-9, -3, 18, 6);
      } else {
        text('12', 0, 5, 13, '#8a6a00', 'center');
      }
      context.restore();
    }
    // Named places get small labels.
    const places = state.city.places;
    plainText('Kafe Senja', places.cafe.x, places.cafe.y - 40, 13, '#ffffff', 'center');
    plainText('Bengkel', places.garage.x, places.garage.y - 40, 13, '#ffffff', 'center');
    plainText('Kios Emas', places.kiosk.x, places.kiosk.y - 40, 13, '#ffffff', 'center');
    plainText('Toko Senjata', places.gunShop.x, places.gunShop.y - 40, 13, '#ffffff', 'center');
    plainText('Dermaga', places.pier.x, places.pier.y - 40, 13, '#ffffff', 'center');
    plainText('Pangkalan', places.taxiStand.x, places.taxiStand.y - 40, 13, '#ffffff', 'center');
  }

  function drawWorld(state) {
    context.save();
    context.translate(-state.camera.x, -state.camera.y);
    drawGround(state);
    drawBuildings(state);
    drawPickups(state);
    drawMarker(state);
    for (const car of state.cars) drawCar(car, state.time);
    for (const pd of state.peds) drawPed(pd);
    drawPlayer(state);
    drawHelicopter(state);
    drawParticles(state);
    context.restore();
    // Warm sunset wash over the whole scene.
    const wash = context.createLinearGradient(0, 0, 0, VIEW_H);
    wash.addColorStop(0, 'rgba(255,170,80,0.07)');
    wash.addColorStop(1, 'rgba(255,120,60,0.12)');
    context.fillStyle = wash;
    context.fillRect(0, 0, VIEW_W, VIEW_H);
    // Hurt flash.
    if (state.hurtTimer > 0) {
      context.fillStyle = `rgba(229,83,75,${0.22 * (state.hurtTimer / 0.6)})`;
      context.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function drawMinimap(state) {
    const mw = 200;
    const mh = 144;
    const mx = VIEW_W - mw - 16;
    const my = 64;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.fillStyle = PALETTE.hudPanel;
    roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8);
    context.fill();
    context.save();
    context.beginPath();
    context.rect(mx, my, mw, mh);
    context.clip();
    context.fillStyle = '#7da34f';
    context.fillRect(mx, my, mw, mh);
    context.fillStyle = '#2e7f9e';
    context.fillRect(mx, my + WATER_Y * sy, mw, mh - WATER_Y * sy);
    context.fillStyle = '#e8cf96';
    context.fillRect(mx, my + BEACH_Y * sy, mw, (WATER_Y - BEACH_Y) * sy);
    context.fillStyle = '#6fae52';
    const park = state.city.park;
    context.fillRect(mx + park.x * sx, my + park.y * sy, park.w * sx, park.h * sy);
    context.strokeStyle = '#3c4149';
    context.lineWidth = 3;
    for (const cx of ROADS_V) {
      context.beginPath();
      context.moveTo(mx + cx * sx, my);
      context.lineTo(mx + cx * sx, my + mh);
      context.stroke();
    }
    for (const cy of ROADS_H) {
      context.beginPath();
      context.moveTo(mx, my + cy * sy);
      context.lineTo(mx + mw, my + cy * sy);
      context.stroke();
    }
    context.fillStyle = 'rgba(60,60,60,0.5)';
    for (const b of state.city.buildings) {
      context.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    }
    const step = currentStep(state);
    if (step && step.x !== undefined) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(mx + step.x * sx, my + step.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    if (state.sideJob.active) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(mx + state.sideJob.x * sx, my + state.sideJob.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (!car.police) continue;
      context.fillStyle = '#ff3b30';
      context.beginPath();
      context.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    const p = state.player;
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#11141b';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(mx + p.x * sx, my + p.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
    plainText('TANJUNG KACA', mx + mw / 2, my + mh + 22, 11, PALETTE.muted, 'center');
  }

  function drawHud(state) {
    const p = state.player;
    // Top-left: health bar, money, weapon.
    context.fillStyle = PALETTE.hudPanel;
    roundRect(12, 12, 250, 64, 10);
    context.fill();
    text('HP', 26, 34, 15, PALETTE.text, 'left');
    context.fillStyle = '#22252b';
    roundRect(58, 22, 190, 16, 6);
    context.fill();
    context.fillStyle = p.hp > 50 ? '#58d164' : p.hp > 25 ? '#e8c95a' : '#e5534b';
    roundRect(59, 23, 188 * clamp(p.hp / 100, 0, 1), 14, 5);
    context.fill();
    text(`$${p.money}`, 26, 64, 20, '#ffd23f', 'left');
    const weapon = WEAPONS[p.weapon];
    const ammo = p.weapon === 'pistol' || p.weapon === 'fists' ? '∞' : String(p.ammo[p.weapon] ?? 0);
    plainText(`${weapon.name} · ${ammo}`, 150, 64, 15, PALETTE.text, 'left');
    // Wanted stars, top-right above the minimap.
    const starX = VIEW_W - 230;
    for (let i = 0; i < 5; i += 1) {
      const filled = i < state.wanted.stars;
      context.fillStyle = filled ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      context.font = '28px sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'top';
      context.fillText('★', starX + i * 32, 14);
    }
    plainText(state.wanted.stars > 0 ? 'DICARI POLISI' : 'TANJUNG KACA', starX, 48, 12, state.wanted.stars > 0 ? '#ff8a7a' : PALETTE.muted, 'left');
    drawMinimap(state);
    // Objective bar, top-centre.
    const objective = missionObjectiveText(state);
    const ow = Math.min(760, 24 + objective.length * 8.4);
    context.fillStyle = PALETTE.hudPanel;
    roundRect((VIEW_W - ow) / 2, 12, ow, 34, 10);
    context.fill();
    plainText(objective, VIEW_W / 2, 34, 15, '#ffffff', 'center', 'middle');
    // Speed, bottom-right, when driving.
    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.inCar);
      const kmh = car ? Math.round(Math.abs(car.speed) * 0.24) : 0;
      context.fillStyle = PALETTE.hudPanel;
      roundRect(VIEW_W - 170, VIEW_H - 66, 158, 54, 10);
      context.fill();
      text(`${kmh}`, VIEW_W - 96, VIEW_H - 26, 30, '#ffffff', 'center');
      plainText('km/h', VIEW_W - 40, VIEW_H - 26, 13, PALETTE.muted, 'center');
      if (car) {
        context.fillStyle = '#22252b';
        roundRect(VIEW_W - 158, VIEW_H - 76, 134, 8, 4);
        context.fill();
        context.fillStyle = car.hp > 50 ? '#58d164' : '#e5534b';
        roundRect(VIEW_W - 157, VIEW_H - 75, 132 * clamp(car.hp / 100, 0, 1), 6, 3);
        context.fill();
      }
    }
    // Contextual prompt, bottom-centre.
    if (state.prompt) {
      plainText(state.prompt, VIEW_W / 2, VIEW_H - 18, 15, '#ffffff', 'center');
    }
    // Toast, above the prompt.
    if (state.toast) {
      context.fillStyle = PALETTE.hudPanel;
      const tw = 24 + state.toast.length * 7.6;
      roundRect((VIEW_W - tw) / 2, VIEW_H - 96, tw, 30, 8);
      context.fill();
      plainText(state.toast, VIEW_W / 2, VIEW_H - 76, 14, '#ffd23f', 'center');
    }
    // Mission banner, centre.
    if (state.banner) {
      context.fillStyle = 'rgba(12,16,22,0.85)';
      const bw = 40 + state.banner.length * 10;
      roundRect((VIEW_W - bw) / 2, 96, bw, 46, 10);
      context.fill();
      text(state.banner, VIEW_W / 2, 128, 22, '#ffd23f', 'center');
    }
    // Dialog box, bottom.
    if (state.dialog) {
      const line = state.dialog.lines[state.dialog.index];
      context.fillStyle = 'rgba(10,12,18,0.88)';
      roundRect(140, VIEW_H - 190, VIEW_W - 280, 110, 12);
      context.fill();
      context.strokeStyle = '#ffd23f';
      context.lineWidth = 2;
      roundRect(140, VIEW_H - 190, VIEW_W - 280, 110, 12);
      context.stroke();
      plainText(line, VIEW_W / 2, VIEW_H - 138, 17, '#ffffff', 'center');
      plainText('Spasi / klik — lanjut', VIEW_W / 2, VIEW_H - 100, 13, PALETTE.muted, 'center');
    }
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 32 + 70;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = 'rgba(10,14,20,0.88)';
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = '#ffd23f';
    context.lineWidth = 2;
    roundRect(x, y, width, height, 14);
    context.stroke();
    text(title, VIEW_W / 2, y + 66, 44, '#ffd23f', 'center');
    lines.forEach((line, i) => {
      plainText(line, VIEW_W / 2, y + 118 + i * 32, 18, PALETTE.muted, 'center');
    });
    text(prompt, VIEW_W / 2, y + height - 34, 20, '#ffffff', 'center');
  }

  function drawTitle(state, best) {
    drawWorld(state);
    context.fillStyle = 'rgba(10,14,20,0.55)';
    context.fillRect(0, 0, VIEW_W, VIEW_H);
    text('TANJUNG KACA', VIEW_W / 2, 170, 72, '#ffd23f', 'center');
    plainText('Kota pesisir. Delapan misi. Satu nama yang harus diingat.', VIEW_W / 2, 210, 20, '#ffffff', 'center');
    plainText('Sebuah game open-world orisinal — jalan kaki, curi mobil, kabur dari polisi.', VIEW_W / 2, 244, 16, PALETTE.muted, 'center');
    const lines = [
      'WASD / panah — bergerak & mengemudi    E — masuk / curi mobil    F — pukul',
      'Klik mouse — tembak    Q — ganti senjata    P — jeda    K — simpan    M — bisu',
      `Misi selesai: ${state.stats.missionsDone} · Uang terbaik: $${best}`,
    ];
    lines.forEach((line, i) => {
      plainText(line, VIEW_W / 2, 330 + i * 30, 16, PALETTE.text, 'center');
    });
    text('Tekan ENTER untuk bermain', VIEW_W / 2, 480, 24, '#ffffff', 'center');
    if (best > 0 || state.hasSave) plainText('C — lanjutkan permainan tersimpan', VIEW_W / 2, 516, 16, '#ffd23f', 'center');
    plainText('Kota, karakter dan cerita orisinal. Bukan dari game komersial mana pun.', VIEW_W / 2, 640, 13, PALETTE.muted, 'center');
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0e1420';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawWorld(state);
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(10,14,20,0.55)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel('Jeda', [
        'P / Esc — lanjut bermain',
        'K — simpan permainan',
        'R — ulangi misi ini',
        'T — kembali ke layar judul',
      ], 'P untuk lanjut');
    } else if (screen === SCREEN_OVER) {
      context.fillStyle = 'rgba(20,4,4,0.45)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel('WASTED', [
        `Kamu tertangkap di Tanjung Kaca.`,
        `Misi selesai: ${state.stats.missionsDone} · Uang: $${state.player.money}`,
      ], 'Tekan ENTER untuk bangkit lagi');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
