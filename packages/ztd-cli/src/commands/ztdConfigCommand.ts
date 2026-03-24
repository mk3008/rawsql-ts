import chokidar from 'chokidar';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import {
  collectDirectories,
  parseExtensions,
  normalizeDirectoryList,
  resolveExtensions,
  DEFAULT_DDL_DIRECTORY,
  DEFAULT_EXTENSIONS,
  DEFAULT_TESTS_DIRECTORY,
  parseCsvList
} from './options';
import { loadZtdProjectConfig, writeZtdProjectConfig, type ZtdProjectConfig } from '../utils/ztdProjectConfig';
import { runGenerateZtdConfig, type ZtdConfigGenerationOptions } from './ztdConfig';
import { ensureDirectory } from '../utils/fs';
import { emitDiagnostic, isJsonOutput, parseJsonPayload, writeCommandEnvelope } from '../utils/agentCli';
import { validateProjectPath, validateResourceIdentifier } from '../utils/agentSafety';
import { emitDecisionEvent, withSpan } from '../utils/telemetry';

const WATCH_DEBOUNCE_MS = 150;

type ZtdConfigCommandOptions = {
  ddlDir: string[];
  extensions: string[];
  out?: string;
  defaultSchema?: string;
  searchPath?: string[];
  watch: boolean;
  quiet: boolean;
  dryRun: boolean;
  json?: string;
};

function normalizeZtdConfigCommandOptions(options: Record<string, unknown>): ZtdConfigCommandOptions {
  const ddlDir = typeof options.ddlDir === 'string'
    ? collectDirectories(options.ddlDir, [])
    : Array.isArray(options.ddlDir)
      ? options.ddlDir.filter((entry): entry is string => typeof entry === 'string')
      : [];
  const extensions = typeof options.extensions === 'string'
    ? parseExtensions(options.extensions)
    : Array.isArray(options.extensions)
      ? options.extensions.filter((entry): entry is string => typeof entry === 'string')
      : DEFAULT_EXTENSIONS;
  const searchPath = typeof options.searchPath === 'string'
    ? parseCsvList(options.searchPath)
    : Array.isArray(options.searchPath)
      ? options.searchPath.filter((entry): entry is string => typeof entry === 'string')
      : undefined;

  return {
    ddlDir,
    extensions,
    out: typeof options.out === 'string' ? options.out : undefined,
    defaultSchema: typeof options.defaultSchema === 'string' ? options.defaultSchema : undefined,
    searchPath,
    watch: Boolean(options.watch),
    quiet: Boolean(options.quiet),
    dryRun: Boolean(options.dryRun),
    json: typeof options.json === 'string' ? options.json : undefined,
  };
}

function renderZtdLayoutGeneratedFile(config: ZtdProjectConfig): string {
  // Derive the canonical ztd root directory from the configured DDL path.
  const ddlDir = config.ddlDir.replace(/\\/g, '/');
  const ztdRootDir = path.posix.dirname(ddlDir);

  // Keep default sibling directories deterministic for downstream tooling.
  const enumsDir = path.posix.join(ztdRootDir, 'enums');
  const domainSpecsDir = path.posix.join(ztdRootDir, 'domain-specs');

  return [
    '// GENERATED FILE. DO NOT EDIT.',
    '',
    'export default {',
    `  ztdRootDir: ${JSON.stringify(ztdRootDir)},`,
    `  ddlDir: ${JSON.stringify(ddlDir)},`,
    `  enumsDir: ${JSON.stringify(enumsDir)},`,
    `  domainSpecsDir: ${JSON.stringify(domainSpecsDir)},`,
    '};',
    ''
  ].join('\n');
}

function writeZtdLayoutFile(layoutFilePath: string, config: ZtdProjectConfig): void {
  // Ensure the generated folder exists before emitting the layout snapshot.
  ensureDirectory(path.dirname(layoutFilePath));
  writeFileSync(layoutFilePath, renderZtdLayoutGeneratedFile(config), 'utf8');
}

/**
 * Registers the `ztd-config` CLI command, which generates the canonical ZTD TestRowMap from DDL sources.
 */
