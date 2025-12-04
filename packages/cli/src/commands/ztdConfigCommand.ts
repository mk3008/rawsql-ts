import chokidar from 'chokidar';
import path from 'node:path';
import { Command } from 'commander';
import { collectDirectories, parseExtensions, DEFAULT_DDL_DIRECTORY, DEFAULT_EXTENSIONS } from './options';
import { runGenerateZtdConfig, type ZtdConfigGenerationOptions } from './ztdConfig';

const DEFAULT_OUTPUT = path.join('tests', 'ztd-config.ts');
const WATCH_DEBOUNCE_MS = 150;

export function registerZtdConfigCommand(program: Command): void {
  program
    .command('ztd-config')
    .description('Generate ZTD test row types from DDL sources')
    .option('--ddl-dir <directory>', 'DDL directory to scan (repeatable)', collectDirectories, [])
    .option('--extensions <list>', 'Comma-separated extensions to include', parseExtensions, DEFAULT_EXTENSIONS)
    .option('--out <file>', 'Destination TypeScript file for generated config', DEFAULT_OUTPUT)
    .option('--watch', 'Watch DDL files and regenerate when schema changes', false)
    .action(async (options) => {
      // Provide defaults when the user omits repeated options.
      const directories = (options.ddlDir as string[]).length ? (options.ddlDir as string[]) : [DEFAULT_DDL_DIRECTORY];
      const extensions = (options.extensions as string[]).length ? (options.extensions as string[]) : DEFAULT_EXTENSIONS;
      const output = options.out ?? DEFAULT_OUTPUT;

      const generationOptions: ZtdConfigGenerationOptions = {
        directories,
        extensions,
        out: output
      };

      runGenerateZtdConfig(generationOptions);

      // Regenerate continuously while watch mode is active.
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

  // Monitor every matching DDL file so ztd-config stays aligned with schema work.
  const watcher = chokidar.watch(patterns, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 }
  });

  console.log('[watch] Watching DDL files for changes (Ctrl+C to stop)...');

  // Buffer rapid events to avoid redundant regenerations.
  let debounceTimer: NodeJS.Timeout | null = null;
  let scheduledPath: string | null = null;

  // Debounce file events so multi-step saves trigger only one regeneration.
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

  // Regenerate the config and log errors without crashing the watcher.
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

  // React to any file addition, update, or removal.
  watcher.on('add', scheduleReload);
  watcher.on('change', scheduleReload);
  watcher.on('unlink', scheduleReload);

  // Keep the watcher alive until the user explicitly stops it.
  await new Promise<void>((resolve) => {
    // Clean up the watcher and timers before exiting.
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
