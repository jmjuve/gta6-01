// LOWTIDE — tide.js
// One clear job: the living tide. A sine cycle between low and high
// water; everything else (driving, police, missions, HUD, minimap) reads
// this one value. The tide is the game's verb.

import { WORLD } from './config.js';

export function createTide() {
  let time = 0; // seconds since the session started
  let phase = 0.35; // start mid-rising so the first minute already floods
  let speed = 1; // time scale; missions can hold the tide still

  function level() {
    // 0 = low water, 1 = high water. Sine eases at both ends, like a real tide.
    const s = Math.sin(phase * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
    return s;
  }

  function waterY() {
    return WORLD.tideLow + level() * (WORLD.tideHigh - WORLD.tideLow);
  }

  function update(dt) {
    time += dt;
    phase = (phase + (dt / WORLD.tidePeriodSec) * speed) % 1;
  }

  return {
    update,
    get time() { return time; },
    get level() { return level(); },
    get waterY() { return waterY(); },
    // Is a given street (ground height 0) under water right now?
    get streetsFlooded() { return waterY() > WORLD.floodStreetsAt; },
    get floodDepth() { return Math.max(0, waterY() - WORLD.floodStreetsAt); },
    // Cars stall when the water is this deep over the street.
    get carsStall() { return waterY() > WORLD.stallWaterAt; },
    // Seconds until the next high / low water, for the HUD gauge.
    get secondsToHigh() {
      const p = (0.5 - phase + 1) % 1;
      return Math.round(p * WORLD.tidePeriodSec);
    },
    get secondsToLow() {
      const p = (1 - phase + 1) % 1;
      return Math.round(p * WORLD.tidePeriodSec);
    },
    get rising() {
      // derivative of the sine: rising while phase in (0, 0.5)
      return phase > 0 && phase < 0.5;
    },
    // Missions and screenshots set the tide directly.
    setLevel(v) {
      const clamped = Math.max(0, Math.min(1, v));
      // invert the sine: s = sin(p*2π - π/2)*0.5+0.5 → pick the rising branch
      phase = (Math.asin(clamped * 2 - 1) + Math.PI / 2) / (Math.PI * 2);
    },
    hold() { speed = 0; },
    release() { speed = 1; },
    setTimeScale(s) { speed = s; },
  };
}
