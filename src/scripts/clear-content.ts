import { execute, pool } from '../db.js';

const contentTables = ['comments', 'post_tags', 'posts', 'tags', 'categories', 'links'];

async function clearContent(): Promise<void> {
  for (const table of contentTables) {
    const result = await execute(`DELETE FROM ${table}`);
    console.log(`Cleared ${table}: ${result.affectedRows} row(s).`);
  }
  console.log('All blog content was removed. Users and site settings were preserved.');
  await pool.end();
}

clearContent().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});