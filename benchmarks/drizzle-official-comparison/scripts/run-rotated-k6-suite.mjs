import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import { parseArgs } from 'util';

const targetDefinitions = {
  handwritten: { script: 'start:handwritten' },
  drizzle: { script: 'start:drizzle' },
  rawsql: { script: 'start:rawsql' },
  rfba: { script: 'start:rawsql:rfba' },
};

const {
  values: {
    targets = 'handwritten,drizzle,rawsql,rfba',
    runs = '3',
    folder = 'results',
    host = 'http://host.docker.internal:3000',
    readinessUrl = 'http://127.0.0.1:3000/customers?limit=1&offset=0',
  },
} = parseArgs({
  options: {
    targets: { type: 'string' },
    runs: { type: 'string' },
    folder: { type: 'string' },
    host: { type: 'string' },
    readinessUrl: { type: 'string' },
  },
  strict: true,
});

const runCount = Number.parseInt(runs, 10);
if (!Number.isInteger(runCount) || runCount <= 0 || String(runCount) !== runs.trim()) {
  console.error('--runs must be a positive integer.');
  process.exit(1);
}

const targetNames = targets
  .split(',')
  .map((target) => target.trim())
  .filter(Boolean);

for (const target of targetNames) {
  if (!targetDefinitions[target]) {
    console.error(`Unknown target "${target}". Known targets: ${Object.keys(targetDefinitions).join(', ')}`);
    process.exit(1);
  }
}

fs.mkdirSync(folder, { recursive: true });

function rotate(items, offset) {
  return items.map((_, index) => items[(index + offset) % items.length]);
}

function runK6(name) {
  execFileSync(
    process.execPath,
    ['./scripts/run-k6-docker.mjs', '--host', host, '--name', name, '--folder', folder],
    {
      stdio: 'inherit',
      env: { ...process.env, K6_IMAGE: process.env.K6_IMAGE ?? 'grafana/k6:0.54.0' },
    },
  );
}

async function waitForServer() {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < 120_000) {
    try {
      const response = await fetch(readinessUrl);
      if (response.ok) {
        return;
      }
      lastError = new Error(`readiness returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Server did not become ready at ${readinessUrl}: ${lastError?.message ?? 'unknown error'}`);
}

function startServer(target) {
  const child = spawn('pnpm', [targetDefinitions[target].script], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32',
    env: process.env,
  });
  return child;
}

function stopServer(child) {
  if (!child || child.exitCode !== null) {
    return;
  }
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    // The server may already be gone after the benchmark process exits.
  }
}

async function runTarget(target, runName) {
  console.log(`[suite] starting ${target} for ${runName}`);
  const server = startServer(target);
  try {
    await waitForServer();
    runK6(runName);
  } finally {
    stopServer(server);
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
}

async function main() {
  const passes = [
    { label: 'warmup', measured: false },
    ...Array.from({ length: runCount }, (_, index) => ({ label: `run-${index + 1}`, measured: true })),
  ];

  for (let passIndex = 0; passIndex < passes.length; passIndex += 1) {
    const pass = passes[passIndex];
    const order = rotate(targetNames, passIndex);
    console.log(`[suite] pass=${pass.label} measured=${pass.measured} order=${order.join(',')}`);
    for (const target of order) {
      const runName = pass.measured ? `${target}-${pass.label}` : `${target}-warmup`;
      await runTarget(target, runName);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
