// LOWTIDE — main.ts (Node 22, standard library only).
// The entry program for make.fun gta6-01. It hands the game in: it copies
// this repository's game/ and screenshots/ beside this file into /output
// and writes /output/dossier.json with the vendored make.fun library, so
// the judge can read the game. game/ is plain static files a desktop
// browser loads offline (game/index.html and its ES modules, three.js
// vendored under game/vendor/, no network request).
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game itself with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps (reference/gate.json): game/ at most 993 files and
// 48 MiB, screenshots at most 4 files of 256 KiB each, dossier text at
// most 160 KiB. Refuse locally what the scorer would refuse, so a bad
// build fails here instead of on the platform.
function checkTree(dir, maxFiles, maxBytes, label) {
  let files = 0;
  let bytes = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (s.isFile()) {
        files += 1;
        bytes += s.size;
        if (name.length > 128) throw new Error(`${label}: file name too long: ${name}`);
      } else {
        throw new Error(`${label}: not a plain file or directory: ${p}`);
      }
    }
  };
  walk(dir);
  if (files > maxFiles) throw new Error(`${label}: ${files} files, over the ${maxFiles} cap`);
  if (bytes > maxBytes) throw new Error(`${label}: ${bytes} bytes, over the ${maxBytes} cap`);
}

mkdirSync(out, { recursive: true });
checkTree(join(here, 'game'), 993, 50331648, 'game/');
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  checkTree(join(here, 'screenshots'), 4, 1048576, 'screenshots/');
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
