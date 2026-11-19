// LOWTIDE — main.js
// One clear job: wire everything together — the loop, the camera, the
// player on foot and in vehicles, stealing, shooting, crashing, getting
// busted, the title screen, the job board + shop, the save, and the
// ?shot= presets that stage the four screenshots.

import * as THREE from 'three';
import { WORLD, VEHICLES, MISSIONS, SIDE_JOBS, UPGRADES, PLAYER_START, SAFEHOUSE, VAULT, START_CASH, START_HEALTH, PALETTE } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createTide } from './tide.js';
import { createCity, isInCanal, waterDepthAt } from './city.js';
import { Vehicle, spawnParkedCars, spawnDockedBoats } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { loadSave, writeSave, clearSave, defaultSave } from './save.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // hero | heist | canal | board | null
window.__lowtideStarted = false;
window.__lowtideError = null;
window.addEventListener('error', (e) => { window.__lowtideError = String(e.message); });

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1e33);
scene.fog = new THREE.Fog(PALETTE.fog, 120, 520);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);

const city = createCity(scene);
const tide = createTide();
const traffic = createTraffic(scene);
const police = createPolice(scene);
const audio = createAudio();
const input = createInput();
const hud = createHud();

// ---------- state ----------
const save = loadSave();
const state = {
  cash: save ? save.cash : START_CASH,
  health: save ? save.health : START_HEALTH,
  missionsDone: save ? [...save.missionsDone] : [],
  ownedCars: save ? [...save.ownedCars] : ['sedan'],
  ownedBoats: save ? [...save.ownedBoats] : ['skiff'],
  upgrades: save ? [...save.upgrades] : [],
  charts: save ? save.charts : 0,
  playSeconds: save ? save.playSeconds : 0,
  createdAt: save ? save.createdAt : Date.now(),
  bestWanted: save ? save.bestWanted : 0,
  mode: 'title', // title | play | paused | busted | board
  inVehicle: null,
  stoleCar: false,
  hadWanted: false,
  inBoat: false,
  autoDrive: false,
  shake: 0,
  muted: false,
};
window.__lowtideState = state;

const parkedCars = spawnParkedCars(scene);
const dockedBoats = spawnDockedBoats(scene);
const allVehicles = [...parkedCars, ...dockedBoats];

// Player on foot.
const player = {
  pos: new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z),
  heading: PLAYER_START.heading,
  speed: 0,
  mesh: null,
  onRam(v) { damagePlayer(8, 'rammed by a police ' + v.kind); },
};
function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.45),
    new THREE.MeshStandardMaterial({ color: 0xff2d78, roughness: 0.8 }));
  jacket.position.y = 1.25;
  g.add(jacket);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8a06a, roughness: 0.8 }));
  head.position.y = 2.05;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }));
  hair.position.y = 2.1;
  g.add(hair);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.9 }));
  legs.position.y = 0.45;
  g.add(legs);
  // Rae's pistol, visible when shooting.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.7 }));
  gun.position.set(0.45, 1.35, 0.3);
  g.add(gun);
  g.userData.gun = gun;
  return g;
}
player.mesh = buildPlayerMesh();
scene.add(player.mesh);
window.__lowtidePlayer = player;

// Crew member for the heist shot (and M3 flavour): stands by the player.
const crew = buildPlayerMesh();
crew.children[0].material = new THREE.MeshStandardMaterial({ color: 0x19c2d8, roughness: 0.8 });
crew.visible = false;
scene.add(crew);

// Tide-chart collectibles: 6 buoys + 6 rooftop markers (gold rings).
const charts = [];
{
  const geo = new THREE.TorusGeometry(1.1, 0.22, 8, 20);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const spots = [[40, -100], [40, 40], [40, 160], [-160, 30], [100, 30], [-40, 30]];
  for (const [x, z] of spots) charts.push({ mesh: new THREE.Mesh(geo, mat), x, z, y: 2.5, taken: false });
  for (const b of city.buildings.slice(0, 6)) {
    const p = b.position;
    charts.push({ mesh: new THREE.Mesh(geo, mat), x: p.x, z: p.z, y: b.geometry.parameters.height + 2, taken: false });
  }
  for (const c of charts) { c.mesh.position.set(c.x, c.y, c.z); scene.add(c.mesh); }
}

