// LOWTIDE — hud.js
// One clear job: everything the player reads — health, cash, wanted
// stars, job text, the TIDE GAUGE, radio dispatch, and the minimap
// (2D canvas, blue tint as the streets flood).

import { WORLD, DISTRICTS, CANALS, ROADS_X, ROADS_Z, SAFEHOUSE, VAULT } from './config.js';

export function createHud() {
  const root = document.getElementById('hud');
  const el = {};
  for (const id of ['health', 'healthbar', 'cash', 'stars', 'job', 'tidefill', 'tidetext', 'speed', 'dispatch', 'toast', 'hint']) {
    el[id] = document.getElementById(id);
  }
  const map = document.getElementById('minimap');
  const mctx = map.getContext('2d');
  const MAP_SIZE = 168;
  const scale = MAP_SIZE / (WORLD.half * 2);

  function toMap(x, z) {
    return [(x + WORLD.half) * scale, (z + WORLD.half) * scale];
  }

  function setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    el.stars.textContent = s;
    el.stars.style.color = n >= 3 ? '#ff3b3b' : n > 0 ? '#ffd27a' : '#7de3a8';
  }

  let toastTimer = null;
  function toast(text, ms = 3600) {
    el.toast.textContent = text;
    el.toast.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.style.opacity = '0'; }, ms);
  }

  function hint(text, ms = 5000) {
    el.hint.textContent = text;
    el.hint.style.opacity = '1';
    setTimeout(() => { el.hint.style.opacity = '0'; }, ms);
  }

  function drawMinimap(state) {
    const { playerX, playerZ, playerHeading, police, objective, tideLevel, waterY, traffic } = state;
    const w = MAP_SIZE;
    mctx.clearRect(0, 0, w, w);
    // Island.
    mctx.fillStyle = '#1d2433';
    mctx.fillRect(0, 0, w, w);
    // Flood tint: the whole map goes blue as the water rises.
    if (waterY > 0.12) {
      mctx.fillStyle = `rgba(20,145,155,${Math.min(0.55, waterY * 0.4)})`;
      mctx.fillRect(0, 0, w, w);
    }
    // Canals.
    mctx.fillStyle = '#14919b';
    for (const c of CANALS) {
      if (c.axis === 'x') {
        const [x] = toMap(c.at, 0);
        mctx.fillRect(x - c.halfWidth * scale, 0, c.halfWidth * 2 * scale, w);
      } else {
        const [, y] = toMap(0, c.at);
        mctx.fillRect(0, y - c.halfWidth * scale, w, c.halfWidth * 2 * scale);
      }
    }
    // Roads.
    mctx.strokeStyle = '#4a4a58';
    mctx.lineWidth = 2;
    for (const rx of ROADS_X) {
      const [x] = toMap(rx, 0);
      mctx.beginPath(); mctx.moveTo(x, 0); mctx.lineTo(x, w); mctx.stroke();
    }
    for (const rz of ROADS_Z) {
      const [, y] = toMap(0, rz);
      mctx.beginPath(); mctx.moveTo(0, y); mctx.lineTo(w, y); mctx.stroke();
    }
    // Districts (faint labels).
    mctx.fillStyle = 'rgba(255,255,255,0.35)';
    mctx.font = '8px Arial';
    for (const d of DISTRICTS) {
      const [x, y] = toMap(d.cx, d.cz);
      mctx.fillText(d.name.toUpperCase(), x - 18, y);
    }
    // Safehouse + vault.
    const [sx, sy] = toMap(SAFEHOUSE.x, SAFEHOUSE.z);
    mctx.fillStyle = '#ffd27a';
    mctx.fillRect(sx - 3, sy - 3, 6, 6);
    const [vx, vy] = toMap(VAULT.x, VAULT.z);
    mctx.fillStyle = '#ff2d78';
    mctx.beginPath(); mctx.arc(vx, vy, 4, 0, Math.PI * 2); mctx.fill();
    // Traffic dots.
    mctx.fillStyle = '#c9c9c9';
    for (const t of traffic || []) {
      const [x, y] = toMap(t.x, t.z);
      mctx.fillRect(x - 1, y - 1, 2, 2);
    }
    // Police dots (red).
    mctx.fillStyle = '#ff3b3b';
    for (const p of police || []) {
      const [x, y] = toMap(p.x, p.z);
      mctx.beginPath(); mctx.arc(x, y, 3, 0, Math.PI * 2); mctx.fill();
    }
    // Objective marker (gold, pulsing).
    if (objective) {
      const [x, y] = toMap(objective[0], objective[1]);
      const r = 5 + Math.sin(performance.now() / 200) * 2;
      mctx.fillStyle = '#ffd27a';
      mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#fff';
      mctx.beginPath(); mctx.arc(x, y, r + 3, 0, Math.PI * 2); mctx.stroke();
    }
    // Player arrow.
    const [px, py] = toMap(playerX, playerZ);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.PI - playerHeading);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -6); mctx.lineTo(4, 5); mctx.lineTo(-4, 5); mctx.closePath();
    mctx.fill();
    mctx.restore();
    // Tide ring around the map edge.
    mctx.strokeStyle = tideLevel > 0.7 ? '#19c2d8' : '#2a4a5a';
    mctx.lineWidth = 3;
    mctx.strokeRect(1, 1, w - 2, w - 2);
  }

  function update(s) {
    el.health.textContent = Math.max(0, Math.round(s.health));
    el.healthbar.style.width = Math.max(0, Math.min(100, s.health)) + '%';
    el.healthbar.style.background = s.health > 50 ? '#7de3a8' : s.health > 25 ? '#ffd27a' : '#ff3b3b';
    el.cash.textContent = '$' + Math.round(s.cash).toLocaleString('en-US');
    setStars(s.wanted);
    el.job.textContent = s.jobText || 'Free roam — press J for the job board';
    el.speed.textContent = s.inVehicle ? Math.round(Math.abs(s.speed) * 2.2) + ' mph' : 'ON FOOT';
    // Tide gauge: fill + label + rising/falling arrow.
    const pct = Math.round(s.tideLevel * 100);
    el.tidefill.style.width = pct + '%';
    el.tidefill.style.background = s.tideLevel > 0.7 ? '#19c2d8' : s.tideLevel > 0.4 ? '#2a9db5' : '#2a6a7a';
    const next = s.tideRising ? `HIGH in ${s.secondsToHigh}s` : `LOW in ${s.secondsToLow}s`;
    el.tidetext.textContent = `TIDE ${pct}% ${s.tideRising ? '▲ RISING' : '▼ FALLING'} · ${next}${s.streetsFlooded ? ' · STREETS FLOODED' : ''}`;
    el.dispatch.textContent = s.dispatch || '';
    drawMinimap(s);
  }

  return { update, toast, hint, setStars };
}
