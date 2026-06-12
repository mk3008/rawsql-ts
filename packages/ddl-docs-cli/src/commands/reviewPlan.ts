import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  loadConceptRegistry,
  loadDdlRelationshipMetadata,
  loadDfdRegistry,
  type ConceptRegistry,
  type ConceptRegistryEntry,
  type DdlRelationshipEntry,
  type DdlRelationshipMetadata,
  type DfdRegistry,
} from '../relationshipMetadata';
import type { ReviewPlanOptions } from '../types';

type ArtifactKind =
  | 'ddl'
  | 'table-docs-metadata'
  | 'ddl-relationship-metadata'
  | 'concept-spec'
  | 'concept-relationship-metadata'
  | 'dfd'
  | 'dfd-relationship-metadata'
  | 'process-map'
  | 'scope-spec'
  | 'scope-rules'
  | 'test-policy'
  | 'test-rules'
  | 'authority-model'
  | 'authority-rules'
  | 'technology-policy'
  | 'technology-rules'
  | 'generated-doc'
  | 'script'
  | 'workflow'
  | 'unknown';

const ARTIFACT_KINDS = new Set<ArtifactKind>([
  'ddl',
  'table-docs-metadata',
  'ddl-relationship-metadata',
  'concept-spec',
  'concept-relationship-metadata',
  'dfd',
  'dfd-relationship-metadata',
  'process-map',
  'scope-spec',
  'scope-rules',
  'test-policy',
  'test-rules',
  'authority-model',
  'authority-rules',
  'technology-policy',
  'technology-rules',
  'generated-doc',
  'script',
  'workflow',
  'unknown',
]);

type ReviewClass =
  | 'business-bearing'
  | 'metadata'
  | 'generated-review-view'
  | 'mechanical-support'
  | 'workflow-support'
  | 'unknown';

interface ScopeRulesMetadata {
  schemaVersion: 1;
  metadataLanguagePolicy?: MetadataLanguagePolicy;
  scopeRules: ScopeRuleEntry[];
}

interface TestRulesMetadata {
  schemaVersion: 1;
  metadataLanguagePolicy?: MetadataLanguagePolicy;
  testPolicies: TestPolicyEntry[];
}

interface TechnologyRulesMetadata {
  schemaVersion: 1;
  metadataLanguagePolicy?: MetadataLanguagePolicy;
  technologyRules: TechnologyRuleEntry[];
}

interface AuthorityRulesMetadata {
  schemaVersion: 1;
  metadataLanguagePolicy?: MetadataLanguagePolicy;
  authorityRules: AuthorityRuleEntry[];
}

type MetadataLanguagePolicy = string | StructuredMetadataLanguagePolicy;

interface StructuredMetadataLanguagePolicy {
  humanFacingLanguage: string;
  generatedViewLanguage?: string;
  policy: string;
}

interface ScopeRuleEntry {
  id: string;
  kind: string;
  statement: string;
  reviewRisk?: string;
}

interface TestPolicyEntry {
  id: string;
  kind: string;
  statement: string;
  appliesTo?: ArtifactKind[];
  reviewRisk?: string;
}

interface TechnologyRuleEntry {
  id: string;
  kind: string;
  statement: string;
  reviewRisk?: string;
}

interface AuthorityRuleEntry {
  id: string;
  kind: string;
  statement: string;
  reviewRisk?: string;
}

interface ProcessRegistry {
  processes: ProcessRegistryEntry[];
}

interface ProcessRegistryEntry {
  id: string;
  path: string;
}

interface ReviewPlanDiagnostic {
  severity: 'warning' | 'error';
  message: string;
}

interface TechnologyExceptionSignal {
  ruleId: string;
  reviewRisk: string;
  message: string;
}

interface RequiredReads {
  scopeRules: string[];
  concepts: string[];
  dfds: string[];
  processes: string[];
  ddlRelationships: string[];
  testPolicies: string[];
  authorityRules: string[];
  technologyRules: string[];
}

interface ChangedFileReviewPlan {
  path: string;
  artifactKind: ArtifactKind;
  reviewClass: ReviewClass;
  packageWideImpact?: boolean;
  requiredReads: RequiredReads;
  reviewRisks: string[];
  diagnostics: ReviewPlanDiagnostic[];
}

interface ReviewPlan {
  schemaVersion: 1;
  package: string;
  mandatoryScope: {
    files: string[];
    rules: Array<{ id: string; reason: string }>;
  };
  mandatoryVerification?: {
    files: string[];
    policies: Array<{ id: string; reason: string }>;
  };
  mandatoryAuthority?: {
    files: string[];
    rules: Array<{ id: string; reason: string }>;
  };
  mandatoryTechnology?: {
    files: string[];
    rules: Array<{ id: string; reason: string }>;
  };
  changedFiles: ChangedFileReviewPlan[];
  unmappedArtifacts: ChangedFileReviewPlan[];
  generatedDrift: {
    status: 'not-checked';
  };
  reviewCoverage: Array<{ artifact: string; status: 'unknown' }>;
}

