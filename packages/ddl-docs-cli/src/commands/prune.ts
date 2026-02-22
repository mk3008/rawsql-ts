import { pruneManagedFiles } from '../state/manifest';
import type { PruneDocsOptions } from '../types';

export function runPruneDocs(options: PruneDocsOptions): void {
  const result = pruneManagedFiles(options.outDir, options.dryRun, options.pruneOrphans);
  if (result.removed.length === 0) {
    console.log(`No managed files were found in ${options.outDir}`);
    return;
  }
  const mode = result.dryRun ? 'Dry-run candidates' : 'Pruned';
  console.log(`${mode}: ${result.removed.length} files in ${options.outDir}`);
  for (const file of result.removed) {
    console.log(` - ${file}`);
  }
}
