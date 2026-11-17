// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, upgrade, paused, game over
// and victory.
//
// ?seed=N fixes the run's random pattern. ?shot=start|play|boss|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { readBest, saveBest } from './storage.js';
import {
  createWorld, startRun, stepWorld, chooseUpgrade, continueEndless,
  EVENT_OVER, EVENT_UPGRADE, EVENT_VICTORY,
} from './world.js';
import {
  ACTION_CHOICE_1, ACTION_CHOICE_2, ACTION_CHOICE_3, ACTION_CONFIRM,
  ACTION_CONTINUE, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
  SCREEN_UPGRADE, SCREEN_VICTORY,
} from './render.js';
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

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  // Sounds the simulation queued this step, played in order.
  function drainSfx() {
    for (const name of world.sfx) {
      const fn = audio[name];
      if (typeof fn === 'function') fn();
    }
    world.sfx.length = 0;
  }

  function startGame() {
    audio.unlock();
    startRun(world);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Wave 1. Hold the light.');
  }

  function endGame() {
    world.mode = 'over';
    screen = SCREEN_OVER;
    if (world.score > best) {
      best = world.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.score}. Best ${best}.`);
  }

  function winGame() {
    world.mode = 'victory';
    screen = SCREEN_VICTORY;
    if (world.score > best) {
      best = world.score;
      saveBest(best);
    }
    announce(`Victory. Score ${world.score}. Best ${best}.`);
  }

  function handleControls(controls) {
    const actions = controls.actions;
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_RESTART) {
        startGame();
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_RESTART) {
        startGame();
      }
    } else if (screen === SCREEN_UPGRADE) {
      let choice = -1;
      if (actions & ACTION_CHOICE_1) choice = 0;
      else if (actions & ACTION_CHOICE_2) choice = 1;
      else if (actions & ACTION_CHOICE_3) choice = 2;
      else if (controls.click) choice = renderer.cardAt(controls.click.x, controls.click.y);
      if (choice >= 0 && chooseUpgrade(world, choice)) {
        screen = SCREEN_PLAY;
        announce(`Wave ${world.wave}.`);
      }
    } else if (screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startGame();
    } else if (screen === SCREEN_VICTORY) {
      if (actions & ACTION_CONTINUE) {
        continueEndless(world);
        screen = SCREEN_PLAY;
        announce(`Endless. Wave ${world.wave}.`);
      } else if (actions & (ACTION_CONFIRM | ACTION_RESTART)) {
        startGame();
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const controls = input.controls();
    handleControls(controls);
    if (screen !== SCREEN_PAUSED) {
      while (accumulator >= STEP) {
        stepWorld(world, screen === SCREEN_TITLE ? null : controls, STEP);
        accumulator -= STEP;
        if (world.events & EVENT_OVER) {
          endGame();
          break;
        }
        if (world.events & EVENT_VICTORY) {
          winGame();
          break;
        }
        if (world.events & EVENT_UPGRADE) {
          screen = SCREEN_UPGRADE;
          announce(`Wave ${world.wave} cleared. Choose an upgrade.`);
        }
      }
    } else {
      accumulator = 0;
    }
    drainSfx();
    audio.setIntensity(Math.min(1, world.wave / 8));
    audio.update();
    renderer.draw(world, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting shadows close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberward. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
