const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

if (fs.existsSync('dist/index.js')) {
  process.exit(0);
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(pnpm, ['run', 'build'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
