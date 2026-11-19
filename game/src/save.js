// LOWTIDE — save.js
// One clear job: localStorage save / load. Cash, cars, missions,
// collectibles — the progression the title screen's Continue button reads.

import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    cash: 150,
    health: 100,
    missionsDone: [],
    ownedCars: ['sedan'],
    ownedBoats: ['skiff'],
    upgrades: [],
    charts: 0,
    bestWanted: 0,
    playSeconds: 0,
    createdAt: Date.now(),
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return { ...defaultSave(), ...data };
  } catch (_) {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      cash: state.cash,
      health: state.health,
      missionsDone: state.missionsDone,
      ownedCars: state.ownedCars,
      ownedBoats: state.ownedBoats,
      upgrades: state.upgrades,
      charts: state.charts,
      bestWanted: state.bestWanted,
      playSeconds: state.playSeconds,
      createdAt: state.createdAt || Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (_) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ }
}
