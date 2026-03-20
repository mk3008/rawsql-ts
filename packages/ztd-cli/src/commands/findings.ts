import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { getAgentOutputFormat, parseJsonPayload } from '../utils/agentCli';
import { validateFindingRegistry, type FindingRegistryIssue } from '../utils/findingRegistry';

export type FindingRegistryValidationFormat = 'human' | 'json';

export interface FindingRegistryValidationResult {
  ok: boolean;
  registryPath: string;
  entriesChecked: number;
  issues: FindingRegistryIssue[];
}

interface FindingsCommandOptions {
  format?: string;
  out?: string;
  json?: string;
}

/** Runtime/configuration error for finding registry validation (maps to exit code 2). */
export class FindingRegistryValidationRuntimeError extends Error {
  readonly exitCode = 2;
}

/** Register finding-registry validation commands on the CLI root. */
export function registerFindingRegistryCommand(program: Command): void {
  const findings = program.command('findings').description('Validate machine-readable finding registry files');

  findings
    .command('validate <registryFile>')
    .description('Validate a machine-readable finding registry JSON file')
    .option('--format <format>', 'Output format (human|json)')
    .option('--out <path>', 'Write output to file')
    .option('--json <payload>', 'Pass command options as a JSON object')
    .action(async (registryFile: string, options: FindingsCommandOptions) => {
      try {
        const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
        const format = resolveValidationFormat(merged.format);
        const result = runValidateFindingRegistry(registryFile);
        const text = formatFindingRegistryValidationResult(result, format);
        const outPath = normalizeStringOption(merged.out);
        if (outPath) {
          mkdirSync(path.dirname(path.resolve(process.cwd(), outPath)), { recursive: true });
          writeFileSync(path.resolve(process.cwd(), outPath), text, 'utf8');
        } else {
          const writer = result.ok ? console.log : console.error;
          writer(text);
        }
        process.exitCode = result.ok ? 0 : 1;
      } catch (error) {
        process.exitCode = error instanceof FindingRegistryValidationRuntimeError ? 2 : 1;
        console.error(error instanceof Error ? error.message : String(error));
      }
    });
}

export function runValidateFindingRegistry(registryFile: string, rootDir = process.cwd()): FindingRegistryValidationResult {
  const absolute = path.resolve(rootDir, registryFile);
  if (!existsSync(absolute)) {
    throw new FindingRegistryValidationRuntimeError(`Finding registry not found: ${absolute}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    throw new FindingRegistryValidationRuntimeError(
      `Failed to parse finding registry JSON at ${absolute}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const issues = validateFindingRegistry(parsed);
  return {
    ok: issues.length === 0,
    registryPath: absolute,
    entriesChecked: Array.isArray(parsed) ? parsed.length : 0,
    issues
  };
}

export function formatFindingRegistryValidationResult(
  result: FindingRegistryValidationResult,
  format: FindingRegistryValidationFormat
): string {
  if (format === 'json') {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  const lines = result.ok
    ? [`Finding registry is valid: ${result.entriesChecked} entries checked.`]
    : [
        `Finding registry has ${result.issues.length} issue(s) across ${result.entriesChecked} entries.`,
        ...result.issues.map((issue) => formatIssue(issue))
      ];
  return `${lines.join('\n')}\n`;
}

function formatIssue(issue: FindingRegistryIssue): string {
  const location = issue.index >= 0 ? `entry ${issue.index}` : 'registry';
  return `- ${location} / ${issue.field}: ${issue.message}`;
}

function resolveValidationFormat(value: unknown): FindingRegistryValidationFormat {
  const explicit = normalizeStringOption(value);
  if (explicit) {
    const normalized = explicit.trim().toLowerCase();
    if (normalized === 'human' || normalized === 'json') {
      return normalized;
    }
    throw new FindingRegistryValidationRuntimeError(`Unsupported format: ${explicit}`);
  }

  return getAgentOutputFormat() === 'json' ? 'json' : 'human';
}

function normalizeStringOption(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new FindingRegistryValidationRuntimeError(`Expected a string option but received ${typeof value}.`);
  }
  return value;
}
