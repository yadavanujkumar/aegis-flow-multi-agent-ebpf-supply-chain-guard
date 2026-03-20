import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './infrastructure/Logger';
import { register, httpRequestDuration } from './infrastructure/MetricsService';
import { Orchestrator } from './usecases/Orchestrator';
import { NatsService } from './infrastructure/NatsService';
import { OllamaService } from './infrastructure/OllamaService';
import { SlackService } from './infrastructure/SlackService';
import { SigstoreService } from './infrastructure/SigstoreService';
import { apiKeyAuth } from './middleware/auth';
import { validateBody } from './middleware/validate';
import { DetonationRequestSchema } from './domain/Events';

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();

// Security headers
app.use(helmet());

// Body parsing (limit payload size to guard against DoS)
app.use(express.json({ limit: '100kb' }));

// Rate limiting
app.use(
  rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too Many Requests', message: 'Rate limit exceeded. Try again later.' },
  })
);

// HTTP request duration instrumentation
app.use((req: Request, res: Response, next: NextFunction) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path ?? req.path, status_code: res.statusCode });
  });
  next();
});

// ─── Service Wiring ───────────────────────────────────────────────────────────

const natsService = new NatsService(config.NATS_URL);
const ollamaService = new OllamaService(config.OLLAMA_URL);
const slackService = new SlackService(config.SLACK_WEBHOOK_URL);
const sigstoreService = new SigstoreService();
const orchestrator = new Orchestrator(natsService, ollamaService, slackService, sigstoreService);

// ─── Routes ───────────────────────────────────────────────────────────────────

// Detailed health check – returns live service states
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    version: process.env.npm_package_version ?? '0.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      nats: 'connected',
      ollama: config.OLLAMA_URL,
      slack: config.SLACK_WEBHOOK_URL ? 'configured' : 'not configured',
    },
  });
});

// Prometheus-compatible metrics endpoint (no auth – expose behind internal network)
if (config.METRICS_ENABLED) {
  app.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
}

// Authenticated routes
app.use('/api', apiKeyAuth);

app.post(
  '/api/webhook/cicd',
  validateBody(DetonationRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const { repository, commit, dependencyFile, ref, triggeredBy } = req.body;
      logger.info('CI/CD webhook received', { repository, commit, dependencyFile, ref, triggeredBy });
      await orchestrator.triggerDetonation(repository, commit, dependencyFile);
      res.status(202).json({
        message: 'Detonation triggered successfully',
        data: { repository, commit, dependencyFile },
      });
    } catch (error) {
      logger.error('Webhook handler error', { error });
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

// ─── Global Error Handler ────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled Express error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error' });
});

// ─── Bootstrap & Graceful Shutdown ───────────────────────────────────────────

async function bootstrap(): Promise<void> {
  await natsService.connect();
  orchestrator.listenForTelemetry();

  const server = app.listen(config.PORT, () => {
    logger.info('Aegis-Flow Orchestrator started', {
      port: config.PORT,
      env: config.NODE_ENV,
      metrics: config.METRICS_ENABLED,
    });
  });

  async function shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal} – starting graceful shutdown`);
    server.close(async () => {
      try {
        await natsService.drain();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error('Error during graceful shutdown', { error: err });
        process.exit(1);
      }
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal bootstrap error', { error: err });
  process.exit(1);
});