const MANDATORY_SCOPE_RULES = [
  {
    id: 'db-centered-transfer',
    reason: 'All transfer changes must be checked against the DB-centered transfer invariant.',
  },
  {
    id: 'human-owned-logical-model',
    reason: 'Logical model changes require semantic review against human-owned meaning.',
  },
  {
    id: 'generated-docs-not-source',
    reason: 'Generated docs must not be reviewed as source of truth.',
  },
] as const;

const MANDATORY_TEST_POLICIES = [
  {
    id: 'db-backed-contract-verification',
    reason: 'Business-bearing transfer changes should be reviewed against the DB-backed contract verification strategy.',
  },
  {
    id: 'no-hot-path-runtime-validation',
    reason: 'Mapper safety is shifted left to queryspec contracts, generated mapper checks, and DB-backed tests.',
  },
] as const;

const MANDATORY_AUTHORITY_RULES = [
  {
    id: 'human-owned-requirements',
    reason: 'Requirement-like Concept Spec sources are human-owned; AI may follow up, propose, and clarify but must not promote its proposal as authority.',
  },
  {
    id: 'ai-owned-review-management',
    reason: 'Review management and review-skill execution are AI-led workflows whose conclusions require human approval.',
  },
  {
    id: 'cli-owned-review-views',
    reason: 'Review reports and generated VitePress views are CLI-owned review artifacts; AI may add bounded interpretation and humans approve the outcome.',
  },
] as const;

const MANDATORY_TECHNOLOGY_RULES = [
  {
    id: 'postgres-primary-db',
    reason: 'Transfer implementation assumes PostgreSQL-compatible DDL, SQL, and database behavior.',
  },
  {
    id: 'sql-first-ashiba',
    reason: 'Transfer changes should preserve the SQL-first, Ashiba/rawsql-ts standard implementation path.',
  },
  {
    id: 'no-standard-orm-path',
    reason: 'Introducing an ORM as the standard path is a technology policy exception and must be reviewed explicitly.',
  },
  {
    id: 'cli-front-facing-surface',
    reason: 'Transfer package front-facing surfaces should remain CLI-first; Web UI belongs to a separate owning application boundary.',
  },
] as const;

export function runReviewPlan(options: ReviewPlanOptions): ReviewPlan {
  const plan = buildReviewPlan(options);
  const json = `${JSON.stringify(plan, null, 2)}\n`;
  if (options.outPath) {
    writeFileSync(path.resolve(process.cwd(), options.outPath), json);
  } else {
    process.stdout.write(json);
  }
  return plan;
}

export function buildReviewPlan(options: ReviewPlanOptions): ReviewPlan {
  const changedFiles = readChangedFiles(options.changedFilesPath);
  const ddlRelationship = loadDdlRelationshipMetadata(options.relationshipPath);
  const conceptRegistry = loadConceptRegistry(options.conceptRelationshipPath);
  const dfdRegistry = loadDfdRegistry(options.dfdRelationshipPath);
  const processRegistry = loadProcessRegistry(options.processDirectories ?? []);
  const scopeRules = loadScopeRules(options.scopeRulesPath);
  const testPolicies = loadTestPolicies(options.testRulesPath);
  const authorityRules = loadAuthorityRules(options.authorityRulesPath);
  const technologyRules = loadTechnologyRules(options.technologyRulesPath);

  const changedFilePlans = changedFiles.map((changedFile) =>
    buildChangedFilePlan(changedFile, {
      options,
      ddlRelationship,
      conceptRegistry,
      dfdRegistry,
      processRegistry,
      scopeRules,
      testPolicies,
      authorityRules,
      technologyRules,
    })
  );

  return {
    schemaVersion: 1,
    package: options.packageName ?? '@rawsql-ts/transfer',
    mandatoryScope: {
      files: [options.scopeDocPath, options.scopeRulesPath].filter((entry): entry is string => Boolean(entry)),
      rules: MANDATORY_SCOPE_RULES.filter((rule) => scopeRules.has(rule.id)),
    },
    ...(options.testPolicyPath || options.testRulesPath ? {
      mandatoryVerification: {
        files: [options.testPolicyPath, options.testRulesPath].filter((entry): entry is string => Boolean(entry)),
        policies: MANDATORY_TEST_POLICIES.filter((policy) => testPolicies.has(policy.id)),
      },
    } : {}),
    ...(options.authorityModelPath || options.authorityRulesPath ? {
      mandatoryAuthority: {
        files: [options.authorityModelPath, options.authorityRulesPath].filter((entry): entry is string => Boolean(entry)),
        rules: MANDATORY_AUTHORITY_RULES.filter((rule) => authorityRules.has(rule.id)),
      },
    } : {}),
    ...(options.technologyPolicyPath || options.technologyRulesPath ? {
      mandatoryTechnology: {
        files: [options.technologyPolicyPath, options.technologyRulesPath].filter((entry): entry is string => Boolean(entry)),
        rules: MANDATORY_TECHNOLOGY_RULES.filter((rule) => technologyRules.has(rule.id)),
      },
    } : {}),
    changedFiles: changedFilePlans,
    unmappedArtifacts: changedFilePlans.filter((entry) =>
      entry.reviewRisks.includes('unmapped-business-artifact')
    ),
    generatedDrift: {
      status: 'not-checked',
    },
    reviewCoverage: [
      ...(options.scopeDocPath ? [{ artifact: options.scopeDocPath, status: 'unknown' as const }] : []),
      ...(options.scopeRulesPath ? [{ artifact: options.scopeRulesPath, status: 'unknown' as const }] : []),
      ...(options.testPolicyPath ? [{ artifact: options.testPolicyPath, status: 'unknown' as const }] : []),
      ...(options.testRulesPath ? [{ artifact: options.testRulesPath, status: 'unknown' as const }] : []),
      ...(options.authorityModelPath ? [{ artifact: options.authorityModelPath, status: 'unknown' as const }] : []),
      ...(options.authorityRulesPath ? [{ artifact: options.authorityRulesPath, status: 'unknown' as const }] : []),
      ...(options.technologyPolicyPath ? [{ artifact: options.technologyPolicyPath, status: 'unknown' as const }] : []),
      ...(options.technologyRulesPath ? [{ artifact: options.technologyRulesPath, status: 'unknown' as const }] : []),
    ],
  };
}

