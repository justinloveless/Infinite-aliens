import { defineConfig } from 'vite';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Dev-only plugin: exposes POST routes that let in-game editors write back to src/data. */
function devUpgradesPlugin() {
  const SHIP_SLOT_IDS = new Set(['allrounder', 'heavy', 'fighter']);

  return {
    name: 'dev-upgrades-writer',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Redirect clean URL → HTML file for dev-only tool pages
        if (req.url === '/dev/techtreedesigner') {
          req.url = '/dev/techtreedesigner.html';
        }
        if (req.url === '/dev/shipslotdesigner') {
          req.url = '/dev/shipslotdesigner.html';
        }

        if (req.method === 'POST' && req.url === '/dev/save-upgrades') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              JSON.parse(body);
              writeFileSync(resolve('./src/data/upgrades.json'), body, 'utf8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: e.message }));
            }
          });
          return;
        }

        if (req.method === 'POST' && req.url === '/dev/save-ship-slots') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              const shipId = String(payload?.shipId || '');
              if (!SHIP_SLOT_IDS.has(shipId)) {
                throw new Error(`Unknown shipId "${shipId}". Expected one of: ${[...SHIP_SLOT_IDS].join(', ')}`);
              }
              const data = payload?.data;
              if (!data || !Array.isArray(data.slots)) {
                throw new Error('Payload must include { shipId, data: { slots: [...] } }.');
              }
              const target = resolve(`./src/data/shipSlots/${shipId}.json`);
              if (!existsSync(target)) {
                throw new Error(`Target file not found: ${target}`);
              }
              const json = JSON.stringify(data, null, 2) + '\n';
              writeFileSync(target, json, 'utf8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, shipId, path: target }));
            } catch (e) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: e.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    open: true,
  },
  plugins: [devUpgradesPlugin()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve('./index.html'),
        techDesigner: resolve('./dev/techtreedesigner.html'),
        shipSlotDesigner: resolve('./dev/shipslotdesigner.html'),
      },
    },
  },
});
