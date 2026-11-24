// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play, paused
// and game over, with a dialog box on top whenever a character speaks.
//
// ?seed=N fixes the city. ?shot=start|onfoot|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_MISSION_DONE, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_QUIT, ACTION_RESTART_MISSION, ACTION_SAVE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

// Any uncaught error is surfaced on the title so a screenshot run can see it.
window.addEventListener('error', (event) => {
  window.__gameError = String(event.message || event.error || 'unknown error');
  document.title = `shot-error: ${window.__gameError}`;
});

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      document.title = 'shot-ready';
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const state = world.state;
  let screen = SCREEN_TITLE;
  let best = readBest();
  let hasSave = world.loadSave() !== null;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  /** The mouse position in world coordinates, for aiming. */
  function aimWorld() {
    const mouse = input.mouse();
    const ratio = window.devicePixelRatio || 1;
    const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    const ox = (window.innerWidth - 1280 * scale) / 2;
    const oy = (window.innerHeight - 720 * scale) / 2;
    const vx = (mouse.x / ratio - ox) / scale;
    const vy = (mouse.y / ratio - oy) / scale;
    return { x: vx + state.camera.x, y: vy + state.camera.y };
  }

  function beginMission(index) {
    const intro = world.startMission(index);
    state.dialog = { lines: intro, index: 0 };
    announce('Misi dimulai.');
  }

  function startNewGame() {
    audio.ensure();
    world.reset();
    best = readBest();
    screen = SCREEN_PLAY;
    world.save();
    beginMission(0);
    announce('Bermain. Temui Rani di Kafe Senja.');
  }

  function continueGame() {
    const data = world.loadSave();
    if (!data) {
      startNewGame();
      return;
    }
    audio.ensure();
    world.reset();
    world.applySave(data);
    screen = SCREEN_PLAY;
    const next = state.pendingMission;
    if (next !== null && next < 8) beginMission(next);
    announce('Permainan dilanjutkan.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (state.player.money > best) {
      best = state.player.money;
      saveBest(best);
    }
    announce(`Wasted. Uang $${state.player.money}. Tekan Enter untuk bangkit lagi.`);
  }

  function retryAfterWasted() {
    const data = world.loadSave();
    world.reset();
    if (data) {
      world.applySave(data);
      state.player.hp = 100;
      state.player.money = Math.floor(state.player.money * 0.9);
    }
    screen = SCREEN_PLAY;
    const next = state.pendingMission;
    if (next !== null && next < 8) beginMission(next);
    announce('Kamu bangkit lagi di rumah sakit.');
  }

  function advanceDialog() {
    const dialog = state.dialog;
    if (!dialog) return false;
    dialog.index += 1;
    audio.click();
    if (dialog.index >= dialog.lines.length) {
      state.dialog = null;
      const next = state.pendingMission;
      if (next !== null && next < 8 && !state.mission.active) {
        state.pendingMission = null;
        beginMission(next);
      }
    }
    return true;
  }

  // Actions are taken once per frame and shared: the screen handler consumes
  // confirm/pause/menu keys, the world consumes interact/punch/weapon bits.
  let frameActions = 0;

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Suara mati.' : 'Suara hidup.');
    }
    if (state.dialog) {
      if (actions & ACTION_CONFIRM) advanceDialog();
      return;
    }
    if (screen === SCREEN_TITLE && actions & ACTION_CONFIRM) startNewGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) retryAfterWasted();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Bermain.');
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_SAVE) {
        const ok = world.save();
        announce(ok ? 'Permainan disimpan.' : 'Gagal menyimpan.');
      } else if (actions & ACTION_RESTART_MISSION) {
        const index = state.mission.active ? state.mission.index : (state.pendingMission ?? 0);
        world.startMission(index);
        screen = SCREEN_PLAY;
        announce('Misi diulang.');
      } else if (actions & ACTION_QUIT) {
        screen = SCREEN_TITLE;
        hasSave = world.loadSave() !== null;
        announce('Kembali ke judul.');
      }
    }
    // Continue from the title with C (handled via a keydown listener below).
  }

  // C on the title screen continues a saved game.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && screen === SCREEN_TITLE && !event.repeat) {
      if (world.loadSave()) continueGame();
    }
  });

  function step() {
    if (screen !== SCREEN_PLAY || state.dialog) return;
    const aim = aimWorld();
    state.aimX = aim.x;
    state.aimY = aim.y;
    const events = world.step(STEP, {
      move: input.move(),
      actions: frameActions,
      mouseDown: input.mouse().down,
    });
    if (events & EVENT_MISSION_DONE) {
      audio.missionDone();
      world.save();
      if (state.player.money > best) {
        best = state.player.money;
        saveBest(best);
      }
    } else if (events & EVENT_WASTED) {
      audio.explosion();
      endGame();
    }
    // Shooting and driving sounds follow the state every frame.
    const car = state.player.inCar ? state.cars.find((c) => c.id === state.player.inCar) : null;
    audio.update(state.wanted.stars, Boolean(car), car ? Math.abs(car.speed) / 560 : 0);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    frameActions = input.takeActions();
    handleActions(frameActions);
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY && !state.dialog) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    state.hasSave = hasSave;
    renderer.draw(state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Tanjung Kaca. Tekan Enter untuk bermain, C untuk lanjutkan.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
