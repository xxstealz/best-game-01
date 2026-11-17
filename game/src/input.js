// Keyboard and pointer input. Held keys give a movement vector and a fire state;
// one-shot presses (confirm, pause, restart, mute, upgrade choices) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost and
// never counted twice. The mouse aim is reported in the game's logical coordinates.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_CHOICE_1 = 16;
export const ACTION_CHOICE_2 = 32;
export const ACTION_CHOICE_3 = 64;
export const ACTION_CONTINUE = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);
const CHOICE_1 = new Set(['Digit1', 'Numpad1']);
const CHOICE_2 = new Set(['Digit2', 'Numpad2']);
const CHOICE_3 = new Set(['Digit3', 'Numpad3']);
const CONTINUE = new Set(['KeyC']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, space: false };
  let actions = 0;
  let mouseX = FIELD.width / 2;
  let mouseY = FIELD.height / 2 - 120;
  let mouseDown = false;
  let click = null;

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * FIELD.width,
      y: ((clientY - rect.top) / rect.height) * FIELD.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      keys.space = true;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (CHOICE_1.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CHOICE_1;
    } else if (CHOICE_2.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CHOICE_2;
    } else if (CHOICE_3.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CHOICE_3;
    } else if (CONTINUE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONTINUE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (CONFIRM.has(event.code)) keys.space = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = keys.space = false;
    mouseDown = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const p = toLogical(event.clientX, event.clientY);
    mouseX = p.x;
    mouseY = p.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = toLogical(event.clientX, event.clientY);
    mouseX = p.x;
    mouseY = p.y;
    mouseDown = true;
    click = p;
    actions |= ACTION_CONFIRM;
    event.preventDefault();
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  return {
    /** The controls the world steps with: movement, aim, firing and one-shot actions. */
    controls() {
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      const len = Math.hypot(x, y) || 1;
      return {
        move: { x: x / len, y: y / len },
        aim: { x: mouseX, y: mouseY },
        firing: mouseDown || keys.space,
        actions: this.takeActions(),
        click: this.takeClick(),
      };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
