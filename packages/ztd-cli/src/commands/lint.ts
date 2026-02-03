import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { MultiQuerySplitter, SqlParser } from 'rawsql-ts';
import type { TableDefinitionModel } from 'rawsql-ts';
import type { Client } from 'pg';
import type { DdlLintMode, TableRowsFixture } from '@rawsql-ts/testkit-core';
import {
  ensureAdapterNodePgModule,
  ensurePgModule,
  ensurePostgresContainerModule,
  ensureTestkitCoreModule,
  type AdapterNodePgModule,
  type TestkitCoreModule
} from '../utils/optionalDependencies';
import { loadZtdProjectConfig } from '../utils/ztdProjectConfig';
import {
  resolveSqlFiles,
  extractEnumLabels,
  buildLintFixtureRow
} from '../utils/sqlLintHelpers';

/** Categorizes the type of failure encountered when validating SQL statements. */
export type LintFailureKind = 'parser' | 'transform' | 'db';

/** Captures diagnostic details contributed by PostgreSQL or the SQL rewriter. */
export interface LintFailureDetails {
  code?: string;
  position?: number;
  detail?: string;
  hint?: string;
}

/** Describes a single linting failure observed while processing a SQL file. */
export interface LintFailure {
  kind: LintFailureKind;
  filePath: string;
  statement?: string;
  message: string;
  location: { line: number; column: number } | null;
  rewritten?: string | null;
  details?: LintFailureDetails;
}

/** Configuration for a lint run, including file discovery and schema fixtures. */
export interface RunSqlLintOptions {
  sqlFiles: string[];
  ddlDirectories: string[];
  defaultSchema: string;
  searchPath: string[];
  ddlLint: DdlLintMode;
  client: Client;
}

/** Outcome summary for a lint run. */
export interface RunSqlLintResult {
  failures: LintFailure[];
  filesChecked: number;
}

interface LintModuleConstructors {
  DdlLintError: TestkitCoreModule['DdlLintError'];
  TableNameResolver: TestkitCoreModule['TableNameResolver'];
  DdlFixtureLoader: TestkitCoreModule['DdlFixtureLoader'];
  MissingFixtureError: TestkitCoreModule['MissingFixtureError'];
  SchemaValidationError: TestkitCoreModule['SchemaValidationError'];
  QueryRewriteError: TestkitCoreModule['QueryRewriteError'];
}

type TransformError =
  | InstanceType<TestkitCoreModule['MissingFixtureError']>
  | InstanceType<TestkitCoreModule['SchemaValidationError']>
  | InstanceType<TestkitCoreModule['QueryRewriteError']>;

/**
 * Validate every SQL file against the configured DDL fixtures by replaying each
 * statement through the adapter-provided testkit client.
 * @param options Configuration values that describe which files and schemas to lint.
 * @returns A summary of the failures observed and how many files were processed.
 */
export async function runSqlLint(options: RunSqlLintOptions): Promise<RunSqlLintResult> {
  const { sqlFiles, ddlDirectories, defaultSchema, searchPath, ddlLint, client } = options;
  const testkitCore = await ensureTestkitCoreModule();
  const adapter = await ensureAdapterNodePgModule();
  const constructors: LintModuleConstructors = {
    TableNameResolver: testkitCore.TableNameResolver,
    DdlFixtureLoader: testkitCore.DdlFixtureLoader,
    DdlLintError: testkitCore.DdlLintError,
    MissingFixtureError: testkitCore.MissingFixtureError,
    SchemaValidationError: testkitCore.SchemaValidationError,
    QueryRewriteError: testkitCore.QueryRewriteError
  };

  let tableDefinitions: TableDefinitionModel[];
  try {
    const resolver = new constructors.TableNameResolver({ defaultSchema, searchPath });
    const loader = new constructors.DdlFixtureLoader({
      directories: ddlDirectories,
      tableNameResolver: resolver,
      ddlLint
    });
    const fixtures = loader.getFixtures();
    tableDefinitions = fixtures.map((fixture) => fixture.tableDefinition);
  } catch (error) {
    return {
      failures: [buildTransformFailureFromLoaderError(error, ddlDirectories, constructors)],
      filesChecked: sqlFiles.length
    };
  }

  const enumLabels = extractEnumLabels(ddlDirectories);
  const tableRows: TableRowsFixture[] = tableDefinitions.map((definition) => ({
    tableName: definition.name,
    rows: [buildLintFixtureRow(definition, enumLabels)]
  }));

  let rewrittenStatement: string | null = null;
  const testkit = adapter.createPgTestkitClient({
    connectionFactory: async () => client,
    tableDefinitions,
    tableRows,
    defaultSchema,
    searchPath,
    onExecute: (sql: string) => {
      rewrittenStatement = sql;
    }
  });

  const failures: LintFailure[] = [];
  try {
    for (const filePath of sqlFiles) {
      const contents = readFileSafe(filePath);
      await lintFile(
        filePath,
        contents,
        testkit,
        failures,
        () => {
          rewrittenStatement = null;
        },
        () => rewrittenStatement,
        constructors
      );
    }
  } finally {
    await testkit.close();
  }

  return {
    failures,
    filesChecked: sqlFiles.length
  };
}

