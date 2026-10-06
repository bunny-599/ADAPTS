import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';
import topicRoutes from './routes/topicRoutes';
import { checkDatabaseConnection, pool, getDatabaseConfig } from './db';
import { globalLimiter } from './middleware/rateLimitMiddleware';
import { requestLogger, globalErrorHandler } from './middleware/errorMiddleware';

dns.setDefaultResultOrder('ipv4first');

// Load environment variables: backend/.env takes highest priority, root .env fills in any gaps
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false });
dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows cross-origin API interactions
    crossOriginEmbedderPolicy: false,
  })
);

// Response Compression for fast data transfer
app.use(compression());

// CORS configuration with production domain support
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      // Always allow local development and testing origins regardless of port
      if (
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')
      ) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not permitted by CORS policy.`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Request parsing with limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Request Logging & Rate Limiting
app.use(requestLogger);
app.use('/api', globalLimiter);

// Health check endpoint (Liveness probe)
app.get('/api/health', async (_req, res) => {
  const dbConnected = await checkDatabaseConnection();
  const dbConfig = getDatabaseConfig();
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    databaseConnected: dbConnected,
    database: {
      host: dbConfig.host,
      port: dbConfig.port,
      name: dbConfig.database,
      user: dbConfig.user,
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Readiness check endpoint (Kubernetes / Cloud Readiness probe)
app.get('/api/ready', async (_req, res) => {
  const dbConnected = await checkDatabaseConnection();
  const memUsage = process.memoryUsage();

  if (!dbConnected && isProduction) {
    res.status(503).json({
      status: 'unready',
      database: 'disconnected',
      message: 'Database connection failed.',
    });
    return;
  }

  res.status(200).json({
    status: 'ready',
    database: dbConnected ? 'connected' : 'offline_fallback',
    memory: {
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMb: Math.round(memUsage.rss / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api', topicRoutes);

// Global Centralized Error Handler
app.use(globalErrorHandler);

import { questionValidationEngine } from './services/questionValidationEngine';

// Start HTTP Server
const server = app.listen(port, () => {
  console.log(`[ADAPTS Production Server] Running on http://localhost:${port}`);
  console.log(`[Environment] ${process.env.NODE_ENV || 'development'}`);
  console.log(`[CORS] Allowed Origins: ${allowedOrigins.join(', ')}`);
  const dbConfig = getDatabaseConfig();
  console.log(`[Database Routing] Target: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  checkDatabaseConnection().then((connected) => {
    if (connected) {
      console.log(`[Database] Successfully verified connection to PostgreSQL database "${dbConfig.database}"`);
    } else {
      console.warn(`[Database] Failed to connect to PostgreSQL database "${dbConfig.database}" at ${dbConfig.host}:${dbConfig.port}`);
    }
  });

  // Revalidate persisted candidate questions asynchronously on startup
  questionValidationEngine.revalidatePersistedQuestions()
    .then((res) => {
      if (res.revalidated > 0) {
        console.log(`[Validation Engine] Startup revalidation complete: ${res.revalidated} questions analyzed (${res.markedValid} valid, ${res.markedInvalid} invalid).`);
      }
    })
    .catch((err) => {
      console.warn('[Validation Engine] Startup revalidation warning:', err.message);
    });
});


// Graceful Shutdown Handler
const shutdown = async (signal: string) => {
  console.log(`\n[Shutdown] Received ${signal}. Closing server gracefully...`);
  server.close(async () => {
    console.log('[Shutdown] HTTP server closed.');
    try {
      await pool.end();
      console.log('[Shutdown] PostgreSQL connection pool closed.');
    } catch (err: any) {
      console.error('[Shutdown] Error closing database pool:', err.message);
    }
    process.exit(0);
  });

  // Force shutdown after 10s if hanging
  setTimeout(() => {
    console.error('[Shutdown] Forceful shutdown timeout exceeded. Exiting.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