function buildChangedFilePlan(
  changedFile: string,
  context: {
    options: ReviewPlanOptions;
    ddlRelationship: DdlRelationshipMetadata | undefined;
    conceptRegistry: ConceptRegistry | undefined;
    dfdRegistry: DfdRegistry | undefined;
    processRegistry: ProcessRegistry;
    scopeRules: Map<string, ScopeRuleEntry>;
    testPolicies: Map<string, TestPolicyEntry>;
    authorityRules: Map<string, AuthorityRuleEntry>;
    technologyRules: Map<string, TechnologyRuleEntry>;
  }
): ChangedFileReviewPlan {
  const normalizedPath = normalizeRelativePath(changedFile);
  const artifactKind = classifyArtifactKind(normalizedPath, context.options);
  const reviewClass = classifyReviewClass(artifactKind);
  const basePlan: ChangedFileReviewPlan = {
    path: normalizedPath,
    artifactKind,
    reviewClass,
    requiredReads: emptyRequiredReads(),
    reviewRisks: [],
    diagnostics: [],
  };
  applyTechnologyExceptionSignals(basePlan, normalizedPath, context.technologyRules);

  if (artifactKind === 'scope-spec' || artifactKind === 'scope-rules') {
    basePlan.packageWideImpact = true;
    basePlan.requiredReads.scopeRules = MANDATORY_SCOPE_RULES
      .filter((rule) => context.scopeRules.has(rule.id))
      .map((rule) => rule.id);
    basePlan.reviewRisks.push('package-scope-impact');
    return basePlan;
  }

  if (artifactKind === 'test-policy' || artifactKind === 'test-rules') {
    basePlan.packageWideImpact = true;
    basePlan.requiredReads.testPolicies = MANDATORY_TEST_POLICIES
      .filter((policy) => context.testPolicies.has(policy.id))
      .map((policy) => policy.id);
    basePlan.reviewRisks.push('package-verification-policy-impact');
    return basePlan;
  }

  if (artifactKind === 'authority-model' || artifactKind === 'authority-rules') {
    basePlan.packageWideImpact = true;
    basePlan.requiredReads.authorityRules = MANDATORY_AUTHORITY_RULES
      .filter((rule) => context.authorityRules.has(rule.id))
      .map((rule) => rule.id);
    basePlan.reviewRisks.push('package-review-authority-impact');
    return basePlan;
  }

  if (artifactKind === 'technology-policy' || artifactKind === 'technology-rules') {
    basePlan.packageWideImpact = true;
    basePlan.requiredReads.technologyRules = MANDATORY_TECHNOLOGY_RULES
      .filter((rule) => context.technologyRules.has(rule.id))
      .map((rule) => rule.id);
    basePlan.reviewRisks.push('package-technology-policy-impact');
    return basePlan;
  }

  basePlan.requiredReads.testPolicies = resolveTestPoliciesForArtifact(artifactKind, context.testPolicies);

  if (artifactKind === 'ddl') {
    applyDdlRelationship(basePlan, context);
  }

  if (artifactKind === 'concept-spec') {
    const conceptId = resolveConceptIdForPath(normalizedPath, context.conceptRegistry);
    if (conceptId) {
      basePlan.requiredReads.concepts = [conceptId];
    } else {
      basePlan.diagnostics.push({
        severity: 'warning',
        message: 'Concept Spec changed file is not registered in concept-relationship metadata.',
      });
    }
  }

  if (artifactKind === 'dfd') {
    applyDfdRelationship(basePlan, context.dfdRegistry);
  }

  if (artifactKind === 'process-map') {
    const processId = resolveProcessIdForPath(normalizedPath, context.processRegistry);
    if (processId) {
      basePlan.requiredReads.processes = [processId];
    } else {
      basePlan.diagnostics.push({
        severity: 'warning',
        message: 'Process Map changed file is not registered in process-map metadata.',
      });
    }
  }

  return basePlan;
}