// Building colliders (AABBs) from the city meshes.
const colliders = city.buildings.map((b) => {
  const p = b.geometry.parameters;
  return { x: b.position.x, z: b.position.z, hw: p.width / 2 + 1, hd: p.depth / 2 + 1 };
});
colliders.push({ x: VAULT.x, z: VAULT.z, hw: 14, hd: 11 });
colliders.push({ x: SAFEHOUSE.x, z: SAFEHOUSE.z, hw: 10, hd: 8 });

function collideCircle(pos, radius) {
  for (const c of colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z;
    if (Math.abs(dx) < c.hw + radius && Math.abs(dz) < c.hd + radius) {
      // Push out along the smaller penetration axis.
      const px = c.hw + radius - Math.abs(dx);
      const pz = c.hd + radius - Math.abs(dz);
      if (px < pz) pos.x = c.x + Math.sign(dx || 1) * (c.hw + radius);
      else pos.z = c.z + Math.sign(dz || 1) * (c.hd + radius);
      return true;
    }
  }
  return false;
}

// ---------- missions ----------
const missions = createMissions(scene, {
  onBrief: (text) => { hud.toast(text, 5200); },
  onStepDone: (text) => { hud.toast(text); audio.pickup(); },
  onPayout: (amount, text) => {
    state.cash += amount;
    audio.cash();
    hud.toast(`+$${amount} — ${text}`, 5200);
    persist();
  },
  onMissionDone: (id) => {
    if (!state.missionsDone.includes(id)) state.missionsDone.push(id);
    audio.missionDone();
    persist();
  },
});

function damagePlayer(amount, why) {
  if (state.mode !== 'play') return;
  state.health -= amount;
  state.shake = Math.max(state.shake, 0.5);
  audio.crash();
  hud.toast(`Hit! ${why} — health ${Math.max(0, Math.round(state.health))}`);
  if (state.health <= 0) {
    state.mode = 'busted';
    audio.busted();
    document.getElementById('busted').style.display = 'flex';
    document.getElementById('busted-text').textContent =
      'BUSTED — the PSPD caught Rae. You lose half your cash and wake up at the safehouse.';
  }
}

function respawn() {
  state.health = START_HEALTH;
  state.cash = Math.floor(state.cash / 2);
  police.reset();
  if (state.inVehicle) { state.inVehicle = null; }
  player.pos.set(SAFEHOUSE.x + 14, 0, SAFEHOUSE.z + 6);
  player.heading = Math.PI;
  document.getElementById('busted').style.display = 'none';
  state.mode = 'play';
  hud.toast('Back at the safehouse. The tide waits for no one.');
  persist();
}

function persist() {
  state.playSeconds = Math.round(performance.now() / 1000);
  writeSave(state);
}

// ---------- vehicles: enter / exit / steal ----------
function nearestVehicle(maxDist, kind) {
  let best = null, bestD = maxDist;
  for (const v of allVehicles) {
    if (kind && v.kind !== kind) continue;
    if (v === state.inVehicle) continue;
    const d = Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z);
    if (d < bestD) { best = v; bestD = d; }
  }
  return best;
}

function enterVehicle(v) {
  if (!v) return false;
  const wasParked = v.parked;
  const isPolice = v.def.id === 'patrol' || v.def.id === 'policeBoat';
  v.parked = false;
  state.inVehicle = v;
  state.inBoat = v.kind === 'boat';
  player.mesh.visible = false;
  audio.unlock();
  if (wasParked && !isPolice) {
    // Stealing a parked car raises the heat — and counts for M2.
    state.stoleCar = true;
    state.hadWanted = true;
    police.addHeat(20, 'Dispatch: stolen vehicle reported near the Marina.');
    hud.toast(`Stole the ${v.def.name}. The PSPD is on its way.`);
  } else if (isPolice) {
    police.addHeat(40, 'Dispatch: officer down — suspect took a police unit!');
    hud.toast('You jacked a police unit. Bold. Very bold.');
  } else {
    hud.toast(`Driving the ${v.def.name}.`);
  }
  return true;
}

function exitVehicle() {
  const v = state.inVehicle;
  if (!v) return;
  v.speed *= 0.2;
  state.inVehicle = null;
  state.inBoat = false;
  const side = 2.6;
  player.pos.set(v.pos.x + Math.cos(v.heading) * side, 0, v.pos.z - Math.sin(v.heading) * side);
  player.heading = v.heading;
  player.mesh.visible = true;
  hud.toast('On foot. E enters the nearest vehicle.');
}