export function registerZtdConfigCommand(program: Command): void {
  program
    .command('ztd-config')
    .description('Generate the canonical ZTD TestRowMap from DDL sources')
    .option('--ddl-dir <directory>', 'DDL directory to scan (repeatable)', collectDirectories, [])
    .option('--extensions <list>', 'Comma-separated extensions to include', parseExtensions, DEFAULT_EXTENSIONS)
    .option('--out <file>', 'Destination TypeScript file for generated config')
    .option('--default-schema <schema>', 'Override ddl.defaultSchema stored in ztd.config.json')
    .option('--search-path <list>', 'Comma-separated schema search path entries', parseCsvList)
    .option('--watch', 'Watch DDL files and regenerate when schema changes', false)
    .option('--quiet', 'Suppress next-step hints after generation', false)
    .option('--dry-run', 'Validate inputs and render outputs without writing files', false)
    .option('--json <payload>', 'Pass command options as a JSON object')
    .action(async (options: Record<string, unknown>) => {
      const commandState = await withSpan('resolve-command-state', async () => {
        const merged = options.json ? resolveZtdConfigCommandOptions(options) : normalizeZtdConfigCommandOptions(options);
        if (merged.watch && merged.dryRun) {
          emitDecisionEvent('watch.invalid-with-dry-run');
          throw new Error('--watch cannot be combined with --dry-run.');
        }

        const projectConfig = loadZtdProjectConfig();
        const directories = normalizeDirectoryList(merged.ddlDir, projectConfig.ddlDir ?? DEFAULT_DDL_DIRECTORY);
        const extensions = resolveExtensions(merged.extensions, DEFAULT_EXTENSIONS);
        const defaultOut = path.join(
          projectConfig.testsDir ?? DEFAULT_TESTS_DIRECTORY,
          'generated',
          'ztd-row-map.generated.ts'
        );
        const output = merged.out ?? defaultOut;
        const layoutOut = path.join(path.dirname(output), 'ztd-layout.generated.ts');
        const manifestOut = path.join(path.dirname(output), 'ztd-fixture-manifest.generated.ts');

        const ddlOverrides: ZtdProjectConfig['ddl'] = { ...projectConfig.ddl };
        let shouldUpdateConfig = false;

        if (merged.defaultSchema) {
          ddlOverrides.defaultSchema = validateResourceIdentifier(merged.defaultSchema, '--default-schema');
          shouldUpdateConfig = true;
        }

        if (merged.searchPath && merged.searchPath.length > 0) {
          ddlOverrides.searchPath = merged.searchPath.map((entry) => validateResourceIdentifier(entry, '--search-path'));
          shouldUpdateConfig = true;
        }

        const validatedOutput = validateProjectPath(output, '--out');
        const validatedLayoutOut = validateProjectPath(layoutOut, 'generated layout output');
        const validatedManifestOut = validateProjectPath(manifestOut, 'generated runtime manifest output');
        const generationOptions: ZtdConfigGenerationOptions = {
          directories,
          extensions,
          out: validatedOutput,
          defaultSchema: ddlOverrides.defaultSchema,
          searchPath: ddlOverrides.searchPath,
          ddlLint: projectConfig.ddlLint,
          dryRun: merged.dryRun
        };
        const layoutConfig: ZtdProjectConfig = { ...projectConfig, ddl: ddlOverrides };

        emitDecisionEvent('command.options.resolved', {
          dryRun: merged.dryRun,
          watch: merged.watch,
          quiet: merged.quiet,
          shouldUpdateConfig,
          jsonPayload: Boolean(options.json),
        });

        return {
          merged,
          shouldUpdateConfig,
          ddlOverrides,
          validatedOutput,
          validatedLayoutOut,
          validatedManifestOut,
          generationOptions,
          layoutConfig,
        };
      }, {
        command: 'ztd-config',
      });

      if (commandState.shouldUpdateConfig && !commandState.merged.dryRun) {
        await withSpan('persist-project-config', async () => {
          writeZtdProjectConfig(process.cwd(), { ddl: commandState.ddlOverrides });
          emitDiagnostic({ code: 'ztd-config.config-updated', message: 'ztd.config.json ddl schema settings updated.' });
          emitDecisionEvent('config.updated');
        });
      }

      const generation = await withSpan('generate-ztd-config', async () => {
        return await runGenerateZtdConfig(commandState.generationOptions);
      }, {
        dryRun: commandState.merged.dryRun,
        directoryCount: commandState.generationOptions.directories.length,
      });

      if (!commandState.merged.dryRun) {
        await withSpan('write-layout-file', async () => {
          writeZtdLayoutFile(commandState.validatedLayoutOut, commandState.layoutConfig);
        });
      }

      await withSpan('emit-command-output', async () => {
        if (isJsonOutput()) {
          writeCommandEnvelope('ztd-config', {
            schemaVersion: 1,
            dryRun: commandState.merged.dryRun,
            configUpdated: commandState.shouldUpdateConfig && !commandState.merged.dryRun,
            outputs: [
              { path: commandState.validatedOutput, bytes: generation.rendered.length, written: !commandState.merged.dryRun },
              { path: commandState.validatedManifestOut, bytes: generation.manifestRendered.length, written: !commandState.merged.dryRun },
              { path: commandState.validatedLayoutOut, written: !commandState.merged.dryRun }
            ],
            tables: generation.tables.map((table) => ({ name: table.name, columns: table.columns.length }))
          });
          emitDecisionEvent('output.json-envelope');
        }

        if (commandState.merged.watch) {
          console.log(`[watch] Initial generation complete: ${commandState.generationOptions.out}`);
          emitDecisionEvent('watch.enabled');
          await watchZtdConfig(
            commandState.generationOptions,
            commandState.validatedLayoutOut,
            commandState.layoutConfig
          );
        } else if (!commandState.merged.quiet) {
          if (commandState.merged.dryRun) {
            emitDiagnostic({
              code: 'ztd-config.dry-run',
              message: `Dry-run validated generation for ${commandState.validatedOutput}, ${commandState.validatedManifestOut}, and ${commandState.validatedLayoutOut}.`
            });
            emitDecisionEvent('output.dry-run-diagnostic');
          } else {
            emitDiagnostic({ code: 'ztd-config.next-steps', message: 'Next: run vitest, ztd lint, and ztd check-contract.' });
            emitDecisionEvent('output.next-steps-diagnostic');
          }
        } else {
          emitDecisionEvent('output.quiet-suppressed');
        }
      });
    });
}