function applyTechnologyExceptionSignals(
  plan: ChangedFileReviewPlan,
  normalizedPath: string,
  technologyRules: Map<string, TechnologyRuleEntry>
): void {
  if (technologyRules.size === 0 || !isTransferPackagePath(normalizedPath)) {
    return;
  }

  const body = readChangedFileBody(normalizedPath);
  const signals = detectTechnologyExceptionSignals(normalizedPath, body);
  for (const signal of signals) {
    if (technologyRules.has(signal.ruleId) && !plan.requiredReads.technologyRules.includes(signal.ruleId)) {
      plan.requiredReads.technologyRules.push(signal.ruleId);
    }
    if (!plan.reviewRisks.includes(signal.reviewRisk)) {
      plan.reviewRisks.push(signal.reviewRisk);
    }
    if (!plan.diagnostics.some((diagnostic) => diagnostic.message === signal.message)) {
      plan.diagnostics.push({
        severity: 'warning',
        message: signal.message,
      });
    }
  }
}

function detectTechnologyExceptionSignals(normalizedPath: string, body: string | undefined): TechnologyExceptionSignal[] {
  if (!body) {
    return [];
  }
  const signals: TechnologyExceptionSignal[] = [];
  const lowerPath = normalizedPath.toLowerCase();
  const isPackageManifest = lowerPath.endsWith('/package.json');
  const isImplementationFile = /\/(?:src|scripts|tests|db)\//u.test(lowerPath)
    && /\.(?:[cm]?[jt]sx?|json|sql)$/u.test(lowerPath);

  if (!isPackageManifest && !isImplementationFile) {
    return signals;
  }

  if (/(?:\bdrizzle-orm\b|@prisma\/client\b|\bprisma\b|\btypeorm\b|\bsequelize\b|\bknex\b|\bmikro-orm\b)/iu.test(body)) {
    signals.push({
      ruleId: 'no-standard-orm-path',
      reviewRisk: 'technology-policy-exception',
      message: 'Technology policy review required: transfer change references an ORM or ORM-like data access dependency.',
    });
  }

  if (/\b(?:mysql2?|mariadb|sqlite3?|better-sqlite3|mssql)\b/iu.test(body)) {
    signals.push({
      ruleId: 'postgres-primary-db',
      reviewRisk: 'technology-policy-exception',
      message: 'Technology policy review required: transfer change references a non-PostgreSQL database dependency or adapter.',
    });
  }

  if (
    /\.(?:tsx|jsx)$/iu.test(lowerPath)
    || /\b(?:honox|htmx\.org|@hono\/|hono\/jsx|react|vue|svelte|solid-js|next|vite)\b/iu.test(body)
  ) {
    signals.push({
      ruleId: 'cli-front-facing-surface',
      reviewRisk: 'technology-policy-exception',
      message: 'Technology policy review required: transfer change appears to introduce a Web/UI surface; transfer package front-facing surface is CLI.',
    });
  }

  return signals;
}

function readChangedFileBody(normalizedPath: string): string | undefined {
  const resolvedPath = path.resolve(process.cwd(), normalizedPath);
  if (!existsSync(resolvedPath)) {
    return undefined;
  }
  return readFileSync(resolvedPath, 'utf8');
}

function isTransferPackagePath(normalizedPath: string): boolean {
  const normalized = normalizeRelativePath(normalizedPath);
  return normalized.startsWith('packages/transfer/') || normalized.includes('/packages/transfer/');
}

