import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
for (const directory of ['views', 'public']) {
  const source = path.join(root, 'src', directory);
  const target = path.join(root, 'dist', directory);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
  console.log(`Copied ${source} -> ${target}`);
}
