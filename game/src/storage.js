// The best score and the mute choice, kept in localStorage between visits.
// Every access is guarded: private windows and disabled storage just mean the best
// score lasts this visit only, and the game never throws over it.

import { BEST_KEY, MUTE_KEY } from './config.js';

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

export function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted) {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Nothing to do: the choice just lasts this visit.
  }
}