function applyDdlRelationship(
  plan: ChangedFileReviewPlan,
  context: {
    options: ReviewPlanOptions;
    ddlRelationship: DdlRelationshipMetadata | undefined;
    conceptRegistry: ConceptRegistry | undefined;
    dfdRegistry: DfdRegistry | undefined;
    processRegistry: ProcessRegistry;
    scopeRules: Map<string, ScopeRuleEntry>;
  }
): void {
  const entry = findDdlRelationshipEntry(plan.path, context.ddlRelationship);
  plan.requiredReads.ddlRelationships = context.options.relationshipPath ? [context.options.relationshipPath] : [];
  if (!entry) {
    plan.requiredReads.scopeRules = ['db-centered-transfer'].filter((id) => context.scopeRules.has(id));
    plan.reviewRisks.push('unmapped-business-artifact');
    plan.diagnostics.push({
      severity: 'warning',
      message: 'This DDL file has no relationship metadata entry.',
    });
    return;
  }

  if (entry.kind === 'ddl-control' || entry.kind === 'technical-support') {
    return;
  }

  plan.requiredReads.scopeRules = dedupe(entry.scopeRules.map((scopeRule) => scopeRule.id));
  plan.requiredReads.concepts = dedupe(
    entry.concepts
      .map((target) => resolveConceptIdForRelationshipTarget(target.path, context.ddlRelationship, context.conceptRegistry))
      .filter((entry): entry is string => Boolean(entry))
  );
  plan.requiredReads.processes = dedupe(
    entry.processes
      .map((target) => resolveProcessIdForRelationshipTarget(target.path, context.ddlRelationship, context.processRegistry))
      .filter((entry): entry is string => Boolean(entry))
  );
  for (const target of entry.processes) {
    const processId = resolveProcessIdForRelationshipTarget(target.path, context.ddlRelationship, context.processRegistry);
    if (!processId) {
      plan.diagnostics.push({
        severity: 'warning',
        message: `Process target could not be resolved from structured metadata: ${target.path}`,
      });
    }
  }
  const dfdReads = collectDfdReadsForConcepts(new Set(plan.requiredReads.concepts), context.dfdRegistry);
  plan.requiredReads.dfds = dedupe(dfdReads.dfds);
  plan.requiredReads.processes = dedupe([...plan.requiredReads.processes, ...dfdReads.processes]);
  plan.reviewRisks = dedupe(
    plan.requiredReads.scopeRules
      .map((scopeRuleId) => context.scopeRules.get(scopeRuleId)?.reviewRisk)
      .filter((entry): entry is string => Boolean(entry))
  );
  if (
    plan.requiredReads.scopeRules.length === 0
    && plan.requiredReads.concepts.length === 0
    && plan.requiredReads.processes.length === 0
  ) {
    plan.reviewRisks.push('unmapped-business-artifact');
    plan.diagnostics.push({
      severity: 'warning',
      message: 'This DDL file has no concept, process, scope rule, or explicit technical-support relationship.',
    });
  }
}

function collectDfdReadsForConcepts(
  conceptIds: Set<string>,
  dfdRegistry: DfdRegistry | undefined
): { dfds: string[]; processes: string[] } {
  if (!dfdRegistry || conceptIds.size === 0) {
    return { dfds: [], processes: [] };
  }
  const dfds = new Set<string>();
  const processes = new Set<string>();
  for (const dfd of dfdRegistry.dfds) {
    let dfdMatched = false;
    for (const operation of dfd.businessOperations ?? []) {
      let operationMatched = false;
      const refs = [...(operation.inputs ?? []), ...(operation.outputs ?? []), ...(operation.uses ?? [])];
      for (const ref of refs) {
        if (ref.type === 'concept' && conceptIds.has(ref.id)) {
          operationMatched = true;
        }
        if (ref.type === 'concept-group') {
          const group = dfdRegistry.conceptGroups.find((entry) => entry.id === ref.id);
          if (group?.members.some((member) => member.type === 'concept' && conceptIds.has(member.id))) {
            operationMatched = true;
          }
        }
      }
      if (operationMatched) {
        dfdMatched = true;
        for (const process of operation.relatedProcesses ?? []) {
          processes.add(process.id);
        }
      }
    }
    if (dfdMatched) {
      dfds.add(dfd.id);
    }
  }
  return {
    dfds: Array.from(dfds).sort(),
    processes: Array.from(processes).sort(),
  };
}

function applyDfdRelationship(plan: ChangedFileReviewPlan, dfdRegistry: DfdRegistry | undefined): void {
  if (!dfdRegistry) {
    return;
  }
  const dfd = dfdRegistry.dfds.find((entry) =>
    normalizeRelativePath(path.relative(process.cwd(), path.resolve(dfdRegistry.baseDir, entry.path))) === plan.path
  );
  if (!dfd) {
    plan.diagnostics.push({
      severity: 'warning',
      message: 'DFD changed file is not registered in DFD relationship metadata.',
    });
    return;
  }
  plan.requiredReads.dfds = [dfd.id];
  const concepts = new Set<string>();
  const processes = new Set<string>();
  for (const operation of dfd.businessOperations ?? []) {
    for (const ref of [...(operation.inputs ?? []), ...(operation.outputs ?? []), ...(operation.uses ?? [])]) {
      if (ref.type === 'concept') {
        concepts.add(ref.id);
      }
      if (ref.type === 'concept-group') {
        const group = dfdRegistry.conceptGroups.find((entry) => entry.id === ref.id);
        for (const member of group?.members ?? []) {
          if (member.type === 'concept') {
            concepts.add(member.id);
          }
        }
      }
    }
    for (const process of operation.relatedProcesses ?? []) {
      processes.add(process.id);
    }
  }
  plan.requiredReads.concepts = Array.from(concepts).sort();
  plan.requiredReads.processes = Array.from(processes).sort();
}