/**
 * Register the `ztd lint` CLI command that validates raw SQL with a temporary Postgres instance.
 * @param program CLI root command that receives the lint subcommand.
 */
export function registerLintCommand(program: Command): void {
  program
    .command('lint <path>')
    .description('Lint SQL files for syntax and analysis correctness via ZTD')
    .action(async (pattern: string) => {
      await runLintCommand(pattern);
    });
}

async function runLintCommand(pattern: string): Promise<void> {
  const config = loadZtdProjectConfig();
  const projectRoot = process.cwd();
  const ddlRoot = path.resolve(projectRoot, config.ddlDir);
  const sqlFiles = resolveSqlFiles(pattern);

  const databaseUrl = process.env.ZTD_LINT_DATABASE_URL?.trim() ?? process.env.DATABASE_URL?.trim();
  const pgModule = await ensurePgModule();
  const { Client: PgClient } = pgModule;
  let client: InstanceType<typeof PgClient> | null = null;
  let container: { getConnectionUri(): string; stop(): Promise<unknown> } | null = null;
  let connectionUrl = databaseUrl && databaseUrl.length > 0 ? databaseUrl : null;

  try {
    if (!connectionUrl) {
      const containerModule = await ensurePostgresContainerModule().catch((error) => {
        const baseMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`${baseMessage} Or set ZTD_LINT_DATABASE_URL to reuse an existing Postgres connection.`);
      });
      const { PostgreSqlContainer } = containerModule;
      const started = await new PostgreSqlContainer(process.env.ZTD_LINT_DB_IMAGE ?? 'postgres:16-alpine')
        .withDatabase('ztdlint')
        .withUsername('ztd')
        .withPassword('ztd')
        .start();
      container = started;
      connectionUrl = started.getConnectionUri();
    }

    client = new PgClient({ connectionString: connectionUrl! });
    await client.connect();

    const result = await runSqlLint({
      sqlFiles,
      ddlDirectories: [ddlRoot],
      defaultSchema: config.ddl.defaultSchema,
      searchPath: config.ddl.searchPath,
      ddlLint: config.ddlLint,
      client
    });

    if (result.failures.length > 0) {
      reportFailures(result.failures);
      process.exitCode = 1;
      throw new Error('ztd lint failed');
    }

    // Success is implied by the absence of failures, so the command stays silent.
  } finally {
    await client?.end().catch(() => undefined);
    await container?.stop();
  }
}

