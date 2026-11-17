import bcrypt from 'bcryptjs';
import { execute, pool } from '../db.js';
import { defaultSettings } from '../services/settings.js';
import { env } from '../config.js';

async function seed(): Promise<void> {
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await execute(
    `INSERT INTO users (username, email, password_hash, display_name, bio, role)
     VALUES (?, ?, ?, ?, ?, 'admin')
     ON DUPLICATE KEY UPDATE email = VALUES(email), display_name = VALUES(display_name)`,
    [env.ADMIN_USERNAME, env.ADMIN_EMAIL, passwordHash, 'JXY', '写代码，也记录代码之外的事。'],
  );

  // Rename the old default title once, without overriding a user-customized title.
  await execute(
    `UPDATE settings SET setting_value = ? WHERE setting_key = 'site_title' AND setting_value = ?`,
    ['晚安的博客', '余白手记'],
  );

  // Only create missing settings. Existing administrator choices are never overwritten on restart.
  for (const [key, value] of Object.entries(defaultSettings)) {
    await execute(
      'INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)',
      [key, value],
    );
  }

  console.log('Seed complete: administrator and default settings ensured; no sample content created.');
  console.log(`Admin login: ${env.ADMIN_USERNAME} / ${env.ADMIN_PASSWORD}`);
  await pool.end();
}

seed().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});