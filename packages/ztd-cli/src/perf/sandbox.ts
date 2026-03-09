import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CreateTableQuery, MultiQuerySplitter, SqlParser, createTableDefinitionFromCreateTableQuery, type TableDefinitionModel } from 'rawsql-ts';
import { collectSqlFiles } from '../utils/collectSqlFiles';
import { ensurePgModule } from '../utils/optionalDependencies';
import { loadZtdProjectConfig } from '../utils/ztdProjectConfig';

export interface PerfSandboxConfig {
  dockerImage: string;
  containerName: string;
  database: string;
  username: string;
  password: string;
  port: number;
  seed: number;
}

export interface PerfTableSeedConfig {
  rows: number;
}

export interface PerfColumnSeedConfig {
  values?: string[];
  skew?: number;
}

export interface PerfSeedConfig {
  seed: number;
  tables: Record<string, PerfTableSeedConfig>;
  columns: Record<string, PerfColumnSeedConfig>;
}

export interface PerfInitPlan {
  rootDir: string;
  files: Array<{ path: string; contents: string }>;
}

export interface PerfResetResult {
  connectionUrl: string;
  appliedFiles: string[];
  ddlStatements: number;
  usedDocker: boolean;
}

export interface PerfSeedResult {
  connectionUrl: string;
  insertedRows: Record<string, number>;
  seed: number;
  usedDocker: boolean;
}

export function resolvePerfExternalDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicitUrl = (env.ZTD_PERF_DATABASE_URL ?? '').trim();
  return explicitUrl || null;
}

const DEFAULT_PERF_SANDBOX: PerfSandboxConfig = {
  dockerImage: 'postgres:16-alpine',
  containerName: 'ztd-perf-sandbox',
  database: 'ztd_perf',
  username: 'ztd_perf',
  password: 'ztd_perf',
  port: 55432,
  seed: 496
};

const PERF_DIRECTORY = 'perf';
const PERF_SANDBOX_CONFIG = 'sandbox.json';
const PERF_SEED_CONFIG = 'seed.yml';
const PERF_PARAMS_CONFIG = 'params.yml';
const PERF_DOCKER_COMPOSE = 'docker-compose.yml';
const PERF_README = 'README.md';
const PERF_GITIGNORE = '.gitignore';

export function buildPerfInitPlan(rootDir: string): PerfInitPlan {
  const perfDir = path.join(rootDir, PERF_DIRECTORY);
  const sandbox = DEFAULT_PERF_SANDBOX;
  return {
    rootDir,
    files: [
      {
        path: path.join(perfDir, PERF_SANDBOX_CONFIG),
        contents: `${JSON.stringify(sandbox, null, 2)}\n`
      },
      {
        path: path.join(perfDir, PERF_SEED_CONFIG),
        contents: buildDefaultSeedYaml(sandbox.seed)
      },
      {
        path: path.join(perfDir, PERF_PARAMS_CONFIG),
        contents: ['# Default benchmark parameter presets for future perf runs.', 'params: {}', ''].join('\n')
      },
      {
        path: path.join(perfDir, PERF_DOCKER_COMPOSE),
        contents: buildDockerComposeYaml(sandbox)
      },
      {
        path: path.join(perfDir, PERF_README),
        contents: buildPerfReadme()
      },
      {
        path: path.join(perfDir, PERF_GITIGNORE),
        contents: ['evidence/', '.tmp/', ''].join('\n')
      }
    ]
  };
}

export function applyPerfInitPlan(plan: PerfInitPlan): string[] {
  const written: string[] = [];
  for (const file of plan.files) {
    mkdirSync(path.dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.contents, 'utf8');
    written.push(file.path);
  }
  return written;
}

