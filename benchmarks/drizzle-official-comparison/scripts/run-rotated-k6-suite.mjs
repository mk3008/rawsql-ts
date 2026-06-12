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
    warmupBaseUrl = 'http://127.0.0.1:3000',
    warmupIterations = '3',
    warmupConcurrency = '20',
  },
} = parseArgs({
  options: {
    targets: { type: 'string' },
    runs: { type: 'string' },
    folder: { type: 'string' },
    host: { type: 'string' },
    readinessUrl: { type: 'string' },
    warmupBaseUrl: { type: 'string' },
    warmupIterations: { type: 'string' },
    warmupConcurrency: { type: 'string' },
  },
  strict: true,
});

const runCount = Number.parseInt(runs, 10);
if (!Number.isInteger(runCount) || runCount <= 0 || String(runCount) !== runs.trim()) {
  console.error('--runs must be a positive integer.');
  process.exit(1);
}

const endpointWarmupIterations = Number.parseInt(warmupIterations, 10);
if (
  !Number.isInteger(endpointWarmupIterations) ||
  endpointWarmupIterations <= 0 ||
  String(endpointWarmupIterations) !== warmupIterations.trim()
) {
  console.error('--warmupIterations must be a positive integer.');
  process.exit(1);
}

const endpointWarmupConcurrency = Number.parseInt(warmupConcurrency, 10);
if (
  !Number.isInteger(endpointWarmupConcurrency) ||
  endpointWarmupConcurrency <= 0 ||
  String(endpointWarmupConcurrency) !== warmupConcurrency.trim()
) {
  console.error('--warmupConcurrency must be a positive integer.');
  process.exit(1);
}

const targetNames = targets
  .split(',')
  .map((target) => target.trim())
  .filter(Boolean);

if (targetNames.length === 0) {
  console.error('--targets must include at least one target.');
  process.exit(1);
}

for (const target of targetNames) {
  if (!targetDefinitions[target]) {
    console.error(`Unknown target "${target}". Known targets: ${Object.keys(targetDefinitions).join(', ')}`);
    process.exit(1);
  }
}

fs.mkdirSync(folder, { recursive: true });

const warmupPaths = [
  '/customers?limit=50&offset=0',
  '/customer-by-id?id=1',
  '/employees?limit=50&offset=0',
  '/employee-with-recipient?id=1',
  '/suppliers?limit=50&offset=0',
  '/supplier-by-id?id=1',
  '/products?limit=50&offset=0',
  '/product-with-supplier?id=1',
  '/orders-with-details?limit=50&offset=0',
  '/order-with-details?id=1',
  '/order-with-details-and-products?id=1',
];

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await fetch(readinessUrl, { signal: controller.signal });
      if (response.ok) {
        return;
      }
      lastError = new Error(`readiness returned HTTP ${response.status}`);
    } catch (error) {
      lastError =
        error instanceof Error && error.name === 'AbortError'
          ? new Error(`readiness request timed out after 3000ms`)
          : error;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Server did not become ready at ${readinessUrl}: ${lastError?.message ?? 'unknown error'}`);
}

async function warmupEndpoint(path) {
  const url = new URL(path, warmupBaseUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`warmup returned HTTP ${response.status} for ${url.href}`);
  }
  await response.arrayBuffer();
}

async function warmupServer(target, runName) {
  console.log(
    `[suite] warming ${target} for ${runName}: endpoints=${warmupPaths.length} iterations=${endpointWarmupIterations} concurrency=${endpointWarmupConcurrency}`,
  );
  for (let iteration = 0; iteration < endpointWarmupIterations; iteration += 1) {
    for (const path of warmupPaths) {
      await Promise.all(Array.from({ length: endpointWarmupConcurrency }, () => warmupEndpoint(path)));
    }
  }
}

function startServer(target) {
  const child = spawn('pnpm', [targetDefinitions[target].script], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      RAWSQL_PG_POOL_MIN: '10',
      RAWSQL_PG_POOL_MAX: '10',
    },
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
    await warmupServer(target, runName);
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
    const order = pass.measured ? rotate(targetNames, passIndex - 1) : targetNames;
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
