import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApi } from './shared/handlers';

/**
 * Serves /api/* during `vite dev` using the same handler the Netlify
 * Function uses, so no Netlify CLI is needed for local development.
 */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        try {
          const url = new URL(req.url, 'http://localhost');
          const response = await handleApi(new Request(url, { method: req.method }));
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(await response.text());
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [preact(), devApi()],
  build: { target: 'es2020' },
});