export async function resetPerfSandbox(rootDir: string): Promise<PerfResetResult> {
  const config = loadZtdProjectConfig(rootDir);
  const sandboxConfig = loadPerfSandboxConfig(rootDir);
  const resolvedConnection = await ensurePerfConnection(rootDir, sandboxConfig);
  const ddlRoot = path.resolve(rootDir, config.ddlDir);
  const ddlSources = collectSqlFiles([ddlRoot], ['.sql']);

  const pg = await ensurePgModule();
  const client = new pg.Client({ connectionString: resolvedConnection.connectionUrl, connectionTimeoutMillis: 3000 });

  try {
    await client.connect();
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

    let ddlStatements = 0;
    for (const source of ddlSources) {
      const split = MultiQuerySplitter.split(source.sql);
      for (const chunk of split.queries) {
        const sql = chunk.sql.trim();
        if (!sql) {
          continue;
        }
        await client.query(sql);
        ddlStatements += 1;
      }
    }

    return {
      connectionUrl: resolvedConnection.connectionUrl,
      appliedFiles: ddlSources.map((source) => source.path),
      ddlStatements,
      usedDocker: resolvedConnection.usedDocker
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function seedPerfSandbox(rootDir: string): Promise<PerfSeedResult> {
  const config = loadZtdProjectConfig(rootDir);
  const sandboxConfig = loadPerfSandboxConfig(rootDir);
  const seedConfig = loadPerfSeedConfig(rootDir);
  const resolvedConnection = await ensurePerfConnection(rootDir, sandboxConfig);
  const definitions = loadTableDefinitions(rootDir, config.ddlDir);

  const pg = await ensurePgModule();
  const client = new pg.Client({ connectionString: resolvedConnection.connectionUrl, connectionTimeoutMillis: 3000 });
  const insertedRows: Record<string, number> = {};

  try {
    await client.connect();

    for (const [tableName, tableSeed] of Object.entries(seedConfig.tables)) {
      const definition = resolveTableDefinition(definitions, tableName, config.ddl.defaultSchema);
      if (!definition) {
        throw new Error(`No table definition found for perf seed table: ${tableName}`);
      }

      const statements = buildInsertStatementsForTable(definition, tableSeed.rows, seedConfig);
      for (const statement of statements) {
        await client.query(statement.sql, statement.values);
      }
      insertedRows[definition.name] = statements.length;
    }

    return {
      connectionUrl: resolvedConnection.connectionUrl,
      insertedRows,
      seed: seedConfig.seed,
      usedDocker: resolvedConnection.usedDocker
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function parsePerfSeedYaml(contents: string): PerfSeedConfig {
  const lines = contents.replace(/\r\n/g, '\n').split('\n');
  const config: PerfSeedConfig = { seed: DEFAULT_PERF_SANDBOX.seed, tables: {}, columns: {} };
  let section: 'tables' | 'columns' | null = null;
  let currentKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '');
    if (!line.trim()) {
      continue;
    }

    if (!line.startsWith(' ')) {
      const [key, rawValue] = line.split(':', 2);
      const normalizedKey = key.trim();
      section = normalizedKey === 'tables' ? 'tables' : normalizedKey === 'columns' ? 'columns' : null;
      currentKey = null;
      if (normalizedKey === 'seed') {
        config.seed = Number((rawValue ?? '').trim()) || DEFAULT_PERF_SANDBOX.seed;
      }
      continue;
    }

    if (line.startsWith('  ') && !line.startsWith('    ')) {
      currentKey = line.trim().replace(/:$/, '');
      if (section === 'tables') {
        config.tables[currentKey] = { rows: 0 };
      }
      if (section === 'columns') {
        config.columns[currentKey] = {};
      }
      continue;
    }

    if (!currentKey || !section) {
      continue;
    }

    const trimmed = line.trim();
    const [property, rawValue] = trimmed.split(':', 2);
    const value = (rawValue ?? '').trim();

    if (section === 'tables' && property === 'rows') {
      config.tables[currentKey].rows = Number(value);
      continue;
    }

    if (section === 'columns') {
      if (property === 'skew') {
        config.columns[currentKey].skew = Number(value);
        continue;
      }
      if (property === 'values') {
        config.columns[currentKey].values = parseInlineYamlArray(value);
      }
    }
  }

  return config;
}

export function buildInsertStatementsForTable(
  definition: TableDefinitionModel,
  rowCount: number,
  seedConfig: PerfSeedConfig
): Array<{ sql: string; values: unknown[] }> {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const rng = createDeterministicRng(seedConfig.seed + hashString(definition.name));
  const insertableColumns = definition.columns.filter((column) => !column.defaultValue);

  for (let index = 0; index < rowCount; index += 1) {
    const values = insertableColumns.map((column) => buildSyntheticValue(definition.name, column.name, column.typeName, index, rng, seedConfig, column.isNotNull ?? false));
    const placeholders = values.map((_, valueIndex) => `$${valueIndex + 1}`).join(', ');
    const columnList = insertableColumns.map((column) => `"${column.name}"`).join(', ');
    statements.push({
      sql: `INSERT INTO ${quoteQualifiedName(definition.name)} (${columnList}) VALUES (${placeholders});`,
      values
    });
  }

  return statements;
}

export function loadPerfSandboxConfig(rootDir: string): PerfSandboxConfig {
  const filePath = path.join(rootDir, PERF_DIRECTORY, PERF_SANDBOX_CONFIG);
  if (!existsSync(filePath)) {
    return DEFAULT_PERF_SANDBOX;
  }
  return {
    ...DEFAULT_PERF_SANDBOX,
    ...JSON.parse(readFileSync(filePath, 'utf8'))
  } as PerfSandboxConfig;
}

export function loadPerfSeedConfig(rootDir: string): PerfSeedConfig {
  const filePath = path.join(rootDir, PERF_DIRECTORY, PERF_SEED_CONFIG);
  if (!existsSync(filePath)) {
    return parsePerfSeedYaml(buildDefaultSeedYaml(DEFAULT_PERF_SANDBOX.seed));
  }
  return parsePerfSeedYaml(readFileSync(filePath, 'utf8'));
}

function buildDefaultSeedYaml(seed: number): string {
  return [
    '# Deterministic row counts for the perf sandbox.',
    `seed: ${seed}`,
    'tables:',
    '  users:',
    '    rows: 10000',
    '  orders:',
    '    rows: 50000',
    'columns:',
    '  public.users.status:',
    '    values: [active, inactive]',
    '    skew: 0.85',
    ''
  ].join('\n');
}

function buildDockerComposeYaml(config: PerfSandboxConfig): string {
  return [
    'services:',
    '  perf-db:',
    `    image: ${config.dockerImage}`,
    `    container_name: ${config.containerName}`,
    '    restart: unless-stopped',
    '    environment:',
    `      POSTGRES_DB: ${config.database}`,
    `      POSTGRES_USER: ${config.username}`,
    `      POSTGRES_PASSWORD: ${config.password}`,
    '    ports:',
    `      - "${config.port}:5432"`,
    '    healthcheck:',
    '      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]',
    '      interval: 3s',
    '      timeout: 3s',
    '      retries: 20',
    ''
  ].join('\n');
}

function buildPerfReadme(): string {
  return [
    '# Perf Sandbox',
    '',
    'This directory hosts the opt-in performance sandbox used by `ztd perf` commands.',
    '',
    'Suggested workflow:',
    '1. `ztd perf init`',
    '2. `ztd perf db reset`',
    '3. `ztd perf seed`',
    '',
    'The sandbox is intentionally separated from default ZTD workflows.',
    ''
  ].join('\n');
}

function parseInlineYamlArray(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return [];
  }
  return trimmed
    .slice(1, -1)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function loadTableDefinitions(rootDir: string, ddlDir: string): TableDefinitionModel[] {
  const ddlSources = collectSqlFiles([path.resolve(rootDir, ddlDir)], ['.sql']);
  const definitions: TableDefinitionModel[] = [];

  for (const source of ddlSources) {
    const split = MultiQuerySplitter.split(source.sql);
    for (const chunk of split.queries) {
      const sql = chunk.sql.trim();
      if (!sql) {
        continue;
      }

      const parsed = SqlParser.parse(sql);
      if (!(parsed instanceof CreateTableQuery)) {
        continue;
      }
      definitions.push(createTableDefinitionFromCreateTableQuery(parsed));
    }
  }

  return definitions;
}

function resolveTableDefinition(
  definitions: TableDefinitionModel[],
  requestedName: string,
  defaultSchema: string
): TableDefinitionModel | undefined {
  const normalized = requestedName.includes('.') ? requestedName : `${defaultSchema}.${requestedName}`;
  return definitions.find((definition) => definition.name === normalized || definition.name === requestedName);
}

async function ensurePerfConnection(rootDir: string, config: PerfSandboxConfig): Promise<{ connectionUrl: string; usedDocker: boolean }> {
  const externalUrl = resolvePerfExternalDatabaseUrl();
  if (externalUrl) {
    return { connectionUrl: externalUrl, usedDocker: false };
  }

  const ignoredDefaultDatabaseUrl = (process.env.DATABASE_URL ?? '').trim();
  const composeFile = path.join(rootDir, PERF_DIRECTORY, PERF_DOCKER_COMPOSE);
  if (!existsSync(composeFile)) {
    if (ignoredDefaultDatabaseUrl) {
      throw new Error('Perf sandbox ignores DATABASE_URL for destructive commands. Set ZTD_PERF_DATABASE_URL explicitly or run ztd perf init first.');
    }
    throw new Error('Perf sandbox is not initialized. Run ztd perf init first.');
  }

  assertDockerReadyForPerf();
  runDockerCompose(rootDir, composeFile, ['up', '-d']);
  const connectionUrl = buildSandboxConnectionUrl(config);
  await waitForDatabase(connectionUrl);
  return { connectionUrl, usedDocker: true };
}

function buildSandboxConnectionUrl(config: PerfSandboxConfig): string {
  return `postgres://${config.username}:${config.password}@127.0.0.1:${config.port}/${config.database}`;
}

function assertDockerReadyForPerf(): void {
  const probe = spawnSync('docker', ['info', '--format', '{{json .ServerVersion}}'], { encoding: 'utf8', timeout: 3000 });
  if (probe.error || probe.status !== 0) {
    const detail = (probe.stderr ?? '').trim();
    throw new Error(`Docker is not reachable for ztd perf.${detail ? ` (${detail})` : ''}`);
  }
}

function runDockerCompose(rootDir: string, composeFile: string, args: string[]): void {
  const result = spawnSync('docker', ['compose', '-f', composeFile, ...args], { cwd: rootDir, encoding: 'utf8', timeout: 30000 });
  if (result.error || result.status !== 0) {
    throw new Error(`Docker compose failed for ztd perf: ${(result.stderr || result.stdout || result.error?.message || 'unknown error').trim()}`);
  }
}

async function waitForDatabase(connectionUrl: string): Promise<void> {
  const pg = await ensurePgModule();
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30000) {
    const client = new pg.Client({ connectionString: connectionUrl, connectionTimeoutMillis: 2000 });
    try {
      await client.connect();
      await client.end();
      return;
    } catch {
      await client.end().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error('Timed out waiting for the perf sandbox database to become ready.');
}

function buildSyntheticValue(
  tableName: string,
  columnName: string,
  typeName: string | undefined,
  index: number,
  rng: () => number,
  seedConfig: PerfSeedConfig,
  isNotNull: boolean
): unknown {
  const override = seedConfig.columns[`${tableName}.${columnName}`] ?? seedConfig.columns[columnName];
  if (override?.values && override.values.length > 0) {
    const skew = typeof override.skew === 'number' && override.skew > 0 && override.skew < 1 ? override.skew : undefined;
    if (skew && override.values.length > 1 && rng() < skew) {
      return override.values[0];
    }
    return override.values[Math.floor(rng() * override.values.length)] ?? override.values[0];
  }

  if (!isNotNull && index % 7 === 0) {
    return null;
  }

  const normalizedType = (typeName ?? 'text').toLowerCase();
  if (normalizedType.includes('int') || normalizedType.includes('serial')) {
    return index + 1;
  }
  if (normalizedType.includes('numeric') || normalizedType.includes('decimal')) {
    return Number(((index + 1) * 1.11).toFixed(2));
  }
  if (normalizedType.includes('bool')) {
    return index % 2 === 0;
  }
  if (normalizedType.includes('date') && !normalizedType.includes('time')) {
    return `2024-01-${String((index % 28) + 1).padStart(2, '0')}`;
  }
  if (normalizedType.includes('time')) {
    return `2024-01-01T${String(index % 24).padStart(2, '0')}:00:00.000Z`;
  }
  if (normalizedType.includes('uuid')) {
    const suffix = String(index + 1).padStart(12, '0');
    return `00000000-0000-4000-8000-${suffix}`;
  }

  return `${tableName.replace(/\./g, '_')}_${columnName}_${index + 1}`;
}

function createDeterministicRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function quoteQualifiedName(name: string): string {
  return name.split('.').map((segment) => `"${segment}"`).join('.');
}






