import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { getAgentOutputFormat, parseJsonPayload, writeCommandEnvelope } from '../utils/agentCli';

export type RfbaBoundaryKind = 'root-boundary' | 'feature-boundary' | 'child-boundary-container' | 'sub-boundary';
export type RfbaInspectFormat = 'text' | 'json';

export interface RfbaBoundaryReviewQuestions {
  responsibilityBoundary: string;
  dependencyFlow: string;
  publicSurface: string;
  verification: string;
}

export interface RfbaBoundaryAssets {
  publicSurfaceFiles: string[];
  sqlAssets: string[];
  generatedArtifacts: string[];
  localVerificationFiles: string[];
}

export interface RfbaBoundaryReport extends RfbaBoundaryAssets {
  id: string;
  kind: RfbaBoundaryKind;
  name: string;
  path: string;
  parentBoundaryId: string | null;
  childBoundaryIds: string[];
  publicBoundary: boolean;
  reviewQuestions: RfbaBoundaryReviewQuestions;
  notes: string[];
  warnings: string[];
}

export interface RfbaInspectionReport {
  schemaVersion: 1;
  projectRoot: string;
  expectedRootBoundaryPaths: string[];
  summary: {
    rootBoundaries: number;
    featureBoundaries: number;
    childBoundaryContainers: number;
    subBoundaries: number;
    warnings: number;
  };
  boundaries: RfbaBoundaryReport[];
}

interface RfbaInspectOptions {
  format?: string;
  root?: string;
  json?: string;
}

interface BoundaryDraft {
  id: string;
  kind: RfbaBoundaryKind;
  name: string;
  absolutePath: string;
  relativePath: string;
  parentBoundaryId: string | null;
  childBoundaryIds: string[];
  publicBoundary: boolean;
  reviewQuestions: RfbaBoundaryReviewQuestions;
  notes: string[];
  warnings: string[];
  excludeChildPaths: string[];
}

const STARTER_ROOT_BOUNDARIES = [
  { name: 'features', relativePath: 'src/features' },
  { name: 'adapters', relativePath: 'src/adapters' },
  { name: 'libraries', relativePath: 'src/libraries' },
] as const;

const PUBLIC_SURFACE_FILENAMES = new Set(['boundary.ts', 'index.ts', 'index.js', 'README.md']);
const VERIFICATION_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/i,
  /\.spec\.[cm]?[jt]sx?$/i,
  /\.case\.[cm]?[jt]sx?$/i,
  /TEST_PLAN\.md$/i,
];

export function registerRfbaCommand(program: Command): void {
  const rfba = program.command('rfba').description('Review-first boundary inspection for RFBA projects');

  rfba
    .command('inspect')
    .description('Inspect RFBA root, feature, and query sub-boundaries without writing files')
    .option('--format <format>', 'Output format (text|json)')
    .option('--root <path>', 'Project root to inspect', '.')
    .option('--json <payload>', 'Pass command options as a JSON object')
    .action((options: RfbaInspectOptions) => {
      const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
      const root = normalizeStringOption(merged.root) ?? '.';
      const format = resolveRfbaInspectFormat(merged.format);
      const report = inspectRfbaBoundaries(path.resolve(process.cwd(), root));

      if (getAgentOutputFormat() === 'json' && !merged.format) {
        writeCommandEnvelope('rfba inspect', report);
        return;
      }

      process.stdout.write(formatRfbaInspectionReport(report, format));
    });
}

