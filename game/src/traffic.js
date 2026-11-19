// LOWTIDE — traffic.js
// One clear job: the city feels alive — NPC cars that follow the road
// grid and stop at nothing (simple loops, cheap), and pedestrians who
// walk the sidewalks and crowd the high ground when the tide rises.

import * as THREE from 'three';
import { Vehicle, buildCarMesh } from './vehicles.js';
import { VEHICLES, ROADS_X, ROADS_Z, WORLD } from './config.js';
import { isInCanal } from './city.js';
import { mulberry32 } from './city.js';

const NPC_COLORS = [0x8a8f98, 0x5a6b8a, 0x9a7a4a, 0x4a7a5a, 0x7a4a6a, 0xc9c9c9, 0x3a3a44];

export function createTraffic(scene) {
  const rng = mulberry32(777);
  const cars = [];
  const peds = [];
  const pedGeo = new THREE.BoxGeometry(0.7, 1.8, 0.5);
  const pedHeadGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const pedColors = [0xff2d78, 0x19c2d8, 0xffd27a, 0x7de3a8, 0xff9a1f, 0xe8e8e8];

  // NPC cars: each loops along one road, turning at the island edge.
  for (let i = 0; i < 10; i++) {
    const color = NPC_COLORS[i % NPC_COLORS.length];
    const def = { ...VEHICLES.sedan, id: 'npc', color };
    const v = new Vehicle(def, 0, 0, 0);
    const vertical = i % 2 === 0;
    const road = vertical ? ROADS_X[i % ROADS_X.length] : ROADS_Z[i % ROADS_Z.length];
    const along = -180 + rng() * 360;
    const dir = rng() < 0.5 ? 1 : -1;
    v.mesh.position.set(vertical ? road + (dir > 0 ? 3.2 : -3.2) : along, 0, vertical ? along : road + (dir > 0 ? 3.2 : -3.2));
    v.heading = vertical ? (dir > 0 ? Math.PI : 0) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    v.mesh.rotation.y = v.heading;
    v.speed = 10 + rng() * 8;
    v.vertical = vertical;
    v.road = road;
    v.dir = dir;
    v.lane = dir > 0 ? 3.2 : -3.2;
    v.parked = false;
    scene.add(v.mesh);
    cars.push(v);
  }

  // Pedestrians: walk a sidewalk segment, turn around at the ends.
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(pedGeo, new THREE.MeshStandardMaterial({ color: pedColors[i % pedColors.length], roughness: 0.9 }));
    body.position.y = 0.9;
    const head = new THREE.Mesh(pedHeadGeo, new THREE.MeshStandardMaterial({ color: 0xd8a06a, roughness: 0.8 }));
    head.position.y = 2.0;
    g.add(body); g.add(head);
    const road = ROADS_X[i % ROADS_X.length];
    const z = -170 + rng() * 340;
    g.position.set(road + 9.5, 0, z);
    scene.add(g);
    peds.push({
      mesh: g, x: road + 9.5, z, dir: rng() < 0.5 ? 1 : -1,
      speed: 1.2 + rng() * 1.2, flee: 0, road,
    });
  }

  function update(dt, waterY, playerPos, playerSpeed) {
    // NPC cars cruise their road; slow to a crawl in flood, stop if stalled deep.
    for (const v of cars) {
      const flooded = waterY > 0.35 && !isInCanal(v.pos.x, v.pos.z);
      const target = flooded ? (waterY > 0.75 ? 0 : 4) : (10 + (v.cruise || 12));
      v.cruise = v.cruise || 10 + Math.random() * 6;
      v.speed += (target - v.speed) * Math.min(1, dt * 0.8);
      const step = v.speed * v.dir * dt;
      if (v.vertical) {
        v.pos.z += step;
        if (v.pos.z > 195) v.pos.z = -195;
        if (v.pos.z < -195) v.pos.z = 195;
      } else {
        v.pos.x += step;
        if (v.pos.x > 195) v.pos.x = -195;
        if (v.pos.x < -195) v.pos.x = 195;
      }
      // Bridge hop: cars crossing a canal ride the deck height.
      v.mesh.position.y = isInCanal(v.pos.x, v.pos.z) ? 0.6 : 0;
      v.mesh.rotation.y = v.heading;
    }
    // Pedestrians stroll; they flee the player and crowd uphill in flood.
    for (const p of peds) {
      const dPlayer = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (dPlayer < 8 && playerSpeed > 6) p.flee = 2.5;
      if (p.flee > 0) {
        p.flee -= dt;
        p.z -= p.dir * p.speed * 3 * dt;
      } else {
        p.z += p.dir * p.speed * dt;
        if (p.z > 195) { p.z = 195; p.dir = -1; }
        if (p.z < -195) { p.z = -195; p.dir = 1; }
      }
      // In flood, peds drift toward higher ground (the Causeway bridge deck).
      if (waterY > 0.35) {
        p.x += ((p.road + 9.5) - p.x) * dt * 0.2;
      }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;
      // Walking bob.
      p.mesh.position.y = Math.abs(Math.sin(performance.now() / 180 + p.z)) * 0.06;
    }
  }

  return { cars, peds, update };
}