function readFileSafe(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

async function lintFile(
  filePath: string,
  contents: string,
  testkit: ReturnType<AdapterNodePgModule['createPgTestkitClient']>,
  failures: LintFailure[],
  resetRewritten: () => void,
  getRewritten: () => string | null,
  constructors: LintModuleConstructors
): Promise<void> {
  let split;
  try {
    split = MultiQuerySplitter.split(contents);
  } catch (error) {
    failures.push(buildParserFailure(filePath, contents, error));
    return;
  }

  // Validate every statement that survives the splitter to catch syntax and semantic issues.
  for (const chunk of split.queries) {
    if (chunk.isEmpty) {
      continue;
    }
    const statement = chunk.sql.trim();
    if (!statement) {
      continue;
    }
    try {
      SqlParser.parse(statement);
    } catch (parseError) {
      failures.push(buildParserFailure(filePath, statement, parseError));
      continue;
    }
    try {
      resetRewritten();
      await executeValidationStatement(testkit, statement);
    } catch (error) {
      failures.push(
        buildStatementFailure(
          filePath,
          statement,
          contents,
          error,
          getRewritten(),
          constructors
        )
      );
    }
  }
}

async function executeValidationStatement(
  testkit: ReturnType<AdapterNodePgModule['createPgTestkitClient']>,
  statement: string
): Promise<void> {
  // Execute the rewritten statement so fixtures are applied before Postgres validation.
  await testkit.query(statement);
}

/**
 * Build a parser failure record that surfaces rawsql-ts errors from runSqlLint.
 * @param filePath The SQL file that triggered the parser issue.
 * @param contents Statement contents to display alongside the error.
 * @param error The parser error produced by rawsql-ts.
 * @returns A failure record that keeps the command output consistent.
 */
export function buildParserFailure(
  filePath: string,
  contents: string,
  error: unknown
): LintFailure {
  const message =
    `RawSQL parser: ${error instanceof Error ? error.message : 'Unknown parser error'}`;
  return buildLintFailure({
    kind: 'parser',
    filePath,
    statement: contents,
    message,
    location: null
  });
}

function buildStatementFailure(
  filePath: string,
  statement: string,
  contents: string,
  error: unknown,
  rewritten: string | null,
  constructors: LintModuleConstructors
): LintFailure {
  if (isTransformError(error, constructors)) {
    return buildTransformFailureFromStatement(filePath, statement, error, rewritten, constructors);
  }
  return buildDbFailure(filePath, statement, contents, error, rewritten);
}

function buildDbFailure(
  filePath: string,
  statement: string,
  contents: string,
  error: unknown,
  rewritten: string | null
): LintFailure {
  const pgError = error as Record<string, unknown>;
  const position =
    typeof pgError.position === 'string'
      ? Number(pgError.position) - 1
      : typeof pgError.position === 'number'
        ? pgError.position
        : undefined;
  const location =
    position !== undefined ? findLineColumn(contents, position) : null;
  const details: LintFailureDetails = {};
  if (typeof pgError.code === 'string') {
    details.code = pgError.code;
  }
  if (typeof pgError.position === 'string' && !Number.isNaN(Number(pgError.position))) {
    details.position = Number(pgError.position);
  } else if (typeof pgError.position === 'number') {
    details.position = pgError.position;
  }
  if (typeof pgError.detail === 'string') {
    details.detail = pgError.detail;
  }
  if (typeof pgError.hint === 'string') {
    details.hint = pgError.hint;
  }
  return buildLintFailure({
    kind: 'db',
    filePath,
    statement,
    message: (pgError.message as string) ?? 'Unknown error',
    location,
    rewritten,
    details: Object.keys(details).length > 0 ? details : undefined
  });
}

function buildTransformFailureFromStatement(
  filePath: string,
  statement: string,
  error: TransformError,
  rewritten: string | null,
  constructors: LintModuleConstructors
): LintFailure {
  const message = `ZTD transform: ${error.message}`;
  const details = getTransformDetails(error, constructors);
  return buildLintFailure({
    kind: 'transform',
    filePath,
    statement,
    message,
    location: null,
    rewritten,
    details
  });
}

function buildTransformFailureFromLoaderError(
  error: unknown,
  ddlDirectories: string[],
  constructors: LintModuleConstructors
): LintFailure {
  if (
    error instanceof constructors.DdlLintError &&
    error.diagnostics.length > 0
  ) {
    const diag = error.diagnostics[0];
    const filePath = resolveDdlFailurePath(diag.source, ddlDirectories);
    return buildLintFailure({
      kind: 'transform',
      filePath,
      message: `ZTD transform: ${diag.message}`,
      location: null,
      details: { code: diag.code }
    });
  }
  const filePath = resolveDdlFailurePath(undefined, ddlDirectories);
  return buildLintFailure({
    kind: 'transform',
    filePath,
    message: `ZTD transform: ${error instanceof Error ? error.message : 'Unknown transform error'}`,
    location: null
  });
}

function resolveDdlFailurePath(
  source: string | undefined,
  directories: string[]
): string {
  if (source) {
    return path.resolve(process.cwd(), source);
  }
  if (directories.length) {
    return path.resolve(directories[0]);
  }
  return process.cwd();
}

function getTransformDetails(
  error: TransformError,
  constructors: LintModuleConstructors
): LintFailureDetails | undefined {
  if (error instanceof constructors.MissingFixtureError) {
    return { code: 'missing-fixture' };
  }
  if (error instanceof constructors.SchemaValidationError) {
    return { code: 'schema-validation' };
  }
  if (error instanceof constructors.QueryRewriteError) {
    return { code: 'query-rewrite' };
  }
  return undefined;
}

function isTransformError(
  error: unknown,
  constructors: LintModuleConstructors
): error is TransformError {
  return (
    error instanceof constructors.MissingFixtureError ||
    error instanceof constructors.SchemaValidationError ||
    error instanceof constructors.QueryRewriteError
  );
}

function buildLintFailure(params: {
  kind: LintFailureKind;
  filePath: string;
  statement?: string;
  message: string;
  location: { line: number; column: number } | null;
  rewritten?: string | null;
  details?: LintFailureDetails;
}): LintFailure {
  return {
    kind: params.kind,
    filePath: params.filePath,
    statement: params.statement,
    message: params.message,
    location: params.location ?? null,
    rewritten: params.rewritten ?? null,
    details: params.details
  };
}

function findLineColumn(
  contents: string,
  position: number
): { line: number; column: number } {
  const lines = contents.split(/\r?\n/);
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const lineLength = lines[i].length + 1;
    if (position < offset + lineLength) {
      return {
        line: i + 1,
        column: position - offset + 1
      };
    }
    offset += lineLength;
  }
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function reportFailures(failures: LintFailure[]): void {
  for (const failure of failures) {
    console.error(`\n[${failure.filePath}] (${failure.kind}) ${failure.message}`);
    if (failure.location) {
      console.error(
        `at line ${failure.location.line} column ${failure.location.column}`
      );
    }
    if (failure.details?.position !== undefined) {
      console.error(`position: ${failure.details.position}`);
    }
    if (failure.details?.code) {
      console.error(`code: ${failure.details.code}`);
    }
    if (failure.details?.detail) {
      console.error(`detail: ${failure.details.detail}`);
    }
    if (failure.details?.hint) {
      console.error(`hint: ${failure.details.hint}`);
    }
    if (failure.rewritten) {
      console.error('rewritten SQL:');
      console.error(failure.rewritten);
    }
  }
}
