// LOWTIDE — input.js
// One clear job: keyboard + mouse state, nothing else. The game reads
// this, it never reads DOM events directly.

export function createInput() {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered: cleared once per frame
  let mouseDX = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let pointerLocked = false;

  const onKeyDown = (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onMouseMove = (e) => { if (pointerLocked) mouseDX += e.movementX || 0; };
  const onMouseDown = (e) => { if (e.button === 0) { mouseDown = true; mouseClicked = true; } };
  const onMouseUp = (e) => { if (e.button === 0) mouseDown = false; };
  const onLockChange = () => { pointerLocked = document.pointerLockElement === document.body; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    // Held keys
    get forward() { return keys.has('KeyW') || keys.has('ArrowUp'); },
    get back() { return keys.has('KeyS') || keys.has('ArrowDown'); },
    get left() { return keys.has('KeyA') || keys.has('ArrowLeft'); },
    get right() { return keys.has('KeyD') || keys.has('ArrowRight'); },
    get run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    get brake() { return keys.has('Space'); },
    get boost() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    // Edge-triggered keys (true once, then cleared by endFrame)
    wasPressed(code) { return pressed.has(code); },
    get mouseClicked() { return mouseClicked; },
    get mouseDown() { return mouseDown; },
    get mouseDX() { return mouseDX; },
    get pointerLocked() { return pointerLocked; },
    lockPointer() { try { document.body.requestPointerLock(); } catch (_) { /* headless */ } },
    endFrame() { pressed.clear(); mouseDX = 0; mouseClicked = false; },
  };
}
