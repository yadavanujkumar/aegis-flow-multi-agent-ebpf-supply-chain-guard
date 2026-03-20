import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const isDevelopment = config.NODE_ENV === 'development';

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  defaultMeta: { service: 'aegis-flow-orchestrator' },
  format: combine(
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    errors({ stack: true }),
    json()
  ),
  transports: [
    new winston.transports.Console({
      format: isDevelopment ? combine(colorize(), simple()) : combine(timestamp(), json()),
    }),
  ],
});

export type Logger = typeof logger;
