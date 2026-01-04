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

const WATCH_DEBOUNCE_MS = 150;

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
    .action(async (options) => {
      const projectConfig = loadZtdProjectConfig();
      const directories = normalizeDirectoryList(options.ddlDir as string[], projectConfig.ddlDir ?? DEFAULT_DDL_DIRECTORY);
      const extensions = resolveExtensions(options.extensions as string[], DEFAULT_EXTENSIONS);
      const defaultOut = path.join(
        projectConfig.testsDir ?? DEFAULT_TESTS_DIRECTORY,
        'generated',
        'ztd-row-map.generated.ts'
      );
      const output = options.out ?? defaultOut;
      const layoutOut = path.join(path.dirname(output), 'ztd-layout.generated.ts');

      const ddlOverrides: ZtdProjectConfig['ddl'] = { ...projectConfig.ddl };
      let shouldUpdateConfig = false;

      if (options.defaultSchema) {
        ddlOverrides.defaultSchema = options.defaultSchema;
        shouldUpdateConfig = true;
      }

      if (options.searchPath && options.searchPath.length > 0) {
        ddlOverrides.searchPath = options.searchPath;
        shouldUpdateConfig = true;
      }

      if (shouldUpdateConfig) {
        writeZtdProjectConfig(process.cwd(), { ddl: ddlOverrides });
        console.log('[notice] ztd.config.json ddl schema settings updated.');
      }

      const generationOptions: ZtdConfigGenerationOptions = {
        directories,
        extensions,
        out: output,
        defaultSchema: ddlOverrides.defaultSchema,
        searchPath: ddlOverrides.searchPath,
        ddlLint: projectConfig.ddlLint
      };

      await runGenerateZtdConfig(generationOptions);
      const layoutConfig: ZtdProjectConfig = { ...projectConfig, ddl: ddlOverrides };
      writeZtdLayoutFile(layoutOut, layoutConfig);

      if (options.watch) {
        console.log(`[watch] Initial generation complete: ${generationOptions.out}`);
        await watchZtdConfig(generationOptions, layoutOut, layoutConfig);
      }
    });
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
      await runGenerateZtdConfig(options);
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
