import chokidar from 'chokidar';
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

const WATCH_DEBOUNCE_MS = 150;

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
      const defaultOut = path.join(projectConfig.testsDir ?? DEFAULT_TESTS_DIRECTORY, 'ztd-config.ts');
      const output = options.out ?? defaultOut;

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
        out: output
      };

      runGenerateZtdConfig(generationOptions);

      if (options.watch) {
        console.log(`[watch] Initial generation complete: ${generationOptions.out}`);
        await watchZtdConfig(generationOptions);
      }
    });
}

async function watchZtdConfig(options: ZtdConfigGenerationOptions): Promise<void> {
  const cwd = process.cwd();
  const patterns = options.directories.flatMap((dir) =>
    options.extensions.map((extension) => path.join(dir, '**', `*${extension}`))
  );

  // Only the tests/ztd-config.ts output is overwritten while watching DDL changes.
  const watcher = chokidar.watch(patterns, {
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
      executeReload(scheduledPath);
      scheduledPath = null;
    }, WATCH_DEBOUNCE_MS);
  };

  const executeReload = async (changedPath: string | null): Promise<void> => {
    const relativePath = changedPath ? path.relative(cwd, changedPath) : 'unknown';
    console.log(`[watch] DDL changed: ${relativePath}`);
    try {
      runGenerateZtdConfig(options);
      console.log(`[watch] Updated: ${options.out}`);
    } catch (error) {
      console.error(
        `[watch] Failed to regenerate ztd-config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  watcher.on('add', scheduleReload);
  watcher.on('change', scheduleReload);
  watcher.on('unlink', scheduleReload);

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