function readChangedFiles(changedFilesPath: string): string[] {
  const resolvedPath = path.resolve(process.cwd(), changedFilesPath);
  const body = readFileSync(resolvedPath, 'utf8').trim();
  if (!body) {
    return [];
  }
  if (body.startsWith('[')) {
    const value = JSON.parse(body) as unknown;
    if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
      throw new Error(`changed files JSON must be a string array: ${resolvedPath}`);
    }
    return value.map(normalizeRelativePath);
  }
  return body
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizeRelativePath);
}

function loadScopeRules(scopeRulesPath: string | undefined): Map<string, ScopeRuleEntry> {
  if (!scopeRulesPath) {
    return new Map();
  }
  const resolvedPath = path.resolve(process.cwd(), scopeRulesPath);
  const raw = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;
  if (!isScopeRulesMetadata(raw)) {
    throw new Error(`scope-rules metadata must have schemaVersion: 1 and scopeRules[]: ${resolvedPath}`);
  }
  return new Map(raw.scopeRules.map((entry) => [entry.id, entry]));
}

function loadTestPolicies(testRulesPath: string | undefined): Map<string, TestPolicyEntry> {
  if (!testRulesPath) {
    return new Map();
  }
  const resolvedPath = path.resolve(process.cwd(), testRulesPath);
  const raw = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;
  if (!isTestRulesMetadata(raw)) {
    throw new Error(`test-rules metadata must have schemaVersion: 1 and testPolicies[]: ${resolvedPath}`);
  }
  return new Map(raw.testPolicies.map((entry) => [entry.id, entry]));
}

function loadTechnologyRules(technologyRulesPath: string | undefined): Map<string, TechnologyRuleEntry> {
  if (!technologyRulesPath) {
    return new Map();
  }
  const resolvedPath = path.resolve(process.cwd(), technologyRulesPath);
  const raw = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;
  if (!isTechnologyRulesMetadata(raw)) {
    throw new Error(`technology-rules metadata must have schemaVersion: 1 and technologyRules[]: ${resolvedPath}`);
  }
  return new Map(raw.technologyRules.map((entry) => [entry.id, entry]));
}

function loadAuthorityRules(authorityRulesPath: string | undefined): Map<string, AuthorityRuleEntry> {
  if (!authorityRulesPath) {
    return new Map();
  }
  const resolvedPath = path.resolve(process.cwd(), authorityRulesPath);
  const raw = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;
  if (!isAuthorityRulesMetadata(raw)) {
    throw new Error(`authority-rules metadata must have schemaVersion: 1 and authorityRules[]: ${resolvedPath}`);
  }
  return new Map(raw.authorityRules.map((entry) => [entry.id, entry]));
}

function resolveTestPoliciesForArtifact(
  artifactKind: ArtifactKind,
  testPolicies: Map<string, TestPolicyEntry>
): string[] {
  const result: string[] = [];
  for (const policy of testPolicies.values()) {
    if (policy.appliesTo?.includes(artifactKind)) {
      result.push(policy.id);
    }
  }
  return result.sort();
}

function loadProcessRegistry(processDirectories: string[]): ProcessRegistry {
  const processes: ProcessRegistryEntry[] = [];
  for (const directory of processDirectories) {
    const resolvedDirectory = path.resolve(process.cwd(), directory);
    const processMapPath = path.join(resolvedDirectory, 'process-map.json');
    if (!existsSync(processMapPath)) {
      continue;
    }
    const raw = JSON.parse(readFileSync(processMapPath, 'utf8')) as unknown;
    if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.processMaps)) {
      throw new Error(`process-map metadata must have schemaVersion: 1 and processMaps[]: ${processMapPath}`);
    }
    for (const entry of raw.processMaps) {
      if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.path !== 'string') {
        throw new Error(`process-map entry must include id and path: ${processMapPath}`);
      }
      processes.push({ id: entry.id, path: normalizeRelativePath(path.relative(process.cwd(), path.resolve(resolvedDirectory, entry.path))) });
    }
  }
  return { processes };
}

