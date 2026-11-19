// LOWTIDE — city.js
// One clear job: build Port Solmar — one compact island, two canals, five
// districts, neon, palms, bridges, the safehouse and the vault. Everything
// is procedural boxes + canvas textures; no outside assets. The tide
// animates two water meshes this file owns.

import * as THREE from 'three';
import { WORLD, DISTRICTS, CANALS, ROADS_X, ROADS_Z, ROAD_HALF_WIDTH, PALETTE, SAFEHOUSE, VAULT } from './config.js';

// Deterministic RNG so every screenshot run builds the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function facadeTexture(rng, base, litRatio) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 10; y += 22) {
      for (let x = 10; x < w - 10; x += 18) {
        const lit = rng() < litRatio;
        g.fillStyle = lit ? (rng() < 0.6 ? '#ffd27a' : '#7de3ff') : '#10141f';
        g.fillRect(x, y, 11, 14);
      }
    }
  });
}

function neonTexture(text, color) {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#0a0a12'; g.fillRect(0, 0, w, h);
    const size = text.length > 10 ? 26 : 34;
    g.font = `bold ${size}px Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 18;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 1);
    g.shadowBlur = 4; g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2 + 1);
  });
}

export function isInCanal(x, z) {
  for (const c of CANALS) {
    if (c.axis === 'x' && Math.abs(x - c.at) < c.halfWidth) return true;
    if (c.axis === 'z' && Math.abs(z - c.at) < c.halfWidth) return true;
  }
  return false;
}

export function isOnRoad(x, z) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_HALF_WIDTH) return true;
  for (const rz of ROADS_Z) if (Math.abs(z - rz) < ROAD_HALF_WIDTH) return true;
  return false;
}

// Depth of water at a point, given the current water level.
export function waterDepthAt(x, z, waterY) {
  if (isInCanal(x, z)) return Math.max(0, waterY + 2.2);
  return Math.max(0, waterY);
}

export function createCity(scene) {
  const rng = mulberry32(20261119);
  const group = new THREE.Group();
  scene.add(group);
  const H = WORLD.half;

  // --- ground: 4 rectangles around the cross-shaped canals ---
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.95 });
  const rects = [
    [-H, 31, -H, 21], [ -H, 31, 39, H],
    [49, H, -H, 21], [49, H, 39, H],
  ];
  for (const [x0, x1, z0, z1] of rects) {
    const w = x1 - x0, d = z1 - z0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), groundMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    m.receiveShadow = true;
    group.add(m);
  }

  // --- canal floors (deep, dark) ---
  const canalFloorMat = new THREE.MeshStandardMaterial({ color: 0x06121a, roughness: 1 });
  for (const c of CANALS) {
    const w = c.axis === 'x' ? c.halfWidth * 2 : H * 2;
    const d = c.axis === 'x' ? H * 2 : c.halfWidth * 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), canalFloorMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(c.axis === 'x' ? c.at : 0, -2.2, c.axis === 'x' ? 0 : c.at);
    group.add(m);
  }

  // --- canal water (animated y) + flood water over the streets ---
  const waterMat = new THREE.MeshStandardMaterial({
    color: PALETTE.water, transparent: true, opacity: 0.82,
    roughness: 0.15, metalness: 0.55, emissive: 0x062a33, emissiveIntensity: 0.5,
  });
  const canalWater = new THREE.Group();
  for (const c of CANALS) {
    const w = c.axis === 'x' ? c.halfWidth * 2 : H * 2;
    const d = c.axis === 'x' ? H * 2 : c.halfWidth * 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), waterMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(c.axis === 'x' ? c.at : 0, 0, c.axis === 'x' ? 0 : c.at);
    canalWater.add(m);
  }
  group.add(canalWater);
  const floodMat = new THREE.MeshStandardMaterial({
    color: 0x1fa8b8, transparent: true, opacity: 0,
    roughness: 0.05, metalness: 0.85, emissive: 0x1a7d8f, emissiveIntensity: 0.9,
  });
  const flood = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, H * 2), floodMat);
  flood.rotation.x = -Math.PI / 2;
  flood.position.y = 0.4;
  flood.visible = false;
  group.add(flood);

  // --- roads: dark strips + centre dashes, skipping canal crossings ---
  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.6, metalness: 0.2 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  const sideMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 0.9 });
  function roadStrip(x0, z0, x1, z1) {
    const w = Math.abs(x1 - x0) || ROAD_HALF_WIDTH * 2;
    const d = Math.abs(z1 - z0) || ROAD_HALF_WIDTH * 2;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, 0.02, cz);
    road.receiveShadow = true;
    group.add(road);
    // dashes along the centre
    const len = Math.max(w, d);
    const n = Math.floor(len / 9);
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + 4.5 + i * 9;
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.2), dashMat);
      dash.rotation.x = -Math.PI / 2;
      if (w > d) { dash.rotation.z = Math.PI / 2; dash.position.set(cx + t, 0.03, cz); }
      else dash.position.set(cx, 0.03, cz + t);
      group.add(dash);
    }
  }
  // Vertical roads (along z), split around the z-canal; horizontal roads split around the x-canal.
  for (const rx of ROADS_X) {
    roadStrip(rx - ROAD_HALF_WIDTH, -H, rx + ROAD_HALF_WIDTH, 21);
    roadStrip(rx - ROAD_HALF_WIDTH, 39, rx + ROAD_HALF_WIDTH, H);
    // sidewalk edges
    for (const s of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(2.4, H * 2 - 18), sideMat);
      sw.rotation.x = -Math.PI / 2;
      sw.position.set(rx + s * (ROAD_HALF_WIDTH + 1.2), 0.015, 0);
      group.add(sw);
    }
  }
  for (const rz of ROADS_Z) {
    roadStrip(-H, rz - ROAD_HALF_WIDTH, 31, rz + ROAD_HALF_WIDTH);
    roadStrip(49, rz - ROAD_HALF_WIDTH, H, rz + ROAD_HALF_WIDTH);
  }

  // --- bridges where roads cross canals ---
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 0.7 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xff9a1f, roughness: 0.5, emissive: 0x662200, emissiveIntensity: 0.4 });
  function bridge(x, z, alongX) {
    const g = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 26 : 15, 0.5, alongX ? 15 : 26), bridgeMat);
    deck.position.y = 0.35;
    g.add(deck);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 26 : 0.4, 1.0, alongX ? 0.4 : 26), railMat);
      rail.position.set(0, 1.0, alongX ? s * 7.2 : 0);
      if (!alongX) rail.position.set(s * 7.2, 1.0, 0);
      g.add(rail);
    }
    g.position.set(x, 0, z);
    group.add(g);
  }
  for (const rx of ROADS_X) bridge(rx, 30, false);
  for (const rz of ROADS_Z) bridge(40, rz, true);

  // --- buildings: seeded blocks, kept off roads and canals ---
  const facadeBases = ['#2e3440', '#3a2f3d', '#26343a', '#40342a', '#2f2a3d'];
  const buildingMeshes = [];
  const placed = [];
  function clearOfRoadsAndCanals(x, z, w, d) {
    if (isInCanal(x, z)) return false;
    for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_HALF_WIDTH + w / 2 + 3) return false;
    for (const rz of ROADS_Z) if (Math.abs(z - rz) < ROAD_HALF_WIDTH + d / 2 + 3) return false;
    for (const p of placed) {
      if (Math.abs(x - p.x) < (w + p.w) / 2 + 4 && Math.abs(z - p.z) < (d + p.d) / 2 + 4) return false;
    }
    return true;
  }
  let attempts = 0;
  while (buildingMeshes.length < 90 && attempts++ < 900) {
    const w = 14 + rng() * 14, d = 14 + rng() * 14;
    const h = 10 + rng() * rng() * 42;
    const x = -H + 20 + rng() * (H * 2 - 40);
    const z = -H + 20 + rng() * (H * 2 - 40);
    if (!clearOfRoadsAndCanals(x, z, w, d)) continue;
    // keep the vault plot and safehouse plot clear
    if (Math.hypot(x - VAULT.x, z - VAULT.z) < 34) continue;
    if (Math.hypot(x - SAFEHOUSE.x, z - SAFEHOUSE.z) < 26) continue;
    const tex = facadeTexture(rng, facadeBases[Math.floor(rng() * facadeBases.length)], 0.55);
    const mat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.85,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.45,
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    b.castShadow = true;
    group.add(b);
    // rooftop rim glow on tall towers
    if (h > 30) {
      const rim = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4),
        new THREE.MeshBasicMaterial({ color: rng() < 0.5 ? PALETTE.neonMagenta : PALETTE.neonCyan }),
      );
      rim.position.set(x, h + 0.25, z);
      group.add(rim);
    }
    buildingMeshes.push(b);
    placed.push({ x, z, w, d });
  }

  // --- neon signs on the Boulevard ---
  const SIGNS = [
    { text: 'SOLMAR', color: '#ff2d78', x: -12, z: -52, y: 16 },
    { text: 'TIDE BAR', color: '#19c2d8', x: 14, z: -30, y: 12 },
    { text: 'NEON MOTEL', color: '#ff9a1f', x: -30, z: -18, y: 14 },
    { text: 'CASINO SOL', color: '#ffd27a', x: 30, z: -58, y: 18 },
    { text: '24H TACOS', color: '#19c2d8', x: -8, z: -70, y: 10 },
    { text: 'HOTEL MAR', color: '#ff2d78', x: 52, z: -30, y: 15 },
  ];
  for (const s of SIGNS) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 4),
      new THREE.MeshBasicMaterial({ map: neonTexture(s.text, s.color), transparent: true }),
    );
    m.position.set(s.x, s.y, s.z);
    m.rotation.y = rng() < 0.5 ? 0 : Math.PI;
    group.add(m);
  }

  // --- streetlights along the Boulevard and Causeway ---
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const lampPositions = [];
  for (let i = 0; i < 14; i++) {
    lampPositions.push([-12 + (i % 2) * 24, -170 + i * 26]);
  }
  for (let i = 0; i < 8; i++) lampPositions.push([-60 + i * 14, 158]);
  for (const [x, z] of lampPositions) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7, 6), poleMat);
    pole.position.set(x, 3.5, z);
    group.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
    lamp.position.set(x, 7.1, z);
    group.add(lamp);
  }

  // --- palms along the Marina and Boulevard ---
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7d4f, roughness: 0.9, side: THREE.DoubleSide });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 7, 6), trunkMat);
    trunk.position.y = 3.5; trunk.rotation.z = 0.08;
    g.add(trunk);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.4), leafMat);
      leaf.position.y = 7.2;
      leaf.rotation.y = (i / 5) * Math.PI * 2;
      leaf.rotation.x = -0.5;
      leaf.translateY(1.2);
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    group.add(g);
  }
  for (let i = 0; i < 10; i++) palm(-170 + i * 12, -128 + (i % 2) * 8);
  for (let i = 0; i < 8; i++) palm(-60 + i * 16, -8 + (i % 2) * 10);

  // --- Stilt Quarter: houses on posts over the canal edges + washing lines ---
  const stiltMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 });
  const stiltRoofMat = new THREE.MeshStandardMaterial({ color: 0x8a2f3d, roughness: 0.9 });
  const stiltHouses = [];
  for (let i = 0; i < 8; i++) {
    const x = 100 + i * 12;
    const z = i % 2 === 0 ? 18 : 42;
    const g = new THREE.Group();
    for (const [px, pz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 6), stiltMat);
      post.position.set(px, 2, pz);
      g.add(post);
    }
    const house = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 8), new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.9 }));
    house.position.y = 6.5;
    g.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 3, 4), stiltRoofMat);
    roof.position.y = 10.5; roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.6), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    win.position.set(0, 6.5, 4.05);
    g.add(win);
    g.position.set(x, 0, z);
    group.add(g);
    stiltHouses.push({ x, z });
    // washing line to the next house
    if (i < 7) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(11, 0.08), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
      line.position.set(x + 6, 8.5, z);
      group.add(line);
      for (let k = 0; k < 3; k++) {
        const cloth = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 1.6),
          new THREE.MeshBasicMaterial({ color: [0xff2d78, 0x19c2d8, 0xffd27a][k], side: THREE.DoubleSide }),
        );
        cloth.position.set(x + 3 + k * 3, 7.6, z);
        group.add(cloth);
      }
    }
  }

  // --- Marina docks + moored boats (visual only; drivable boats spawn in vehicles.js) ---
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x6b4e2e, roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 26), dockMat);
    dock.position.set(-168 + i * 14, 0.4, -118);
    group.add(dock);
  }

  // --- Safehouse: warm-lit house with a sign and a driveway ---
  const sh = new THREE.Group();
  const shBase = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 14), new THREE.MeshStandardMaterial({ color: 0xd8c9a3, roughness: 0.9 }));
  shBase.position.y = 4;
  sh.add(shBase);
  const shRoof = new THREE.Mesh(new THREE.ConeGeometry(13, 5, 4), new THREE.MeshStandardMaterial({ color: 0x5a2f2f, roughness: 0.9 }));
  shRoof.position.y = 10.5; shRoof.rotation.y = Math.PI / 4;
  sh.add(shRoof);
  const shSign = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: neonTexture('SAFEHOUSE', '#ffd27a'), transparent: true }),
  );
  shSign.position.set(0, 6, 7.2);
  sh.add(shSign);
  const shDoor = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  shDoor.position.set(0, 2, 7.05);
  sh.add(shDoor);
  sh.position.set(SAFEHOUSE.x, 0, SAFEHOUSE.z);
  group.add(sh);

  // --- Meridian Vault: gold facade, columns, the heist target ---
  const vault = new THREE.Group();
  const vBase = new THREE.Mesh(new THREE.BoxGeometry(26, 16, 20), new THREE.MeshStandardMaterial({ color: 0x8a6d2f, roughness: 0.4, metalness: 0.6 }));
  vBase.position.y = 8;
  vault.add(vBase);
  for (let i = -1; i <= 1; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd8b13a, roughness: 0.35, metalness: 0.7 }));
    col.position.set(i * 8, 7, 10.5);
    vault.add(col);
  }
  const vSign = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 4),
    new THREE.MeshBasicMaterial({ map: neonTexture('MERIDIAN VAULT', '#ffd27a'), transparent: true }),
  );
  vSign.position.set(0, 17.5, 10.2);
  vault.add(vSign);
  vault.position.set(VAULT.x, 0, VAULT.z);
  group.add(vault);

  // --- buoys in the canals (tide-chart collectibles float here) ---
  const buoyMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.6 });
  const buoys = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 8), buoyMat);
    const x = 40 + (i % 2 === 0 ? -5 : 5);
    const z = -160 + i * 60;
    b.position.set(x, 0.4, z);
    group.add(b);
    buoys.push(b);
  }

  // --- distant skyline silhouettes outside the island (cheap depth) ---
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x1a1428, fog: true });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = 320 + rng() * 60;
    const h = 30 + rng() * 70;
    const b = new THREE.Mesh(new THREE.BoxGeometry(24, h, 24), skyMat);
    b.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
    group.add(b);
  }

  // --- dusk sky dome (gradient) + low sun disc: the shot's one light source ---
  const skyTex = canvasTexture(4, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#141c38');
    grad.addColorStop(0.45, '#4a2a55');
    grad.addColorStop(0.72, '#c65a2e');
    grad.addColorStop(1, '#ff8c3a');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(760, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 24),
    new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false }),
  );
  sunDisc.position.set(-420, 70, -560);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(60, 24),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.35, fog: false }),
  );
  sunGlow.position.set(-421, 70, -561);
  sunGlow.lookAt(0, 0, 0);
  scene.add(sunGlow);
  // --- sun + lights (dusk). setMorning()/setDusk() shift them. ---
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
  sun.position.set(-180, 60, -120);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x8a7aaa, 0x3a2a30, 1.35);
  scene.add(hemi);
  const vaultLight = new THREE.PointLight(0xffd27a, 80, 70, 1.6);
  vaultLight.position.set(VAULT.x, 10, VAULT.z + 22);
  scene.add(vaultLight);
  const marinaLight = new THREE.PointLight(0x19c2d8, 40, 55, 1.6);
  marinaLight.position.set(-140, 10, -110);
  scene.add(marinaLight);

  let bobT = 0;
  return {
    group,
    buildings: buildingMeshes,
    stiltHouses,
    buoys,
    setMorning() {
      sun.color.setHex(0xfff2cf);
      sun.intensity = 2.0;
      sun.position.set(120, 140, 40);
      hemi.intensity = 1.2;
      sky.visible = false;
      sunDisc.visible = false;
      sunGlow.visible = false;
      scene.fog.color.setHex(0x9ab8c8);
      scene.background = new THREE.Color(0x9fc3d8);
    },
    setDusk() {
      sun.color.setHex(PALETTE.sun);
      sun.intensity = 2.4;
      sun.position.set(-180, 60, -120);
      hemi.intensity = 1.35;
      sky.visible = true;
      sunDisc.visible = true;
      sunGlow.visible = true;
      scene.fog.color.setHex(PALETTE.fog);
      scene.background = new THREE.Color(0x2a1e33);
    },
    update(dt, waterY, tideLevel) {
      bobT += dt;
      canalWater.position.y = waterY;
      // Flood plane rides the water once streets go under.
      if (waterY > 0.12) {
        flood.visible = true;
        flood.position.y = waterY + 0.02;
        floodMat.opacity = Math.min(0.85, 0.25 + waterY * 0.45);
        floodMat.color.setHex(tideLevel > 0.7 ? PALETTE.waterHigh : PALETTE.water);
      } else {
        flood.visible = false;
      }
      // Buoys bob on the canal water.
      for (let i = 0; i < buoys.length; i++) {
        buoys[i].position.y = waterY + 0.5 + Math.sin(bobT * 1.3 + i) * 0.15;
        buoys[i].rotation.z = Math.sin(bobT + i) * 0.08;
      }
    },
  };
}