export function inspectRfbaBoundaries(projectRoot: string): RfbaInspectionReport {
  const absoluteRoot = path.resolve(projectRoot);
  const drafts: BoundaryDraft[] = [];

  for (const rootBoundary of STARTER_ROOT_BOUNDARIES) {
    const absolutePath = path.join(absoluteRoot, ...rootBoundary.relativePath.split('/'));
    if (!isDirectory(absolutePath)) {
      continue;
    }

    drafts.push(createBoundaryDraft({
      kind: 'root-boundary',
      name: rootBoundary.name,
      absolutePath,
      relativePath: rootBoundary.relativePath,
      parentBoundaryId: null,
      publicBoundary: true,
      reviewQuestions: rootBoundaryReviewQuestions(rootBoundary.relativePath),
      notes: [`Concrete starter root boundary: ${rootBoundary.relativePath}.`],
    }));
  }

  const featuresRoot = path.join(absoluteRoot, 'src', 'features');
  if (isDirectory(featuresRoot)) {
    const featureRootDraft = drafts.find((draft) => draft.relativePath === 'src/features');
    for (const featureName of listChildDirectoryNames(featuresRoot)) {
      if (featureName.startsWith('_')) {
        continue;
      }

      const featurePath = path.join(featuresRoot, featureName);
      const featureRelativePath = toPosixPath(path.relative(absoluteRoot, featurePath));
      const featureDraft = createBoundaryDraft({
        kind: 'feature-boundary',
        name: featureName,
        absolutePath: featurePath,
        relativePath: featureRelativePath,
        parentBoundaryId: featureRootDraft?.id ?? null,
        publicBoundary: true,
        reviewQuestions: featureBoundaryReviewQuestions(featureRelativePath),
        notes: ['Feature-owned boundary for orchestration, SQL ownership, and feature-local verification.'],
      });
      if (!existsSync(path.join(featurePath, 'boundary.ts'))) {
        featureDraft.warnings.push('Feature boundary does not expose the starter public surface file boundary.ts.');
      }
      drafts.push(featureDraft);
      if (featureRootDraft) {
        featureRootDraft.childBoundaryIds.push(featureDraft.id);
        featureRootDraft.excludeChildPaths.push(featurePath);
      }

      const queriesPath = path.join(featurePath, 'queries');
      if (!isDirectory(queriesPath)) {
        continue;
      }

      const queriesRelativePath = toPosixPath(path.relative(absoluteRoot, queriesPath));
      const queriesDraft = createBoundaryDraft({
        kind: 'child-boundary-container',
        name: 'queries',
        absolutePath: queriesPath,
        relativePath: queriesRelativePath,
        parentBoundaryId: featureDraft.id,
        publicBoundary: false,
        reviewQuestions: queriesContainerReviewQuestions(queriesRelativePath),
        notes: ['Container for query sub-boundaries; not a public RFBA boundary by itself.'],
      });
      const directFiles = listDirectFiles(queriesPath);
      if (directFiles.length > 0) {
        queriesDraft.warnings.push('queries/ contains direct files; query assets should usually live under queries/<query>/ sub-boundaries.');
      }
      drafts.push(queriesDraft);
      featureDraft.childBoundaryIds.push(queriesDraft.id);
      featureDraft.excludeChildPaths.push(queriesPath);

      for (const queryName of listChildDirectoryNames(queriesPath)) {
        const queryPath = path.join(queriesPath, queryName);
        const queryRelativePath = toPosixPath(path.relative(absoluteRoot, queryPath));
        const queryDraft = createBoundaryDraft({
          kind: 'sub-boundary',
          name: queryName,
          absolutePath: queryPath,
          relativePath: queryRelativePath,
          parentBoundaryId: queriesDraft.id,
          publicBoundary: true,
          reviewQuestions: querySubBoundaryReviewQuestions(queryRelativePath),
          notes: ['Feature-local query sub-boundary for SQL, generated evidence, and query-local verification.'],
        });
        if (!existsSync(path.join(queryPath, 'boundary.ts'))) {
          queryDraft.warnings.push('Query sub-boundary does not expose boundary.ts.');
        }
        if (collectOwnedFiles(queryPath, []).filter((file) => file.endsWith('.sql')).length === 0) {
          queryDraft.warnings.push('Query sub-boundary does not contain a SQL asset.');
        }
        drafts.push(queryDraft);
        queriesDraft.childBoundaryIds.push(queryDraft.id);
        queriesDraft.excludeChildPaths.push(queryPath);
      }
    }
  }

  const boundaries = drafts
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    .map((draft) => {
      const assets = classifyBoundaryAssets(absoluteRoot, draft.absolutePath, draft.excludeChildPaths);
      return {
        id: draft.id,
        kind: draft.kind,
        name: draft.name,
        path: draft.relativePath,
        parentBoundaryId: draft.parentBoundaryId,
        childBoundaryIds: draft.childBoundaryIds.sort(),
        publicBoundary: draft.publicBoundary,
        reviewQuestions: draft.reviewQuestions,
        ...assets,
        notes: draft.notes.sort(),
        warnings: draft.warnings.sort(),
      };
    });

  const warningCount = boundaries.reduce((sum, boundary) => sum + boundary.warnings.length, 0);

  return {
    schemaVersion: 1,
    projectRoot: absoluteRoot,
    expectedRootBoundaryPaths: STARTER_ROOT_BOUNDARIES.map((boundary) => boundary.relativePath),
    summary: {
      rootBoundaries: boundaries.filter((boundary) => boundary.kind === 'root-boundary').length,
      featureBoundaries: boundaries.filter((boundary) => boundary.kind === 'feature-boundary').length,
      childBoundaryContainers: boundaries.filter((boundary) => boundary.kind === 'child-boundary-container').length,
      subBoundaries: boundaries.filter((boundary) => boundary.kind === 'sub-boundary').length,
      warnings: warningCount,
    },
    boundaries,
  };
}

