const fs = require('node:fs');
const path = require('node:path');

const retroPath = path.resolve(process.cwd(), 'tmp', 'RETRO.md');

if (fs.existsSync(retroPath)) {
  console.error('[retro-gate] tmp/RETRO.md is present.');
  console.error('[retro-gate] Resolve the retro item and remove tmp/RETRO.md before push or PR handoff.');
  process.exit(1);
}

console.log('[retro-gate] clean');
