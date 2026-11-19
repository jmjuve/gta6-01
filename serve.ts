// LOWTIDE — serve.ts (Node 22, standard library only).
// Serves game/ on http://localhost:8080 for local play-testing.
// Usage: node serve.ts [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.argv[2] ?? 8080);
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
};

createServer(async (req, res) => {
  try {
    const path = req.url.split('?')[0];
    const file = join(here, 'game', path === '/' ? 'index.html' : decodeURIComponent(path));
    if (!file.startsWith(join(here, 'game'))) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(port, () => console.log(`LOWTIDE serving game/ at http://localhost:${port}`));
