import fs from 'node:fs';
import path from 'node:path';
import { buildDiffJson } from '../diff';
import { renderDiffMarkdown } from '../renderer/prDiffMarkdown';
import { PreviewJson } from '../types';

type ParsedArgs = {
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  baseMode: 'merge-base' | 'ref';
  basePreviewJsonPath: string;
  headPreviewJsonPath: string;
  outputPath: string;
};

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const basePreview = readJsonFile(parsed.basePreviewJsonPath);
  const headPreview = readJsonFile(parsed.headPreviewJsonPath);
  const diff = buildDiffJson({
    base: { ref: parsed.baseRef, sha: parsed.baseSha, previewJson: basePreview },
    head: { ref: parsed.headRef, sha: parsed.headSha, previewJson: headPreview },
    baseMode: parsed.baseMode
  });
  const markdown = renderDiffMarkdown(diff);
  ensureParentDirectory(parsed.outputPath);
  fs.writeFileSync(parsed.outputPath, markdown, 'utf8');
}

function parseArgs(args: string[]): ParsedArgs | null {
  const map = new Map<string, string>();
  // Parse `--key value` style flags without external dependencies.
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      map.set(key, 'true');
      continue;
    }
    map.set(key, value);
    index += 1;
  }

  const baseRef = map.get('baseRef');
  const baseSha = map.get('baseSha');
  const headRef = map.get('headRef');
  const headSha = map.get('headSha');
  const baseMode = map.get('baseMode');
  const basePreviewJsonPath = map.get('basePreviewJsonPath');
  const headPreviewJsonPath = map.get('headPreviewJsonPath');
  if (
    !baseRef ||
    !baseSha ||
    !headRef ||
    !headSha ||
    !baseMode ||
    !basePreviewJsonPath ||
    !headPreviewJsonPath
  ) {
    return null;
  }
  if (baseMode !== 'merge-base' && baseMode !== 'ref') {
    return null;
  }

  return {
    baseRef,
    baseSha,
    headRef,
    headSha,
    baseMode,
    basePreviewJsonPath,
    headPreviewJsonPath,
    outputPath: map.get('outputPath') ?? path.join('tmp', 'sql-contract-zod-fixture-adoption-pr-diff-report.md')
  };
}

function readJsonFile(filePath: string): PreviewJson {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as PreviewJson;
}

function ensureParentDirectory(targetPath: string): void {
  const parent = path.dirname(targetPath);
  fs.mkdirSync(parent, { recursive: true });
}

function printUsage(): void {
  process.stderr.write(
    [
      'Usage: node dist/cli/generateDiffReportMarkdown.js',
      '  --baseRef <ref>',
      '  --baseSha <sha>',
      '  --headRef <ref>',
      '  --headSha <sha>',
      '  --baseMode <merge-base|ref>',
      '  --basePreviewJsonPath <path>',
      '  --headPreviewJsonPath <path>',
      '  [--outputPath <path>]'
    ].join('\n') + '\n'
  );
}

main();