export function formatRfbaInspectionReport(report: RfbaInspectionReport, format: RfbaInspectFormat): string {
  if (format === 'json') {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  const lines = [
    'RFBA boundary inspection',
    `Project root: ${report.projectRoot}`,
    `Expected starter root boundaries: ${report.expectedRootBoundaryPaths.join(', ')}`,
    `Root boundaries: ${report.summary.rootBoundaries}`,
    `Feature boundaries: ${report.summary.featureBoundaries}`,
    `Query containers: ${report.summary.childBoundaryContainers}`,
    `Query sub-boundaries: ${report.summary.subBoundaries}`,
    `Warnings: ${report.summary.warnings}`,
    '',
    'Boundaries:',
  ];

  for (const boundary of report.boundaries) {
    lines.push(`- ${boundary.path} [${boundary.kind}]${boundary.publicBoundary ? '' : ' (not public boundary)'}`);
    lines.push(`  responsibility: ${boundary.reviewQuestions.responsibilityBoundary}`);
    lines.push(`  dependency flow: ${boundary.reviewQuestions.dependencyFlow}`);
    lines.push(`  public surface: ${formatAssetList(boundary.publicSurfaceFiles)}`);
    lines.push(`  sql assets: ${formatAssetList(boundary.sqlAssets)}`);
    lines.push(`  generated artifacts: ${formatAssetList(boundary.generatedArtifacts)}`);
    lines.push(`  verification: ${formatAssetList(boundary.localVerificationFiles)}`);
    for (const warning of boundary.warnings) {
      lines.push(`  warning: ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function createBoundaryDraft(input: {
  kind: RfbaBoundaryKind;
  name: string;
  absolutePath: string;
  relativePath: string;
  parentBoundaryId: string | null;
  publicBoundary: boolean;
  reviewQuestions: RfbaBoundaryReviewQuestions;
  notes: string[];
}): BoundaryDraft {
  return {
    id: `${input.kind}:${input.relativePath}`,
    kind: input.kind,
    name: input.name,
    absolutePath: input.absolutePath,
    relativePath: input.relativePath,
    parentBoundaryId: input.parentBoundaryId,
    childBoundaryIds: [],
    publicBoundary: input.publicBoundary,
    reviewQuestions: input.reviewQuestions,
    notes: input.notes,
    warnings: [],
    excludeChildPaths: [],
  };
}

function classifyBoundaryAssets(projectRoot: string, boundaryPath: string, excludeChildPaths: string[]): RfbaBoundaryAssets {
  const files = collectOwnedFiles(boundaryPath, excludeChildPaths);
  const publicSurfaceFiles: string[] = [];
  const sqlAssets: string[] = [];
  const generatedArtifacts: string[] = [];
  const localVerificationFiles: string[] = [];

  for (const file of files) {
    const relativePath = toPosixPath(path.relative(projectRoot, file));
    const basename = path.basename(file);
    if (PUBLIC_SURFACE_FILENAMES.has(basename)) {
      if (basename !== 'README.md' || path.dirname(file) === boundaryPath) {
        publicSurfaceFiles.push(relativePath);
      }
    }
    if (basename.toLowerCase().endsWith('.sql')) {
      sqlAssets.push(relativePath);
    }
    if (isGeneratedArtifact(relativePath, basename)) {
      generatedArtifacts.push(relativePath);
    }
    if (isVerificationFile(relativePath, basename)) {
      localVerificationFiles.push(relativePath);
    }
  }

  return {
    publicSurfaceFiles: sortUnique(publicSurfaceFiles),
    sqlAssets: sortUnique(sqlAssets),
    generatedArtifacts: sortUnique(generatedArtifacts),
    localVerificationFiles: sortUnique(localVerificationFiles),
  };
}

function collectOwnedFiles(root: string, excludedRoots: string[]): string[] {
  if (!isDirectory(root)) {
    return [];
  }

  const normalizedExcludedRoots = excludedRoots.map((excludedRoot) => path.resolve(excludedRoot));
  const results: string[] = [];
  const visit = (current: string) => {
    const resolvedCurrent = path.resolve(current);
    if (normalizedExcludedRoots.some((excludedRoot) => resolvedCurrent === excludedRoot || resolvedCurrent.startsWith(`${excludedRoot}${path.sep}`))) {
      return;
    }

    for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile()) {
        results.push(entryPath);
      }
    }
  };

  visit(root);
  return results.sort((left, right) => left.localeCompare(right));
}

function listChildDirectoryNames(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function listDirectFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function isDirectory(value: string): boolean {
  try {
    return statSync(value).isDirectory();
  } catch {
    return false;
  }
}

function isGeneratedArtifact(relativePath: string, basename: string): boolean {
  return relativePath.split('/').includes('generated') || basename.includes('.generated.') || basename === 'analysis.json';
}

function isVerificationFile(relativePath: string, basename: string): boolean {
  return relativePath.split('/').includes('tests') || VERIFICATION_FILE_PATTERNS.some((pattern) => pattern.test(basename));
}

function resolveRfbaInspectFormat(value: unknown): RfbaInspectFormat {
  const explicit = normalizeStringOption(value);
  if (!explicit) {
    return getAgentOutputFormat();
  }

  const normalized = explicit.trim().toLowerCase();
  if (normalized === 'text' || normalized === 'json') {
    return normalized;
  }

  throw new Error(`Unsupported RFBA inspection format: ${explicit}`);
}

function normalizeStringOption(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`Expected a string option but received ${typeof value}.`);
  }
  return value;
}

function sortUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

function formatAssetList(values: string[]): string {
  return values.length === 0 ? '(none)' : values.join(', ');
}

function rootBoundaryReviewQuestions(relativePath: string): RfbaBoundaryReviewQuestions {
  return {
    responsibilityBoundary: `${relativePath} is a starter root boundary for a top-level application responsibility area.`,
    dependencyFlow: 'Root boundaries should depend inward on stable contracts and avoid depending on sibling implementation details.',
    publicSurface: 'Review README.md, index files, and boundary files that define how this root area is entered.',
    verification: 'Review tests and generated evidence inside this root area before changing its contracts.',
  };
}

function featureBoundaryReviewQuestions(relativePath: string): RfbaBoundaryReviewQuestions {
  return {
    responsibilityBoundary: `${relativePath} owns one feature boundary and its feature-local orchestration.`,
    dependencyFlow: 'Feature code may call its query sub-boundaries and stable shared helpers; external callers should enter through the feature public surface.',
    publicSurface: 'boundary.ts and README.md are the likely reviewer entry points for the feature.',
    verification: 'Feature-local tests under tests/ verify orchestration and boundary behavior.',
  };
}

function queriesContainerReviewQuestions(relativePath: string): RfbaBoundaryReviewQuestions {
  return {
    responsibilityBoundary: `${relativePath} groups query sub-boundaries for one feature.`,
    dependencyFlow: 'The container should not be treated as a callable public surface; dependencies flow into concrete queries/<query>/ sub-boundaries.',
    publicSurface: 'No public boundary is expected directly on queries/.',
    verification: 'Verification belongs to each concrete query sub-boundary.',
  };
}

function querySubBoundaryReviewQuestions(relativePath: string): RfbaBoundaryReviewQuestions {
  return {
    responsibilityBoundary: `${relativePath} owns one query-level SQL boundary.`,
    dependencyFlow: 'The parent feature boundary calls into this query sub-boundary; query code should keep SQL, mapping, and generated evidence local.',
    publicSurface: 'boundary.ts is the likely callable query surface; SQL files are review assets, not external entry points.',
    verification: 'Query-local tests, cases, generated analysis, and TEST_PLAN.md belong with this sub-boundary.',
  };
}