// ---------- shooting (on foot) ----------
let shootCooldown = 0;
function shoot() {
  if (shootCooldown > 0 || !state.inVehicle === false) return;
  shootCooldown = 0.35;
  audio.shoot();
  // Hitscan: nearest police unit within 55m and inside the aim cone.
  const fx = -Math.sin(player.heading), fz = -Math.cos(player.heading);
  let best = null, bestScore = 0.92; // cos(23°)
  for (const u of police.units) {
    const dx = u.pos.x - player.pos.x, dz = u.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 55 || d < 1) continue;
    const dot = (dx * fx + dz * fz) / d;
    if (dot > bestScore) { best = u; bestScore = dot; }
  }
  // Muzzle flash.
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  flash.position.copy(player.mesh.position).add(new THREE.Vector3(fx * 1.2, 1.4, fz * 1.2));
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 70);
  if (best) {
    best.health -= 34;
    police.addHeat(10, 'Shots fired! Suspect is armed.');
    hud.toast('Hit a police unit!');
    if (best.health <= 0) {
      best.speed = 0;
      best.stalled = true;
      hud.toast('Police unit disabled!');
    }
  }
}

// ---------- job board + shop (DOM) ----------
const boardEl = document.getElementById('board');
function openBoard() {
  state.mode = 'board';
  renderBoard();
  boardEl.style.display = 'flex';
}
function closeBoard() {
  boardEl.style.display = 'none';
  if (state.mode === 'board') state.mode = 'play';
}
function renderBoard() {
  const next = missions.nextMissionDef(state.missionsDone);
  const missionHtml = next
    ? `<div class="board-row"><b>${next.title}</b> — ${next.brief}<br><button data-act="mission">Start mission — $${next.payout}</button></div>`
    : `<div class="board-row"><b>All story missions done.</b> Replay them from the safehouse in the next update.</div>`;
  const sideHtml = SIDE_JOBS.map((j) =>
    `<div class="board-row"><b>${j.name}</b> — ${j.blurb} <button data-act="side" data-id="${j.id}">Take job — $${j.payout}</button></div>`).join('');
  const shopHtml = Object.values(VEHICLES)
    .filter((v) => v.price > 0)
    .map((v) => {
      const owned = v.kind === 'car' ? state.ownedCars.includes(v.id) : state.ownedBoats.includes(v.id);
      return `<div class="board-row"><b>${v.name}</b> (${v.kind}) — top ${v.topSpeed * 2.2 | 0} mph — $${v.price} ` +
        (owned ? '<span class="owned">OWNED</span>' : `<button data-act="buy" data-id="${v.id}" data-price="${v.price}">Buy</button>`) + `</div>`;
    }).join('');
  const upHtml = UPGRADES.map((u) => {
    const owned = state.upgrades.includes(u.id);
    return `<div class="board-row"><b>${u.name}</b> — ${u.blurb} — $${u.price} ` +
      (owned ? '<span class="owned">INSTALLED</span>' : `<button data-act="upgrade" data-id="${u.id}" data-price="${u.price}">Buy</button>`) + `</div>`;
  }).join('');
  document.getElementById('board-body').innerHTML =
    `<h2>JOB BOARD — Port Solmar</h2><p>Cash: <b>$${state.cash}</b> · Missions done: ${state.missionsDone.length}/3 · Tide charts: ${state.charts}/12</p>` +
    `<h3>Story</h3>${missionHtml}<h3>Side jobs</h3>${sideHtml}<h3>Buy vehicles</h3>${shopHtml}<h3>Upgrades</h3>${upHtml}` +
    `<p class="dim">Vehicles you own wait at the safehouse. Press J or Esc to close.</p>`;
}
boardEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'mission') {
    const next = missions.nextMissionDef(state.missionsDone);
    if (next) { closeBoard(); missions.start(next, state.missionsDone); }
  } else if (act === 'side') {
    const job = SIDE_JOBS.find((j) => j.id === b.dataset.id);
    if (job) { closeBoard(); missions.startSideJob(job, player.pos); }
  } else if (act === 'buy' || act === 'upgrade') {
    const price = +b.dataset.price;
    if (state.cash < price) { hud.toast('Not enough cash.'); return; }
    state.cash -= price;
    if (act === 'buy') {
      const def = VEHICLES[b.dataset.id];
      if (def.kind === 'car') state.ownedCars.push(def.id);
      else state.ownedBoats.push(def.id);
      // Park the new ride at the safehouse.
      const v = new Vehicle({ ...def, id: def.id }, SAFEHOUSE.x + 16 + state.ownedCars.length * 4, SAFEHOUSE.z + 14, 0);
      scene.add(v.mesh);
      allVehicles.push(v);
      hud.toast(`Bought the ${def.name}. It waits at the safehouse.`);
    } else {
      state.upgrades.push(b.dataset.id);
      hud.toast(`Installed ${UPGRADES.find((u) => u.id === b.dataset.id).name}.`);
    }
    audio.cash();
    persist();
    renderBoard();
  }
});

