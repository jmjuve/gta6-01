// LOWTIDE — missions.js
// One clear job: the story. Missions 1–3 from the blueprint, each an
// objective chain with a waypoint beacon, a briefing line and a payout.
// Side jobs (taxi, delivery) come from the job board.

import * as THREE from 'three';
import { MISSIONS, SAFEHOUSE } from './config.js';

export function createMissions(scene, hooks) {
  let active = null; // {def, stepIndex, sideJob}
  let beacon = null;
  let beaconRing = null;
  let completedCount = 0;

  function makeBeacon(x, z, color) {
    clearBeacon();
    beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: color || 0xffd27a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    beacon.position.set(x, 30, z);
    scene.add(beacon);
    beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(4, 6, 32),
      new THREE.MeshBasicMaterial({ color: color || 0xffd27a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.set(x, 0.15, z);
    scene.add(beaconRing);
  }

  function clearBeacon() {
    if (beacon) scene.remove(beacon);
    if (beaconRing) scene.remove(beaconRing);
    beacon = null; beaconRing = null;
  }

  function nextMissionDef(doneIds) {
    for (const m of MISSIONS) {
      if (!doneIds.includes(m.id)) return m;
    }
    return null;
  }

  function start(def, doneIds) {
    active = { def, stepIndex: 0, sideJob: null };
    const step = def.steps[0];
    if (step && step.at) makeBeacon(step.at[0], step.at[1]);
    hooks.onBrief(def.brief);
    return active;
  }

  function startSideJob(job, playerPos) {
    // Taxi / delivery: pick a destination across town.
    const dests = [[0, -40], [130, 60], [-140, -120], [60, -150], [-40, 150]];
    const dest = dests[Math.floor(Math.random() * dests.length)];
    active = { def: null, stepIndex: 0, sideJob: { ...job, dest } };
    makeBeacon(dest[0], dest[1], 0x19c2d8);
    hooks.onBrief(job.name + ' — reach the marker. Payout $' + job.payout + '.');
    return active;
  }

  function currentStep() {
    if (!active) return null;
    if (active.sideJob) return { text: active.sideJob.name + ' — reach the cyan marker', at: active.sideJob.dest, radius: 12 };
    return active.def.steps[active.stepIndex] || null;
  }

  function update(dt, player, state) {
    if (!active) return null;
    const step = currentStep();
    if (!step) return null;
    const px = player.pos.x, pz = player.pos.z;

    if (step.steal) {
      if (state.stoleCar) {
        hooks.onStepDone('Car acquired. Now lose the heat.');
        active.stepIndex++;
        const next = currentStep();
        if (next && next.at) makeBeacon(next.at[0], next.at[1]);
        state.stoleCar = false;
      }
      return active;
    }
    if (step.clearWanted) {
      if (state.wanted === 0 && state.hadWanted) {
        hooks.onStepDone('Heat is gone. Clean.');
        active.stepIndex++;
        const next = currentStep();
        if (next && next.at) makeBeacon(next.at[0], next.at[1]);
      }
      return active;
    }
    if (step.needBoat) {
      if (state.inBoat) {
        hooks.onStepDone('Boat away. Run the canal.');
        active.stepIndex++;
        const next = currentStep();
        if (next && next.at) makeBeacon(next.at[0], next.at[1]);
      } else if (step.at && !beacon) {
        makeBeacon(step.at[0], step.at[1]);
      }
      return active;
    }
    if (step.at) {
      const d = Math.hypot(px - step.at[0], pz - step.at[1]);
      if (d < step.radius) {
        if (active.sideJob) {
          hooks.onPayout(active.sideJob.payout, active.sideJob.name + ' complete.');
          active = null;
          clearBeacon();
          return { done: 'side' };
        }
        active.stepIndex++;
        hooks.onStepDone(step.text + ' — done.');
        const next = currentStep();
        if (next && next.at) {
          makeBeacon(next.at[0], next.at[1]);
        } else {
          // Mission complete.
          const payout = active.def.payout;
          hooks.onPayout(payout, active.def.done);
          hooks.onMissionDone(active.def.id);
          completedCount++;
          active = null;
          clearBeacon();
          return { done: 'mission', payout };
        }
      }
    }
    return active;
  }

  return {
    start, startSideJob, nextMissionDef, currentStep, update,
    get active() { return active; },
    get completedCount() { return completedCount; },
    abort() { active = null; clearBeacon(); },
    updateBeaconPulse(t) {
      if (beaconRing) {
        const s = 1 + Math.sin(t * 3) * 0.12;
        beaconRing.scale.set(s, s, 1);
      }
      if (beacon) beacon.rotation.y = t * 0.5;
    },
  };
}