export function resolveZtdConfigCommandOptions(options: Record<string, unknown>): ZtdConfigCommandOptions {
  const payload = parseJsonPayload<Record<string, unknown>>(String(options.json), '--json');
  return normalizeZtdConfigCommandOptions({ ...options, ...payload });
}

async function watchZtdConfig(
  options: ZtdConfigGenerationOptions,
  layoutOut: string,
  layoutConfig: ZtdProjectConfig
): Promise<void> {
  const cwd = process.cwd();
  const extensionSet = new Set(options.extensions.map((extension) => extension.toLowerCase()));
  // Watch directories directly to avoid platform-specific glob quirks.
  const watchRoots = options.directories.map((dir) => path.resolve(dir));

  // Only the configured output file (`options.out`) is overwritten while watching DDL changes.
  const watcher = chokidar.watch(watchRoots, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 }
  });

  console.log('[watch] Watching DDL files for changes (Ctrl+C to stop)...');

  let debounceTimer: NodeJS.Timeout | null = null;
  let scheduledPath: string | null = null;

  const scheduleReload = (changedPath: string): void => {
    scheduledPath = changedPath;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void executeReload(scheduledPath);
      scheduledPath = null;
    }, WATCH_DEBOUNCE_MS);
  };

  const scheduleReloadIfDdl = (changedPath: string): void => {
    // Filter to DDL extensions so unrelated file changes do not trigger regeneration.
    const extension = path.extname(changedPath).toLowerCase();
    if (!extensionSet.has(extension)) {
      return;
    }
    scheduleReload(changedPath);
  };

  const executeReload = async (changedPath: string | null): Promise<void> => {
    const relativePath = changedPath ? path.relative(cwd, changedPath) : 'unknown';
    console.log(`[watch] DDL changed: ${relativePath}`);
    try {
      const generation = await runGenerateZtdConfig(options);
      writeZtdLayoutFile(layoutOut, layoutConfig);
      console.log(`[watch] Updated: ${options.out}`);
    } catch (error) {
      console.error(
        `[watch] Failed to regenerate ${options.out}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  watcher.on('add', scheduleReloadIfDdl);
  watcher.on('change', scheduleReloadIfDdl);
  watcher.on('unlink', scheduleReloadIfDdl);

  await new Promise<void>((resolve) => {
    const stop = async (): Promise<void> => {
      console.log('[watch] Shutting down ztd-config watcher...');
      watcher.off('add', scheduleReload);
      watcher.off('change', scheduleReload);
      watcher.off('unlink', scheduleReload);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      await watcher.close();
      process.off('SIGINT', stop);
      resolve();
    };
    process.once('SIGINT', () => {
      void stop();
    });
  });
}