// ---------- title / pause ----------
const titleEl = document.getElementById('title');
const pauseEl = document.getElementById('pause');
function showTitle() {
  state.mode = 'title';
  titleEl.style.display = 'flex';
  document.getElementById('continue-btn').style.display = save ? 'inline-block' : 'none';
}
function startGame(fresh) {
  if (fresh) {
    clearSave();
    Object.assign(state, defaultSave());
    state.missionsDone = []; state.ownedCars = ['sedan']; state.ownedBoats = ['skiff'];
    state.upgrades = []; state.charts = 0; state.cash = START_CASH; state.health = START_HEALTH;
    police.reset();
    missions.abort();
  }
  titleEl.style.display = 'none';
  state.mode = 'play';
  audio.unlock();
  audio.startMusic();
  hud.hint('WASD drive / walk · E enter or steal a vehicle · F swap car/boat at the water · J job board · Click to shoot on foot · M mute');
  if (!missions.active && missions.nextMissionDef(state.missionsDone)) {
    setTimeout(() => {
      if (state.mode === 'play' && !missions.active) {
        const next = missions.nextMissionDef(state.missionsDone);
        if (next) missions.start(next, state.missionsDone);
      }
    }, 1500);
  }
  window.__lowtideStarted = true;
}
document.getElementById('start-btn').addEventListener('click', () => startGame(true));
document.getElementById('continue-btn').addEventListener('click', () => startGame(false));
document.getElementById('resume-btn').addEventListener('click', () => {
  pauseEl.style.display = 'none';
  state.mode = 'play';
});
document.getElementById('quit-btn').addEventListener('click', () => {
  pauseEl.style.display = 'none';
  persist();
  showTitle();
});
document.getElementById('busted-btn').addEventListener('click', respawn);

