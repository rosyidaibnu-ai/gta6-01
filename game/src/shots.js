// The screenshot scenes behind ?shot=start|onfoot|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (walk or drive toward the mission target), so the frame
// is what a short game really looks like and the same seed always gives the
// same frame. Nothing is drawn by hand: the scenes are the game itself.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { move: { x: 0, y: 0 }, actions: 0, mouseDown: false };

function stepFor(world, seconds, input) {
  const state = world.state;
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, input);
    state.dialog = null;
  }
}

/** Drive or walk toward a point, in world coordinates. */
function moveToward(state, tx, ty) {
  const dx = tx - state.player.x;
  const dy = ty - state.player.y;
  const len = Math.hypot(dx, dy) || 1;
  return { move: { x: dx / len, y: dy / len }, actions: 0, mouseDown: false };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best money to show. Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'onfoot') {
    // Mission one, on foot near the cafe, with the city alive around the player.
    // The player starts far enough out that the mission is still in progress.
    world.startMission(0);
    state.player.x = 500;
    state.player.y = 1000;
    state.dialog = null;
    for (let i = 0; i < 1.2 / STEP; i += 1) {
      world.step(STEP, moveToward(state, 940, 700));
      state.dialog = null;
    }
    return { screen: SCREEN_PLAY, best: 120 };
  }
  if (name === 'chase') {
    // Four stars, a stolen sports car, police behind and a helicopter above.
    // Mission five is active: get chased, then lose them.
    world.startMission(4);
    const sport = state.cars.find((c) => c.kind === 'sport');
    sport.x = 1600;
    sport.y = 2000;
    sport.angle = -Math.PI / 2;
    sport.speed = 380;
    sport.parked = false;
    sport.playerOwned = true;
    state.player.inCar = sport.id;
    state.player.x = sport.x;
    state.player.y = sport.y;
    state.wanted.stars = 4;
    state.wanted.hideTimer = 0;
    state.dialog = null;
    for (let i = 0; i < 2.5 / STEP; i += 1) {
      world.step(STEP, { move: { x: 0, y: -1 }, actions: 0, mouseDown: false });
      state.dialog = null;
    }
    return { screen: SCREEN_PLAY, best: 120 };
  }
  if (name === 'mission') {
    // Mission three: the red sports car is the target, the player closes in.
    world.startMission(2);
    state.player.x = 2320;
    state.player.y = 560;
    state.dialog = null;
    for (let i = 0; i < 2.5 / STEP; i += 1) {
      world.step(STEP, moveToward(state, 2500, 430));
      state.dialog = null;
    }
    return { screen: SCREEN_PLAY, best: 120 };
  }
  // Title: five seconds of the city living behind the menu.
  stepFor(world, 5, IDLE);
  return { screen: SCREEN_TITLE, best: 120 };
}
