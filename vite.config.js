import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Dev-only plugin: exposes POST /dev/save-upgrades to write upgrades.json. */
function devUpgradesPlugin() {
  return {
    name: 'dev-upgrades-writer',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Redirect clean URL → HTML file for the tech tree designer page
        if (req.url === '/dev/techtreedesigner') {
          req.url = '/dev/techtreedesigner.html';
        }

        if (req.method !== 'POST' || req.url !== '/dev/save-upgrades') return next();
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            JSON.parse(body); // validate
            writeFileSync(resolve('./src/data/upgrades.json'), body, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
        });
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
      },
    },
  },
});