// ---------- shot presets (real game states, staged for screenshots) ----------
function applyShotPreset() {
  if (!SHOT) return;
  titleEl.style.display = 'none';
  state.mode = 'play';
  audio.unlock();
  window.__lowtideStarted = true;
  if (SHOT === 'hero') {
    // Flooded Boulevard at dusk, car-to-boat chase, wanted 3.
    // Tide 0.72: streets visibly flooded (waterY ~0.45) but cars can still run.
    tide.setLevel(0.72);
    city.setDusk();
    // Face north up the Boulevard, neon signs ahead, police boat behind.
    const coupe = new Vehicle({ ...VEHICLES.coupe, id: 'coupe' }, 2, -14, 0);
    scene.add(coupe.mesh);
    allVehicles.push(coupe);
    enterVehicle(coupe);
    coupe.speed = 11;
    state.autoDrive = true;
    police.setWanted(3);
    // Stage the chase: a patrol boat converging from the right, a cruiser on the left.
    police.spawnUnitAt('boat', 16, -44);
    police.spawnUnitAt('car', -10, -42);
    police.setDispatch('Unit 7, suspect heading down the flooded Boulevard.');
    hud.toast('LOWTIDE — the tide is the getaway.');
  } else if (SHOT === 'heist') {
    // On foot at the Meridian Vault, wanted 3, helicopter overhead.
    // Approach from the south so the vault's signed, colonnaded face is in frame.
    tide.setLevel(0.55);
    city.setDusk();
    player.pos.set(VAULT.x, 0, VAULT.z + 56);
    player.heading = 0;
    crew.visible = true;
    crew.position.set(VAULT.x - 3.5, 0, VAULT.z + 54);
    crew.rotation.y = 0;
    police.setWanted(3);
    police.setDispatch('All units — the Meridian Vault. Suspect is armed.');
    hud.toast('M7 — Golden Hour. The vault, the crew, the whole city watching.');
  } else if (SHOT === 'canal') {
    // Boat escape through the Stilt Quarter canals at high tide.
    tide.setLevel(0.9);
    city.setDusk();
    const boat = new Vehicle({ ...VEHICLES.speedboat, id: 'speedboat' }, 118, 30, -Math.PI / 2);
    scene.add(boat.mesh);
    allVehicles.push(boat);
    enterVehicle(boat);
    boat.speed = 14;
    state.autoDrive = true;
    police.setWanted(2);
    // Stage the pursuit: a patrol boat closing from behind in the canal.
    police.spawnUnitAt('boat', 96, 30);
    police.setDispatch('Marine unit — suspect in the Stilt Quarter canals.');
    hud.toast('The canal run — high tide opens the quarter.');
  } else if (SHOT === 'board') {
    // Safehouse at low tide, morning light, job board open, cars lined up.
    tide.setLevel(0.06);
    city.setMorning();
    player.pos.set(SAFEHOUSE.x + 8, 0, SAFEHOUSE.z + 20);
    player.heading = 0.38;
    // Line up owned cars in the driveway.
    const lineup = ['coupe', 'pickup', 'taxi'];
    lineup.forEach((id, i) => {
      const v = new Vehicle({ ...VEHICLES[id], id }, SAFEHOUSE.x + 12 + i * 6, SAFEHOUSE.z + 14, 0);
      scene.add(v.mesh);
      allVehicles.push(v);
    });
    const boat = new Vehicle({ ...VEHICLES.speedboat, id: 'speedboat' }, SAFEHOUSE.x - 12, SAFEHOUSE.z + 18, 0);
    scene.add(boat.mesh);
    allVehicles.push(boat);
    setTimeout(() => openBoard(), 600);
  }
  // Missions label for the HUD in shots.
  if (SHOT === 'hero' || SHOT === 'canal') {
    missions.start(MISSIONS[2], state.missionsDone);
  } else if (SHOT === 'heist') {
    missions.start(MISSIONS[0], state.missionsDone);
  }
}

