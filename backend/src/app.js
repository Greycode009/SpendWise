/**
 * Express application (no network listening here — see server.js — so tests
 * can import the app directly with supertest).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { router } from './routes/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'connect-src': ["'self'"],
          'worker-src': ["'self'"],
          'manifest-src': ["'self'"],
          // Not forced: it would break plain-http use on localhost / a LAN IP.
          // In production serve over HTTPS (HSTS is enabled by helmet).
          'upgrade-insecure-requests': null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  if (config.corsOrigins.length) {
    app.use('/api', cors({ origin: config.corsOrigins, methods: ['GET', 'POST', 'PATCH', 'DELETE'], maxAge: 86400 }));
  }

  app.use(express.json({ limit: '1mb' }));

  if (!config.isProduction && !config.isTest) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        if (req.path.startsWith('/api')) console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
      });
      next();
    });
  }

  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store'); // financial data must never be cached by proxies
    next();
  });
  app.use('/api', apiLimiter, router);
  app.use('/api', notFoundHandler);

  // Serve the built PWA (frontend/dist) so one server hosts app + API.
  const clientDist = config.clientDist || path.resolve(__dirname, '../../frontend/dist');
  if (config.serveClient && fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(
      express.static(clientDist, {
        index: false,
        setHeaders(res, filePath) {
          // Hashed assets can be cached forever; the service worker and HTML must always be revalidated.
          if (filePath.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
          else res.set('Cache-Control', 'no-cache');
        },
      }),
    );
    // Client-side routing: any other GET returns the app shell.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
