import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import path from 'node:path';
import { env, getDatabaseConfig } from '../config.js';

const db = getDatabaseConfig();
const connection = await mysql.createConnection({
  ...db,
  multipleStatements: true,
  charset: 'utf8mb4',
  timezone: env.DB_TIMEZONE,
});

try {
  const schema = (await fs.readFile(path.resolve(process.cwd(), 'db/schema.sql'), 'utf8')).replace(/^\uFEFF/, '');
  await connection.query(schema);
  console.log(`Database schema applied to ${db.database}.`);
} finally {
  await connection.end();
}
