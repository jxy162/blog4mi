import { app } from './app.js';
import { env } from './config.js';
import { pool } from './db.js';

try {
  await pool.query('SELECT 1');
  console.log('MySQL connection established.');
} catch (error) {
  console.error('MySQL connection failed. Run docker compose up -d db, then npm run db:migrate && npm run db:seed.');
  console.error(error);
  if (env.NODE_ENV === 'production') process.exit(1);
}

const server = app.listen(env.PORT, () => {
  console.log(`blog4mi is running at ${env.SITE_URL}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
