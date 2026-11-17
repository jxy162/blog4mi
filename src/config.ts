import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  SITE_URL: z.string().url().default('http://localhost:3000'),
  SESSION_SECRET: z.string().min(32).default('development-only-secret-change-me-please'),
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default('blog4mi'),
  DB_USER: z.string().default('blog'),
  DB_PASSWORD: z.string().default('blogpassword'),
  DB_TIMEZONE: z.string().default('+08:00'),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  ADMIN_PASSWORD: z.string().min(10).default('Admin@123456'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';

export type DatabaseConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export function getDatabaseConfig(): DatabaseConfig {
  if (env.DATABASE_URL) {
    const url = new URL(env.DATABASE_URL);
    if (url.protocol !== 'mysql:') {
      throw new Error('DATABASE_URL must use the mysql:// protocol');
    }
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      database: decodeURIComponent(url.pathname.replace(/^\//, '')),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    };
  }

  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  };
}