// ---------- camera ----------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(PLAYER_START.x, 14, PLAYER_START.z + 26);
function updateCamera(dt) {
  const v = state.inVehicle;
  const focus = v ? v.pos : player.pos;
  const heading = v ? v.heading : player.heading;
  const speed = v ? Math.abs(v.speed) : Math.abs(player.speed);
  const dist = v ? 10.5 + speed * 0.15 : 11;
  const height = v ? 4.3 + speed * 0.04 : 5;
  const fx = -Math.sin(heading), fz = -Math.cos(heading);
  camTarget.set(focus.x - fx * dist, height, focus.z - fz * dist);
  // Keep the camera out of the flood plane's glare: lift it a touch at high tide.
  if (tide.waterY > 0.5) camTarget.y += 1.2;
  camPos.lerp(camTarget, Math.min(1, dt * 4.5));
  if (state.shake > 0) {
    state.shake = Math.max(0, state.shake - dt * 1.4);
    camPos.x += (Math.random() - 0.5) * state.shake;
    camPos.y += (Math.random() - 0.5) * state.shake * 0.6;
  }
  camera.position.copy(camPos);
  camera.lookAt(focus.x, (v ? 1.6 : 2.6), focus.z);
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let saveTimer = 0;
let fpsFrames = 0, fpsTime = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  if (state.mode === 'play' || state.mode === 'board') {
    tide.update(dt);
    city.update(dt, tide.waterY, tide.level);
    state.playSeconds += dt;

    // --- input: global keys ---
    if (input.wasPressed('KeyM')) {
      state.muted = !state.muted;
      audio.setMuted(state.muted);
      hud.toast(state.muted ? 'Sound off.' : 'Sound on.');
    }
    if (input.wasPressed('KeyJ') && state.mode === 'play') openBoard();
    else if (input.wasPressed('KeyJ') && state.mode === 'board') closeBoard();
    if (input.wasPressed('Escape') && state.mode === 'play') {
      state.mode = 'paused';
      pauseEl.style.display = 'flex';
    }
    if (input.wasPressed('KeyH') && state.inVehicle) audio.horn();

    const hasWetTires = state.upgrades.includes('tires');
    const hasEngine = state.upgrades.includes('engine');

    // --- player ---
    if (state.inVehicle) {
      const v = state.inVehicle;
      const inp = {
        forward: input.forward || state.autoDrive,
        back: input.back,
        left: input.left,
        right: input.right,
        brake: input.brake,
        boost: input.boost,
      };
      if (hasEngine) { const s = v.speed; v.drive(dt, inp, tide.waterY, hasWetTires); v.speed = Math.min(v.speed * 1.15, v.def.topSpeed * 1.2); }
      else v.drive(dt, inp, tide.waterY, hasWetTires);
      const hitBuilding = collideCircle(v.pos, 2.2);
      if (hitBuilding && Math.abs(v.speed) > 12) {
        v.speed *= 0.4;
        state.shake = 0.6;
        audio.crash();
        damagePlayer(3, 'crashed into a building');
      }
      // Traffic collisions.
      for (const tv of traffic.cars) {
        const d = Math.hypot(tv.pos.x - v.pos.x, tv.pos.z - v.pos.z);
        if (d < 4.2) {
          const push = (4.2 - d) * 0.5;
          const a = Math.atan2(v.pos.x - tv.pos.x, v.pos.z - tv.pos.z);
          v.pos.x += Math.sin(a) * push;
          v.pos.z += Math.cos(a) * push;
          if (Math.abs(v.speed) > 10) {
            v.speed *= 0.6;
            state.shake = 0.7;
            audio.crash();
            damagePlayer(4, 'traffic collision');
            police.addHeat(4);
          }
        }
      }
      if (input.wasPressed('KeyE')) exitVehicle();
      if (input.wasPressed('KeyF')) {
        // Swap car/boat at the water's edge.
        const other = v.kind === 'car' ? nearestVehicle(14, 'boat') : nearestVehicle(14, 'car');
        if (other) { exitVehicle(); enterVehicle(other); }
        else hud.toast(v.kind === 'car' ? 'No boat close by — get to the canal or the Marina.' : 'No car close by.');
      }
      if (v.stalled) hud.toast('Engine stalled in the flood! Wait for the tide to drop — or buy wet-grip tires.');
      player.pos.copy(v.pos);
      player.heading = v.heading;
      player.speed = v.speed;
    } else {
      // On foot.
      const runMul = input.run ? 1.9 : 1;
      const moveSpeed = 7 * runMul;
      let mx = 0, mz = 0;
      const ch = player.heading;
      if (input.forward) { mx += -Math.sin(ch); mz += -Math.cos(ch); }
      if (input.back) { mx -= -Math.sin(ch); mz -= -Math.cos(ch); }
      if (input.left) player.heading += 2.6 * dt;
      if (input.right) player.heading -= 2.6 * dt;
      if (input.mouseDX) player.heading -= input.mouseDX * 0.003;
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        player.pos.x += (mx / len) * moveSpeed * dt;
        player.pos.z += (mz / len) * moveSpeed * dt;
        player.speed = moveSpeed;
      } else player.speed = 0;
      player.pos.x = Math.max(-WORLD.half + 3, Math.min(WORLD.half - 3, player.pos.x));
      player.pos.z = Math.max(-WORLD.half + 3, Math.min(WORLD.half - 3, player.pos.z));
      collideCircle(player.pos, 0.8);
      // Wading: deep flood slows walking hard.
      const depth = waterDepthAt(player.pos.x, player.pos.z, tide.waterY);
      if (depth > 0.9) {
        player.pos.x -= (mx / (len || 1)) * moveSpeed * dt * 0.6;
        player.pos.z -= (mz / (len || 1)) * moveSpeed * dt * 0.6;
      }
      player.mesh.position.copy(player.pos);
      player.mesh.position.y = Math.abs(Math.sin(t * 9)) * (player.speed > 0 ? 0.08 : 0);
      player.mesh.rotation.y = player.heading;
      // Enter a vehicle.
      if (input.wasPressed('KeyE')) {
        const v = nearestVehicle(6);
        if (v) enterVehicle(v);
        else hud.toast('No vehicle close by. Walk to a parked car or a docked boat.');
      }
      if (input.wasPressed('KeyF')) {
        const b = nearestVehicle(8, 'boat');
        if (b) enterVehicle(b);
      }
      // Shoot.
      shootCooldown = Math.max(0, shootCooldown - dt);
      if (input.mouseClicked && shootCooldown <= 0) shoot();
      if (input.wasPressed('KeyR')) hud.toast('Reloaded. (Ammo is infinite in Port Solmar.)');
    }

    // --- world systems ---
    traffic.update(dt, tide.waterY, player.pos, Math.abs(player.speed || 0));
    const pol = police.update(dt, player, tide.waterY, !!state.inVehicle);
    if (pol.wanted > state.bestWanted) state.bestWanted = pol.wanted;
    if (pol.wanted > 0) state.hadWanted = true;
    if (pol.busted) damagePlayer(999, 'busted by the PSPD');

    // --- missions ---
    const step = missions.currentStep();
    const mres = missions.update(dt, player, state);
    if (mres && mres.done === 'mission') hud.toast('Mission complete! Check the job board (J) for the next one.');

    // --- collectibles ---
    for (const c of charts) {
      if (c.taken) continue;
      c.mesh.rotation.y = t * 1.5;
      c.mesh.position.y = c.y + Math.sin(t * 2 + c.x) * 0.3;
      const d = Math.hypot(player.pos.x - c.x, player.pos.z - c.z);
      if (d < 3 && Math.abs((state.inVehicle ? 1.5 : player.pos.y) - c.y) < 4) {
        c.taken = true;
        c.mesh.visible = false;
        state.charts++;
        state.cash += 50;
        audio.pickup();
        hud.toast(`Tide chart ${state.charts}/12 found! +$50.`);
        persist();
      }
    }

    // --- audio + HUD ---
    const speed01 = state.inVehicle ? Math.abs(state.inVehicle.speed) / state.inVehicle.def.topSpeed : Math.abs(player.speed) / 13;
    audio.update(Math.min(1, speed01), tide.level, state.inBoat, pol.wanted);
    if (state.health < START_HEALTH && pol.wanted === 0) state.health = Math.min(START_HEALTH, state.health + dt * 2);
    hud.update({
      health: state.health,
      cash: state.cash,
      wanted: pol.wanted,
      jobText: step ? (missions.active && missions.active.def ? `${missions.active.def.title}: ${step.text}` : step.text) : 'Free roam — press J for the job board',
      speed: state.inVehicle ? state.inVehicle.speed : 0,
      inVehicle: !!state.inVehicle,
      tideLevel: tide.level,
      tideRising: tide.rising,
      secondsToHigh: tide.secondsToHigh,
      secondsToLow: tide.secondsToLow,
      streetsFlooded: tide.streetsFlooded,
      dispatch: pol.dispatch,
      playerX: player.pos.x,
      playerZ: player.pos.z,
      playerHeading: player.heading,
      police: police.units.map((u) => ({ x: u.pos.x, z: u.pos.z })),
      traffic: traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      objective: step && step.at ? step.at : null,
      waterY: tide.waterY,
    });
    missions.updateBeaconPulse(t);

    saveTimer += dt;
    if (saveTimer > 12) { saveTimer = 0; persist(); }
    updateCamera(dt);
  } else if (state.mode === 'title') {
    // Slow orbit over the dusk city behind the title screen.
    const a = t * 0.03;
    camera.position.set(Math.cos(a) * 180, 55, Math.sin(a) * 180);
    camera.lookAt(0, 4, 0);
    tide.update(dt);
    city.update(dt, tide.waterY, tide.level);
    traffic.update(dt, tide.waterY, player.pos, 0);
  } else if (state.mode === 'paused' || state.mode === 'busted') {
    updateCamera(dt);
  }

  input.endFrame();
  renderer.render(scene, camera);
  fpsFrames++;
  fpsTime += dt;
  if (fpsTime > 5) {
    window.__lowtideFps = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Click on the canvas unlocks audio + pointer lock (mouse-look on foot).
renderer.domElement.addEventListener('click', () => {
  audio.unlock();
  if (state.mode === 'play' && !state.inVehicle) input.lockPointer();
});

// Start: title screen, or a staged shot.
if (SHOT) applyShotPreset();
else showTitle();
animate();
