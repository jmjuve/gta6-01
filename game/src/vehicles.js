// LOWTIDE — vehicles.js
// One clear job: build cars and boats from boxes, and drive them. Arcade
// physics on purpose: fast, forgiving, readable. The tide changes the
// numbers — flood slows cars, stalls them when deep, and boats take over.

import * as THREE from 'three';
import { VEHICLES, WORLD } from './config.js';
import { isInCanal, waterDepthAt } from './city.js';

function box(w, h, d, color, x = 0, y = 0, z = 0, rough = 0.45, metal = 0.55) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function buildCarMesh(def) {
  const g = new THREE.Group();
  const bodyColor = def.color;
  g.add(box(2.0, 0.62, 4.4, bodyColor, 0, 0.62, 0));
  g.add(box(1.8, 0.55, 2.2, 0x141a24, 0, 1.15, -0.2, 0.15, 0.8)); // cabin glass
  g.add(box(1.9, 0.18, 0.9, bodyColor, 0, 0.95, 1.75)); // hood lip
  // headlights + taillights
  const head = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tail = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), head);
    hl.position.set(s * 0.7, 0.66, 2.22);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), tail);
    tl.position.set(s * 0.7, 0.66, -2.22);
    g.add(tl);
  }
  if (def.id === 'patrol') {
    // police light bar
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2244ff, emissiveIntensity: 1.2 }));
    bar.position.set(0, 1.5, -0.2);
    g.add(bar);
    const stripe = box(2.02, 0.2, 4.42, 0xffffff, 0, 0.72, 0, 0.5, 0.1);
    g.add(stripe);
  }
  if (def.id === 'taxi') {
    const sign = box(0.9, 0.3, 0.5, 0xf2c200, 0, 1.55, -0.2, 0.5, 0.1);
    g.add(sign);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

export function buildBoatMesh(def) {
  const g = new THREE.Group();
  const hull = box(2.2, 0.8, 5.2, def.color, 0, 0.5, 0, 0.5, 0.4);
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 4),
    new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.4 }));
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 1);
  bow.position.set(0, 0.5, 3.2);
  g.add(bow);
  g.add(box(1.6, 0.7, 1.6, 0xe8e8e8, 0, 1.1, -0.6, 0.6, 0.2)); // console
  g.add(box(0.5, 0.9, 0.5, 0x222222, 0, 1.0, -1.9, 0.5, 0.5)); // outboard
  if (def.id === 'policeBoat') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2222, emissiveIntensity: 1.4 }));
    bar.position.set(0, 1.6, -0.6);
    g.add(bar);
  }
  return g;
}

// A drivable vehicle. kind 'car' | 'boat'. Heading in radians, 0 = -Z.
export class Vehicle {
  constructor(def, x, z, heading = 0) {
    this.def = def;
    this.kind = def.kind;
    this.mesh = def.kind === 'boat' ? buildBoatMesh(def) : buildCarMesh(def);
    this.mesh.position.set(x, def.kind === 'boat' ? 0 : 0, z);
    this.mesh.rotation.y = heading;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.stalled = false;
    this.stallTimer = 0;
    this.wakeTimer = 0;
    this.health = 100;
    this.parked = true;
    this.id = def.id + '-' + Math.floor(Math.random() * 1e6);
  }

  get pos() { return this.mesh.position; }

  // Arcade drive. input: {forward, back, left, right, brake, boost}.
  // waterY: current tide height. hasWetTires: upgrade flag.
  drive(dt, input, waterY, hasWetTires) {
    const def = this.def;
    const depth = waterDepthAt(this.pos.x, this.pos.z, waterY);
    const inWater = this.kind === 'boat' ? true : depth > 0.05;
    let top = def.topSpeed;
    let accel = def.accel;

    if (this.kind === 'car') {
      if (depth > 0.05 && depth < WORLD.stallWaterAt) {
        // Flood drag: the deeper the water, the slower the car.
        const drag = 1 - (depth / WORLD.stallWaterAt) * 0.65;
        top *= Math.max(0.25, drag);
        accel *= Math.max(0.3, drag);
      }
      if (depth >= WORLD.stallWaterAt && !hasWetTires) {
        this.stallTimer += dt;
        if (this.stallTimer > 1.2) this.stalled = true;
      } else {
        this.stallTimer = Math.max(0, this.stallTimer - dt * 2);
        if (depth < WORLD.stallWaterAt * 0.6) this.stalled = false;
      }
      if (this.stalled) { top = 0; accel = 0; }
    } else {
      // Boats need water: beached on dry land they crawl.
      if (depth <= 0.05 && !isInCanal(this.pos.x, this.pos.z)) {
        top *= 0.12; accel *= 0.15;
      }
    }

    const boost = input.boost ? 1.25 : 1;
    if (input.forward) this.speed += accel * boost * dt;
    else if (input.back) this.speed -= accel * 0.7 * dt;
    else this.speed *= Math.max(0, 1 - 1.6 * dt); // coast down
    if (input.brake) this.speed *= Math.max(0, 1 - 4 * dt);
    this.speed = Math.max(-top * 0.45, Math.min(top * boost, this.speed));

    // Steering: sharper at low speed, looser at speed; boats drift wider.
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerRate = this.kind === 'boat' ? 1.5 : 2.1;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 6);
    const dir = this.speed >= 0 ? 1 : -1;
    this.heading += this.steer * steerRate * dt * Math.min(1, Math.abs(this.speed) / 8) * dir;

