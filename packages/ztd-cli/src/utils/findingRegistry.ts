import { isPlainObject } from './sqlCatalogDiscovery';

export type FindingSourceLabel = 'Report' | 'Codex' | 'FC';
export type FindingFailureSurface = 'internal' | 'ci' | 'publish' | 'customer';
export type FindingSeverity = 'blocker' | 'warning' | 'advisory';
export type FindingDetectability = 'local' | 'workflow' | 'ci_only';
export type FindingRecurrenceRisk = 'low' | 'medium' | 'high';
export type FindingStatus = 'planned' | 'implemented' | 'evidence_collected' | 'verified';

export interface FindingRegistryEntry {
  id: string;
  title: string;
  symptom: string;
  source: FindingSourceLabel[];
  failure_surface: FindingFailureSurface;
  category: string[];
  severity: FindingSeverity;
  detectability: FindingDetectability;
  recurrence_risk: FindingRecurrenceRisk;
  desired_prevention_layer: string[];
  candidate_action: string;
  verification_evidence: string;
  status: FindingStatus;
}

export interface FindingRegistryIssue {
  index: number;
  field: string;
  message: string;
}

const allowedSources = new Set<FindingSourceLabel>(['Report', 'Codex', 'FC']);
const allowedFailureSurfaces = new Set<FindingFailureSurface>(['internal', 'ci', 'publish', 'customer']);
const allowedSeverities = new Set<FindingSeverity>(['blocker', 'warning', 'advisory']);
const allowedDetectability = new Set<FindingDetectability>(['local', 'workflow', 'ci_only']);
const allowedRecurrenceRisk = new Set<FindingRecurrenceRisk>(['low', 'medium', 'high']);
const allowedStatuses = new Set<FindingStatus>(['planned', 'implemented', 'evidence_collected', 'verified']);

/**
 * Validate a machine-readable finding registry payload.
 * The validator stays small on purpose so docs, CI, and scripts can share the same contract.
 */
export function validateFindingRegistry(value: unknown): FindingRegistryIssue[] {
  const issues: FindingRegistryIssue[] = [];
  if (!Array.isArray(value)) {
    return [{ index: -1, field: 'root', message: 'Finding registry must be an array.' }];
  }

  value.forEach((entry, index) => validateEntry(entry, index, issues));
  return issues;
}

function validateEntry(entry: unknown, index: number, issues: FindingRegistryIssue[]): void {
  if (!isPlainObject(entry)) {
    issues.push({ index, field: 'root', message: 'Each finding must be a plain object.' });
    return;
  }

  requireString(entry, index, issues, 'id');
  requireString(entry, index, issues, 'title');
  requireString(entry, index, issues, 'symptom');
  requireString(entry, index, issues, 'candidate_action');
  requireString(entry, index, issues, 'verification_evidence');
  requireStringArray(entry, index, issues, 'source', allowedSources);
  requireStringArray(entry, index, issues, 'category');
  requireStringArray(entry, index, issues, 'desired_prevention_layer');
  requireEnum(entry, index, issues, 'failure_surface', allowedFailureSurfaces);
  requireEnum(entry, index, issues, 'severity', allowedSeverities);
  requireEnum(entry, index, issues, 'detectability', allowedDetectability);
  requireEnum(entry, index, issues, 'recurrence_risk', allowedRecurrenceRisk);
  requireEnum(entry, index, issues, 'status', allowedStatuses);
}

function requireString(entry: Record<string, unknown>, index: number, issues: FindingRegistryIssue[], field: string): void {
  const value = entry[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ index, field, message: `${field} must be a non-empty string.` });
  }
}

function requireStringArray<TAllowed extends string>(
  entry: Record<string, unknown>,
  index: number,
  issues: FindingRegistryIssue[],
  field: string,
  allowed?: Set<TAllowed>
): void {
  const value = entry[field];
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ index, field, message: `${field} must be a non-empty string array.` });
    return;
  }

  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      issues.push({ index, field, message: `${field} entries must be non-empty strings.` });
      return;
    }
    if (allowed && !allowed.has(item as TAllowed)) {
      issues.push({ index, field, message: `${field} entry "${item}" is not supported.` });
      return;
    }
  }
}

function requireEnum<TAllowed extends string>(
  entry: Record<string, unknown>,
  index: number,
  issues: FindingRegistryIssue[],
  field: string,
  allowed: Set<TAllowed>
): void {
  const value = entry[field];
  if (typeof value !== 'string' || !allowed.has(value as TAllowed)) {
    issues.push({ index, field, message: `${field} must be one of: ${Array.from(allowed).join(', ')}.` });
  }
}