function classifyArtifactKind(changedFile: string, options: ReviewPlanOptions): ArtifactKind {
  if (options.scopeDocPath && samePath(changedFile, options.scopeDocPath)) {
    return 'scope-spec';
  }
  if (options.scopeRulesPath && samePath(changedFile, options.scopeRulesPath)) {
    return 'scope-rules';
  }
  if (options.testPolicyPath && samePath(changedFile, options.testPolicyPath)) {
    return 'test-policy';
  }
  if (options.testRulesPath && samePath(changedFile, options.testRulesPath)) {
    return 'test-rules';
  }
  if (options.authorityModelPath && samePath(changedFile, options.authorityModelPath)) {
    return 'authority-model';
  }
  if (options.authorityRulesPath && samePath(changedFile, options.authorityRulesPath)) {
    return 'authority-rules';
  }
  if (options.technologyPolicyPath && samePath(changedFile, options.technologyPolicyPath)) {
    return 'technology-policy';
  }
  if (options.technologyRulesPath && samePath(changedFile, options.technologyRulesPath)) {
    return 'technology-rules';
  }
  if (options.relationshipPath && samePath(changedFile, options.relationshipPath)) {
    return 'ddl-relationship-metadata';
  }
  if (options.tableDocsPath && samePath(changedFile, options.tableDocsPath)) {
    return 'table-docs-metadata';
  }
  if (options.conceptRelationshipPath && samePath(changedFile, options.conceptRelationshipPath)) {
    return 'concept-relationship-metadata';
  }
  if (options.dfdRelationshipPath && samePath(changedFile, options.dfdRelationshipPath)) {
    return 'dfd-relationship-metadata';
  }
  if (
    changedFile.includes('/docs/concepts/')
    && (changedFile.endsWith('.md') || changedFile.endsWith('/concept.json'))
  ) {
    return 'concept-spec';
  }
  if (changedFile.includes('/docs/dfd/') && changedFile.endsWith('.md')) {
    return 'dfd';
  }
  if (changedFile.includes('/docs/processes/') && changedFile.endsWith('.md')) {
    return 'process-map';
  }
  if (isDdlPath(changedFile, options)) {
    return 'ddl';
  }
  if (changedFile.startsWith('docs/')) {
    return 'generated-doc';
  }
  if (changedFile.startsWith('.github/workflows/')) {
    return 'workflow';
  }
  if (changedFile.startsWith('scripts/') || changedFile.includes('/scripts/')) {
    return 'script';
  }
  return 'unknown';
}

function classifyReviewClass(kind: ArtifactKind): ReviewClass {
  if (kind === 'generated-doc') {
    return 'generated-review-view';
  }
  if (kind.endsWith('-metadata') || kind === 'scope-rules' || kind === 'test-rules' || kind === 'authority-rules' || kind === 'technology-rules') {
    return 'metadata';
  }
  if (kind === 'script') {
    return 'mechanical-support';
  }
  if (kind === 'workflow') {
    return 'workflow-support';
  }
  if (kind === 'ddl' || kind === 'concept-spec' || kind === 'dfd' || kind === 'process-map' || kind === 'scope-spec' || kind === 'test-policy' || kind === 'authority-model' || kind === 'technology-policy') {
    return 'business-bearing';
  }
  return 'unknown';
}

function isDdlPath(changedFile: string, options: ReviewPlanOptions): boolean {
  if (!changedFile.endsWith('.sql')) {
    return false;
  }
  return options.ddlDirectories.some((entry) => {
    const ddlDir = normalizeRelativePath(entry.path).replace(/\/$/, '');
    return changedFile.startsWith(`${ddlDir}/`);
  });
}

function findDdlRelationshipEntry(
  changedFile: string,
  relationshipMetadata: DdlRelationshipMetadata | undefined
): DdlRelationshipEntry | undefined {
  if (!relationshipMetadata) {
    return undefined;
  }
  const changedRelativeToRelationship = normalizeRelativePath(
    path.relative(relationshipMetadata.baseDir, path.resolve(process.cwd(), changedFile))
  );
  return relationshipMetadata.relationships.find((entry) => entry.path === changedRelativeToRelationship);
}

function resolveConceptIdForRelationshipTarget(
  targetPath: string,
  relationshipMetadata: DdlRelationshipMetadata | undefined,
  conceptRegistry: ConceptRegistry | undefined
): string | undefined {
  if (!relationshipMetadata || !conceptRegistry) {
    return undefined;
  }
  const resolvedTarget = path.resolve(relationshipMetadata.baseDir, targetPath);
  return conceptRegistry.concepts.find((entry) =>
    conceptEntryPaths(entry).some((entryPath) => path.resolve(conceptRegistry.baseDir, entryPath) === resolvedTarget)
  )?.id;
}