    const dx = -Math.sin(this.heading) * this.speed * dt;
    const dz = -Math.cos(this.heading) * this.speed * dt;
    this.pos.x += dx;
    this.pos.z += dz;
    // Stay on the island.
    this.pos.x = Math.max(-WORLD.half + 4, Math.min(WORLD.half - 4, this.pos.x));
    this.pos.z = Math.max(-WORLD.half + 4, Math.min(WORLD.half - 4, this.pos.z));

    // Mesh follow-through.
    this.mesh.rotation.y = this.heading;
    if (this.kind === 'boat') {
      // Bob on the water.
      const t = performance.now() / 1000;
      this.mesh.position.y = Math.max(0, waterY) + Math.sin(t * 1.8 + this.pos.x * 0.1) * 0.08;
      this.mesh.rotation.z = Math.sin(t * 1.4) * 0.03;
      this.mesh.rotation.x = Math.sin(t * 1.1 + 2) * 0.02;
      // Spray when fast.
      this.wakeTimer -= dt;
    } else {
      this.mesh.position.y = 0;
      const wobble = Math.abs(this.steer) * Math.min(1, Math.abs(this.speed) / 20);
      this.mesh.rotation.z = -this.steer * wobble * 0.06;
      // Spin the wheels.
      const spin = (this.speed * dt) / 0.42;
      for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
      // Front wheels steer visually.
      this.mesh.userData.wheels[0].rotation.y = this.steer * 0.35;
      this.mesh.userData.wheels[1].rotation.y = this.steer * 0.35;
    }
    return inWater;
  }

  // Simple pursuit steering toward a target point (police AI).
  autopilot(dt, tx, tz, waterY, aggression = 1) {
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const targetHeading = Math.atan2(-dx, -dz);
    let dh = targetHeading - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const input = {
      forward: dist > 4,
      back: false,
      left: dh > 0.08,
      right: dh < -0.08,
      brake: dist < 5,
      boost: aggression > 1.1,
    };
    this.drive(dt, input, waterY, false);
    return dist;
  }
}

// Parked cars the player can steal, placed along roads.
export function spawnParkedCars(scene, rng) {
  const cars = [];
  const spots = [
    [-100, -52, 0.4], [-40, -108, 1.2], [20, -28, -0.6], [80, -52, 0.9],
    [-160, -28, 0.2], [140, -108, 1.5], [-100, 92, 0.7], [20, 92, -1.1],
    [80, 152, 0.3], [-40, 152, 1.8], [140, 20, 0.5], [-160, 140, -0.8],
  ];
  const ids = ['sedan', 'coupe', 'pickup', 'taxi', 'sedan', 'coupe', 'pickup', 'sedan', 'taxi', 'coupe', 'sedan', 'pickup'];
  spots.forEach(([x, z, h], i) => {
    const def = { ...VEHICLES[ids[i]], id: ids[i] };
    const v = new Vehicle(def, x, z, h);
    v.parked = true;
    scene.add(v.mesh);
    cars.push(v);
  });
  return cars;
}

export function spawnDockedBoats(scene) {
  const boats = [];
  const spots = [
    [-168, -104, 0], [-154, -104, 0], [-140, -104, 0],
    [35, -160, 0], [45, 160, 0], [40, 100, 0],
  ];
  const ids = ['skiff', 'skiff', 'speedboat', 'skiff', 'speedboat', 'skiff'];
  spots.forEach(([x, z], i) => {
    const def = { ...VEHICLES[ids[i]], id: ids[i] };
    const v = new Vehicle(def, x, z, (i % 2 === 0 ? 0 : Math.PI));
    v.parked = true;
    scene.add(v.mesh);
    boats.push(v);
  });
  return boats;
}
