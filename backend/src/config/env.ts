import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(16),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().optional(),
  // Regex pattern for dynamic origins (e.g. Vercel preview URLs).
  // Example: ^https://studysync.*\.vercel\.app$
  ALLOWED_ORIGINS_PATTERN: z.string().optional(),
  PUBLIC_BASE_URL: z.string().url().optional(),
  UPLOADS_DIR: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export const env = envSchema.parse(process.env);

function parseOrigins(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>([env.CLIENT_URL, ...parseOrigins(env.ALLOWED_ORIGINS)]);

  if (env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://localhost:5174');
  }

  return Array.from(origins);
}

export function isOriginAllowed(origin: string): boolean {
  if (getAllowedOrigins().includes(origin)) {
    return true;
  }

  const pattern = env.ALLOWED_ORIGINS_PATTERN;
  if (!pattern) {
    return false;
  }

  try {
    return new RegExp(pattern).test(origin);
  } catch {
    console.error('Invalid ALLOWED_ORIGINS_PATTERN regex:', pattern);
    return false;
  }
}
