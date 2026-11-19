// LOWTIDE — police.js
// One clear job: the wanted system. Stars 0–5, heat that decays when the
// player is unseen, cruisers on the streets, patrol boats when the water
// is up, roadblocks at 3+, and a helicopter searchlight at 3+.

import * as THREE from 'three';
import { Vehicle, buildCarMesh, buildBoatMesh } from './vehicles.js';
import { VEHICLES, WORLD } from './config.js';
import { isInCanal, waterDepthAt } from './city.js';

export function createPolice(scene) {
  let wanted = 0;
  let heat = 0; // 0..100, stars = ceil(heat/20)
  let unseenTimer = 0;
  let bustedTimer = 0;
  const units = []; // {vehicle, kind:'car'|'boat', active}
  let heli = null;
  let heliLight = null;
  let roadblocks = [];
  let spawnTimer = 0;
  let dispatchTimer = 0;
  let lastDispatch = '';

  const DISPATCH = [
    'Unit 7, suspect heading down the flooded Boulevard.',
    'All units, suspect is in a stolen vehicle near the Marina.',
    'Dispatch: suspect last seen in the Stilt Quarter canals.',
    'Air support requested over the Causeway.',
    'Roadblock on the Boulevard. Suspect is armed — approach with caution.',
    'Marine unit, launch the patrol boat. The streets are rivers now.',
  ];

  function ensureHeli() {
    if (heli) return;
    heli = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5),
      new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.5, metalness: 0.5 }));
    heli.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.5, metalness: 0.5 }));
    tail.position.set(0, 0.2, -4);
    heli.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x111111 }));
    rotor.position.y = 1.1;
    heli.add(rotor);
    heli.userData.rotor = rotor;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x9adfff, roughness: 0.1, metalness: 0.8 }));
    glass.position.set(0, 0.3, 1.8);
    heli.add(glass);
    heliLight = new THREE.SpotLight(0xfff2b0, 400, 90, 0.32, 0.5, 1.2);
    heliLight.position.set(0, -1, 0);
    heliLight.target.position.set(0, -40, 0);
    heli.add(heliLight);
    heli.add(heliLight.target);
    // Visible searchlight cone.
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 38, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.rotation.x = Math.PI;
    cone.position.y = -20;
    heli.add(cone);
    scene.add(heli);
  }

  function removeHeli() {
    if (!heli) return;
    scene.remove(heli);
    heli = null; heliLight = null;
  }

  function spawnUnit(kind, x, z) {
    const def = kind === 'boat'
      ? { ...VEHICLES.policeBoat, id: 'policeBoat' }
      : { ...VEHICLES.patrol, id: 'patrol' };
    const v = new Vehicle(def, x, z, 0);
    v.parked = false;
    scene.add(v.mesh);
    units.push({ vehicle: v, kind, active: true });
    return v;
  }

  function clearRoadblocks() {
    for (const r of roadblocks) scene.remove(r);
    roadblocks = [];
  }

  function setRoadblocks(playerPos) {
    clearRoadblocks();
    const mat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.6 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      for (let k = -1; k <= 1; k++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.8), k === 0 ? stripe : mat);
        b.position.set(k * 1.4, 0.55, 0);
        g.add(b);
      }
      const ahead = playerPos.clone ? playerPos : { x: playerPos.x, z: playerPos.z };
      g.position.set(ahead.x + (i === 0 ? 26 : -26), 0, ahead.z + (i === 0 ? 10 : -14));
      g.rotation.y = i * 0.8;
      scene.add(g);
      roadblocks.push(g);
    }
  }

  function addHeat(amount, reason) {
    heat = Math.min(100, heat + amount);
    const stars = Math.ceil(heat / 20);
    if (stars > wanted) wanted = stars;
    if (reason) lastDispatch = reason;
    return wanted;
  }

  function update(dt, player, waterY, inVehicle) {
    const px = player.pos.x, pz = player.pos.z;
    const playerSpeed = player.speed || 0;
    const flooded = waterY > WORLD.floodStreetsAt;

    // Heat decays when no unit is close; faster when hidden in canals at high tide.
    let nearest = Infinity;
    for (const u of units) {
      if (!u.active) continue;
      nearest = Math.min(nearest, Math.hypot(u.vehicle.pos.x - px, u.vehicle.pos.z - pz));
    }
    const hidden = isInCanal(px, pz) && flooded;
    if (nearest > 45 || units.length === 0) {
      unseenTimer += dt;
      if (unseenTimer > 2) heat = Math.max(0, heat - dt * (hidden ? 9 : 4));
    } else {
      unseenTimer = 0;
    }
    wanted = Math.ceil(heat / 20);
    if (wanted < 0) wanted = 0;

    // Spawn / despawn units to match the wanted level.
    const wantCars = wanted >= 2 ? Math.min(2, wanted - 1) : 0;
    const wantBoats = (wanted >= 3 || (wanted >= 2 && flooded)) ? 1 : 0;
    const wantHeli = wanted >= 3;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 2.5;
      const cars = units.filter((u) => u.kind === 'car' && u.active).length;
      const boats = units.filter((u) => u.kind === 'boat' && u.active).length;
      if (cars < wantCars) {
        const a = Math.random() * Math.PI * 2;
        spawnUnit('car', px + Math.cos(a) * 60, pz + Math.sin(a) * 60);
      }
      if (boats < wantBoats) {
        const a = Math.random() * Math.PI * 2;
        spawnUnit('boat', px + Math.cos(a) * 45, pz + Math.sin(a) * 45);
      }
      // Retire extras when the heat drops.
      for (const u of units) {
        if (!u.active) continue;
        if (u.kind === 'car' && units.filter((x) => x.kind === 'car' && x.active).length > wantCars) {
          u.active = false; scene.remove(u.vehicle.mesh);
        }
        if (u.kind === 'boat' && units.filter((x) => x.kind === 'boat' && x.active).length > wantBoats) {
          u.active = false; scene.remove(u.vehicle.mesh);
        }
      }
    }

    // Pursuit: cruisers on roads, boats through water. Boats take over in flood.
    for (const u of units) {
      if (!u.active) continue;
      const v = u.vehicle;
      const aggression = 1 + wanted * 0.12;
      if (u.kind === 'boat' && !flooded && !isInCanal(px, pz)) {
        // No water to chase through — the boat waits in the canal.
        v.speed *= Math.max(0, 1 - 2 * dt);
        continue;
      }
      const dist = v.autopilot(dt, px, pz, waterY, aggression);
      // Ram: contact slows the player and raises heat a little.
      if (dist < 3.4 && playerSpeed > 2) {
        if (player.onRam) player.onRam(v);
        addHeat(2);
      }
    }

    // Helicopter at 3+ stars, hovering over the player with a searchlight.
    if (wantHeli) {
      ensureHeli();
      const t = performance.now() / 1000;
      heli.position.set(px + Math.sin(t * 0.5) * 10, 20 + Math.sin(t * 0.8) * 1.5, pz - 26 + Math.cos(t * 0.4) * 8);
      heli.userData.rotor.rotation.y += dt * 22;
      heli.lookAt(px, 0, pz);
      heliLight.target.position.set(px - heli.position.x, -heli.position.y, pz - heli.position.z);
    } else {
      removeHeli();
    }

    // Roadblocks at 3+ stars, refreshed now and then.
    dispatchTimer -= dt;
    if (wanted >= 3 && dispatchTimer <= 0) {
      dispatchTimer = 14;
      setRoadblocks({ x: px, z: pz });
      lastDispatch = DISPATCH[Math.floor(Math.random() * DISPATCH.length)];
    }
    if (wanted < 3 && roadblocks.length) clearRoadblocks();
    if (dispatchTimer <= -30) { dispatchTimer = 0; }

    // Busted: a unit sits on the player while on foot and slow.
    if (wanted >= 1 && !inVehicle && nearest < 4 && playerSpeed < 1.5) {
      bustedTimer += dt;
    } else {
      bustedTimer = Math.max(0, bustedTimer - dt * 2);
    }

    return { wanted, heat, busted: bustedTimer > 2.5, nearest, dispatch: lastDispatch };
  }

  return {
    update, addHeat, spawnUnitAt: spawnUnit,
    get wanted() { return wanted; },
    get heat() { return heat; },
    get units() { return units.filter((u) => u.active).map((u) => u.vehicle); },
    get heliActive() { return !!heli; },
    setWanted(n) { wanted = n; heat = n * 20; },
    setDispatch(s) { lastDispatch = s; },
    reset() {
      wanted = 0; heat = 0; unseenTimer = 0; bustedTimer = 0;
      for (const u of units) scene.remove(u.vehicle.mesh);
      units.length = 0;
      clearRoadblocks();
      removeHeli();
    },
  };
}
