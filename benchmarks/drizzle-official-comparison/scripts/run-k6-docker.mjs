import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { parseArgs } from 'util';

const {
  values: {
    host = 'http://host.docker.internal:3000',
    name = 'docker-k6-run',
    folder = 'results',
    vus,
    iterations,
  },
} = parseArgs({
  options: {
    host: { type: 'string' },
    name: { type: 'string' },
    folder: { type: 'string' },
    vus: { type: 'string' },
    iterations: { type: 'string' },
  },
  strict: true,
});

fs.mkdirSync(folder, { recursive: true });

function readPositiveInteger(name, value) {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== value.trim()) {
    console.error(`${name} must be a positive integer.`);
    process.exit(1);
  }
  return String(parsed);
}

const k6Image = process.env.K6_IMAGE ?? 'grafana/k6:0.54.0';
const k6Args = ['run'];
const validatedVus = readPositiveInteger('--vus', vus);
const validatedIterations = readPositiveInteger('--iterations', iterations);
if (validatedVus) {
  k6Args.push('--vus', validatedVus);
}
if (validatedIterations) {
  k6Args.push('--iterations', validatedIterations);
}
k6Args.push(
  '--summary-trend-stats',
  'avg,min,med,p(90),p(95),p(99),max',
  '--summary-export',
  `/scripts/${folder.replaceAll(path.sep, '/')}/${name}-summary.json`,
  'bench.js'
);

execFileSync(
  'docker',
  [
    'run',
    '--rm',
    '-v',
    `${process.cwd()}:/scripts`,
    '-w',
    '/scripts/bench',
    '-e',
    `HOST=${host}`,
    k6Image,
    ...k6Args,
  ],
  { stdio: 'inherit' }
);