function resolveProcessIdForRelationshipTarget(
  targetPath: string,
  relationshipMetadata: DdlRelationshipMetadata | undefined,
  processRegistry: ProcessRegistry
): string | undefined {
  if (!relationshipMetadata) {
    return undefined;
  }
  const resolvedTarget = normalizeRelativePath(path.relative(process.cwd(), path.resolve(relationshipMetadata.baseDir, targetPath)));
  return processRegistry.processes.find((entry) => entry.path === resolvedTarget)?.id;
}

function resolveConceptIdForPath(
  changedFile: string,
  conceptRegistry: ConceptRegistry | undefined
): string | undefined {
  return conceptRegistry?.concepts.find((entry) =>
    conceptEntryPaths(entry).some((entryPath) =>
      normalizeRelativePath(path.relative(process.cwd(), path.resolve(conceptRegistry.baseDir, entryPath))) === changedFile
    )
  )?.id;
}

function conceptEntryPaths(entry: ConceptRegistryEntry): string[] {
  return [entry.path, entry.draftPath].filter((entryPath): entryPath is string => typeof entryPath === 'string');
}

function resolveProcessIdForPath(changedFile: string, processRegistry: ProcessRegistry): string | undefined {
  return processRegistry.processes.find((entry) => entry.path === changedFile)?.id;
}

function emptyRequiredReads(): RequiredReads {
  return {
    scopeRules: [],
    concepts: [],
    dfds: [],
    processes: [],
    ddlRelationships: [],
    testPolicies: [],
    authorityRules: [],
    technologyRules: [],
  };
}

function samePath(left: string, right: string): boolean {
  return normalizeRelativePath(left) === normalizeRelativePath(right);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isScopeRulesMetadata(value: unknown): value is ScopeRulesMetadata {
  return isRecord(value)
    && value.schemaVersion === 1
    && (value.metadataLanguagePolicy === undefined || isMetadataLanguagePolicy(value.metadataLanguagePolicy))
    && Array.isArray(value.scopeRules)
    && value.scopeRules.every((entry) =>
      isRecord(entry)
        && typeof entry.id === 'string'
        && typeof entry.kind === 'string'
        && typeof entry.statement === 'string'
        && (entry.reviewRisk === undefined || typeof entry.reviewRisk === 'string')
    );
}

function isTestRulesMetadata(value: unknown): value is TestRulesMetadata {
  return isRecord(value)
    && value.schemaVersion === 1
    && (value.metadataLanguagePolicy === undefined || isMetadataLanguagePolicy(value.metadataLanguagePolicy))
    && Array.isArray(value.testPolicies)
    && value.testPolicies.every((entry) =>
      isRecord(entry)
        && typeof entry.id === 'string'
        && typeof entry.kind === 'string'
        && typeof entry.statement === 'string'
        && (entry.appliesTo === undefined || (
          Array.isArray(entry.appliesTo)
          && entry.appliesTo.every(isArtifactKind)
        ))
        && (entry.reviewRisk === undefined || typeof entry.reviewRisk === 'string')
    );
}

function isTechnologyRulesMetadata(value: unknown): value is TechnologyRulesMetadata {
  return isRecord(value)
    && value.schemaVersion === 1
    && (value.metadataLanguagePolicy === undefined || isMetadataLanguagePolicy(value.metadataLanguagePolicy))
    && Array.isArray(value.technologyRules)
    && value.technologyRules.every((entry) =>
      isRecord(entry)
        && typeof entry.id === 'string'
        && typeof entry.kind === 'string'
        && typeof entry.statement === 'string'
        && (entry.reviewRisk === undefined || typeof entry.reviewRisk === 'string')
    );
}

function isAuthorityRulesMetadata(value: unknown): value is AuthorityRulesMetadata {
  return isRecord(value)
    && value.schemaVersion === 1
    && (value.metadataLanguagePolicy === undefined || isMetadataLanguagePolicy(value.metadataLanguagePolicy))
    && Array.isArray(value.authorityRules)
    && value.authorityRules.every((entry) =>
      isRecord(entry)
      && typeof entry.id === 'string'
      && typeof entry.kind === 'string'
      && typeof entry.statement === 'string'
      && (entry.reviewRisk === undefined || typeof entry.reviewRisk === 'string')
    );
}

function isMetadataLanguagePolicy(value: unknown): value is MetadataLanguagePolicy {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return isRecord(value)
    && typeof value.humanFacingLanguage === 'string'
    && value.humanFacingLanguage.trim().length > 0
    && (value.generatedViewLanguage === undefined || (
      typeof value.generatedViewLanguage === 'string'
      && value.generatedViewLanguage.trim().length > 0
    ))
    && typeof value.policy === 'string'
    && value.policy.trim().length > 0;
}

function isArtifactKind(value: unknown): value is ArtifactKind {
  return typeof value === 'string' && ARTIFACT_KINDS.has(value as ArtifactKind);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
