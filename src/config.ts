import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NATS_URL: z.string().url().default('nats://localhost:4222'),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().min(1).default('llama3'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  SLACK_WEBHOOK_URL: z.string().optional().default(''),
  // API_KEY must be at least 32 characters when provided; an empty string or
  // absent variable disables authentication (development only).
  API_KEY: z
    .string()
    .optional()
    .transform((v) => (v === '' ? undefined : v))
    .refine((v) => v === undefined || v.length >= 32, {
      message: 'API_KEY must be at least 32 characters when set',
    }),
  MALICIOUS_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  NATS_RECONNECT_MAX: z.coerce.number().int().nonnegative().default(10),
  OLLAMA_RETRY_MAX: z.coerce.number().int().nonnegative().default(3),
  SLACK_RETRY_MAX: z.coerce.number().int().nonnegative().default(3),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
});

export type AppConfig = z.infer<typeof envSchema>;

function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${issues}`);
  }
  return result.data;
}

export const config: AppConfig = loadConfig();
