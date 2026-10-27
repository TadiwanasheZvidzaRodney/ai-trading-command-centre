import type { Env } from '@atc/config';
import pino, { type Logger, type LoggerOptions } from 'pino';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.apiKey',
  'req.body.api_key',
  'password',
  'passwordHash',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
];

export function loggerOptions(env: Env): LoggerOptions {
  const base: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: { service: 'atc-api', env: env.NODE_ENV },
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (env.NODE_ENV === 'development') {
    return {
      ...base,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname,service,env',
          singleLine: false,
        },
      },
    };
  }

  return base;
}

export function createLogger(env: Env): Logger {
  return pino(loggerOptions(env));
}
