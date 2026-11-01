import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

export const DEV_SESSION_SECRET = 'dev-only-change-this-session-secret-32chars';

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const booleanString = (defaultValue: 'true' | 'false') =>
  z
    .string()
    .default(defaultValue)
    .transform((value) => value.toLowerCase() === 'true' || value === '1');

const urlString = (label: string) =>
  z.string().min(1).refine(isValidUrl, `${label} must be an http(s) URL`);

const feedList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .refine((items) => items.every(isValidUrl), 'NEWS_RSS_FEEDS must contain valid URLs');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    API_HOST: z.string().min(1).default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    API_URL: urlString('API_URL').default('http://localhost:4000'),
    WEB_URL: urlString('WEB_URL').default('http://localhost:3000'),

    MONGODB_URI: z
      .string()
      .min(1)
      .refine(
        (value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'),
        'MONGODB_URI must start with mongodb:// or mongodb+srv://',
      ),
    MONGODB_DB: z.string().min(1).max(64).default('atc'),

    AUTH_MODE: z.enum(['disabled', 'session']).default('disabled'),
    AUTH_USERNAME: z.string().max(64).optional(),
    AUTH_PASSWORD_HASH: z.string().max(200).optional(),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    SESSION_TTL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 30)
      .default(168),

    DEFAULT_TIMEZONE: z
      .string()
      .default('Africa/Harare')
      .refine(isValidTimeZone, 'DEFAULT_TIMEZONE must be a valid IANA timezone'),

    TRADING_MODE: z.enum(['research', 'paper']).default('research'),
    LIVE_TRADING_ENABLED: booleanString('false'),

    MARKET_DATA_QUOTE_PROVIDER: z.enum(['swissquote', 'twelvedata', 'oanda']).default('swissquote'),
    MARKET_DATA_CANDLE_PROVIDER: z.enum(['yahoo', 'twelvedata', 'oanda']).default('yahoo'),
    MARKET_DATA_CACHE_QUOTE_SECONDS: z.coerce.number().int().min(1).max(3600).default(15),
    MARKET_DATA_CACHE_CANDLE_SECONDS: z.coerce.number().int().min(30).max(86_400).default(300),
    MARKET_DATA_TWELVE_DATA_API_KEY: z.string().max(200).optional(),
    MARKET_DATA_OANDA_API_TOKEN: z.string().max(300).optional(),
    MARKET_DATA_OANDA_ACCOUNT_ID: z.string().max(100).optional(),
    MARKET_DATA_OANDA_ENVIRONMENT: z.enum(['practice', 'live']).default('practice'),

    NEWS_PROVIDER: z.enum(['rss']).default('rss'),
    NEWS_RSS_FEEDS: feedList,
    NEWS_POLL_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),

    CALENDAR_PROVIDER: z.enum(['forexfactory']).default('forexfactory'),
    CALENDAR_POLL_MINUTES: z.coerce.number().int().min(1).max(1440).default(60),

    AI_PROVIDER: z.enum(['disabled', 'ollama', 'gemini', 'openai-compatible']).default('disabled'),
    AI_BASE_URL: z.string().max(500).optional(),
    AI_API_KEY: z.string().max(500).optional(),
    AI_MODEL: z.string().max(200).optional(),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(60_000),

    ENABLE_SCHEDULER: booleanString('true'),
    QUOTE_REFRESH_SECONDS: z.coerce.number().int().min(5).max(3600).default(20),

    RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(10_000).default(120),
    RATE_LIMIT_WINDOW: z.string().max(50).default('1 minute'),

    PAPER_STARTING_BALANCE: z.coerce.number().positive().default(10_000),
    PAPER_RISK_PER_TRADE_PCT: z.coerce.number().min(0.01).max(10).default(1),
    PAPER_MAX_DAILY_LOSS_PCT: z.coerce.number().min(0.1).max(100).default(3),
    PAPER_MAX_OPEN_RISK_PCT: z.coerce.number().min(0.1).max(100).default(5),
    PAPER_MAX_POSITIONS: z.coerce.number().int().min(1).max(50).default(3),
    PAPER_MIN_RR: z.coerce.number().min(0.1).max(20).default(1.5),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.AUTH_MODE !== 'session') {
        ctx.addIssue({
          code: 'custom',
          message: 'AUTH_MODE must be "session" in production',
          path: ['AUTH_MODE'],
        });
      }
      if (env.SESSION_SECRET === DEV_SESSION_SECRET || env.SESSION_SECRET.includes('change')) {
        ctx.addIssue({
          code: 'custom',
          message: 'SESSION_SECRET must be replaced in production',
          path: ['SESSION_SECRET'],
        });
      }
    }

    if (env.LIVE_TRADING_ENABLED) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Live trading is not implemented. LIVE_TRADING_ENABLED must remain false until a separately approved broker integration exists.',
        path: ['LIVE_TRADING_ENABLED'],
      });
    }

    if (env.AUTH_MODE === 'session') {
      if (!env.AUTH_USERNAME) {
        ctx.addIssue({
          code: 'custom',
          message: 'AUTH_USERNAME is required when AUTH_MODE=session',
          path: ['AUTH_USERNAME'],
        });
      }
      if (!env.AUTH_PASSWORD_HASH || !/^\$2[aby]\$\d{2}\$.{53}$/.test(env.AUTH_PASSWORD_HASH)) {
        ctx.addIssue({
          code: 'custom',
          message: 'AUTH_PASSWORD_HASH must be a valid bcrypt hash when AUTH_MODE=session',
          path: ['AUTH_PASSWORD_HASH'],
        });
      }
    }

    if (
      env.MARKET_DATA_QUOTE_PROVIDER === 'twelvedata' ||
      env.MARKET_DATA_CANDLE_PROVIDER === 'twelvedata'
    ) {
      if (!env.MARKET_DATA_TWELVE_DATA_API_KEY) {
        ctx.addIssue({
          code: 'custom',
          message: 'MARKET_DATA_TWELVE_DATA_API_KEY is required when Twelve Data is selected',
          path: ['MARKET_DATA_TWELVE_DATA_API_KEY'],
        });
      }
    }

    if (env.MARKET_DATA_QUOTE_PROVIDER === 'oanda' || env.MARKET_DATA_CANDLE_PROVIDER === 'oanda') {
      if (!env.MARKET_DATA_OANDA_API_TOKEN || !env.MARKET_DATA_OANDA_ACCOUNT_ID) {
        ctx.addIssue({
          code: 'custom',
          message:
            'MARKET_DATA_OANDA_API_TOKEN and MARKET_DATA_OANDA_ACCOUNT_ID are required when OANDA is selected',
          path: ['MARKET_DATA_OANDA_API_TOKEN'],
        });
      }
      if (env.MARKET_DATA_OANDA_ENVIRONMENT === 'live') {
        ctx.addIssue({
          code: 'custom',
          message: 'Live OANDA is not supported in this release; use the practice environment',
          path: ['MARKET_DATA_OANDA_ENVIRONMENT'],
        });
      }
    }

    if (env.AI_PROVIDER === 'gemini' || env.AI_PROVIDER === 'openai-compatible') {
      if (!env.AI_API_KEY) {
        ctx.addIssue({
          code: 'custom',
          message: 'AI_API_KEY is required for the selected AI provider',
          path: ['AI_API_KEY'],
        });
      }
      if (!env.AI_MODEL) {
        ctx.addIssue({
          code: 'custom',
          message: 'AI_MODEL is required for the selected AI provider',
          path: ['AI_MODEL'],
        });
      }
    }

    if (env.AI_PROVIDER === 'ollama' && !env.AI_MODEL) {
      ctx.addIssue({
        code: 'custom',
        message: 'AI_MODEL is required for Ollama (for example, llama3.1)',
        path: ['AI_MODEL'],
      });
    }

    if (env.AI_PROVIDER !== 'disabled' && env.AI_PROVIDER !== 'ollama' && env.AI_BASE_URL) {
      if (!isValidUrl(env.AI_BASE_URL)) {
        ctx.addIssue({
          code: 'custom',
          message: 'AI_BASE_URL must be an http(s) URL',
          path: ['AI_BASE_URL'],
        });
      }
    }

    if (env.PAPER_MAX_DAILY_LOSS_PCT < env.PAPER_RISK_PER_TRADE_PCT) {
      ctx.addIssue({
        code: 'custom',
        message: 'PAPER_MAX_DAILY_LOSS_PCT should be at least the per-trade risk',
        path: ['PAPER_MAX_DAILY_LOSS_PCT'],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function createEnv(input: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export function parseEnvText(contents: string): Record<string, string> {
  return dotenv.parse(contents);
}

let cached: Env | null = null;

function findEnvFile(start = process.cwd()): string | undefined {
  let directory = start;
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(directory, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return undefined;
}

export function loadEnv(options: { envFile?: string } = {}): Env {
  if (cached) return cached;
  const envFile = options.envFile ?? process.env.ENV_FILE ?? findEnvFile() ?? '.env';
  dotenv.config({ path: envFile, quiet: true });
  cached = createEnv(process.env);
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
