import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveSchemaSettings } from '../config';
import { snapshotTableDocs } from '../parser/snapshotTableDocs';
import { loadConceptRegistry } from '../relationshipMetadata';
import { loadRawTableDocsMetadata } from '../tableDocsMetadata';
import type { CheckDocsOptions, DdlInput, SqlSource, TableDocModel, TableDocsMetadata } from '../types';
import { dedupeDdlInputsByInstanceAndPath } from '../utils/ddlInputDedupe';
import { collectSqlFiles, expandGlobPatterns } from '../utils/fs';
import { filterPgDump } from '../utils/pgDumpFilter';

export interface CheckIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface CheckDocsResult {
  errors: CheckIssue[];
  warnings: CheckIssue[];
}

interface RelationshipMetadata {
  schemaVersion: 1;
  metadataLanguagePolicy?: string;
  relationships: RelationshipEntry[];
}

interface RelationshipEntry {
  path: string;
  kind: string;
  reason?: string;
  scopeRules?: RelationshipScopeRuleRef[];
  concepts?: RelationshipTarget[];
  processes?: RelationshipTarget[];
}

interface RelationshipScopeRuleRef {
  id: string;
  reason?: string;
}

interface RelationshipTarget {
  path: string;
  reason?: string;
}

interface ScopeRulesMetadata {
  schemaVersion: 1;
  metadataLanguagePolicy?: unknown;
  scopeRules: ScopeRuleEntry[];
}

interface TestRulesMetadata {
  schemaVersion: 1;
  metadataLanguagePolicy?: unknown;
  testPolicies: TestPolicyEntry[];
}

interface ScopeRuleEntry {
  id: string;
  kind: ScopeRuleKind;
  statement: string;
  reviewRisk?: string;
  riskProbes?: string[];
  allowedInstead?: string[];
  reviewAction?: string;
  ownedDomains?: string[];
  externalDomains?: string[];
}

interface TestPolicyEntry {
  id: string;
  kind: TestPolicyKind;
  statement: string;
  appliesTo?: string[];
  reviewRisk?: string;
  probes?: string[];
}

type ScopeRuleKind =
  | 'purpose'
  | 'in-scope'
  | 'out-of-scope'
  | 'global-invariant'
  | 'ownership-boundary'
  | 'extension-policy'
  | 'assumption'
  | 'review-policy';

type TestPolicyKind =
  | 'verification-policy'
  | 'mapping-policy'
  | 'boundary-case'
  | 'identity-policy'
  | 'state-transition-policy'
  | 'generated-sql-policy'
  | 'review-policy';

interface OrderMetadata {
  schemaVersion: 1;
  order: string[];
}

interface ConceptRelationshipMetadata {
  schemaVersion: 1;
  concepts?: ConceptEntry[];
  relationships?: ConceptRelationEntry[];
  views?: ConceptViewEntry[];
  glossaryTerms?: ConceptGlossaryTermEntry[];
  relatedProcessMaps?: ConceptRelatedProcessMapEntry[];
}

interface ConceptEntry {
  id: string;
  displayName?: string;
  path?: string | null;
  draftPath?: string | null;
  status?: string;
  summary?: string;
  note?: string;
}

interface ConceptRelationEntry {
  from: string;
  to: string;
  kind?: string;
  certainty?: string;
  reason?: string;
}

interface ConceptViewEntry {
  id: string;
  concepts?: string[];
}

interface ConceptGlossaryTermEntry {
  id: string;
  displayTerm: string;
  definedIn?: string[];
  meaning?: string;
  note?: string;
}

interface ConceptRelatedProcessMapEntry {
  id: string;
  displayName?: string;
  path: string;
  reason?: string;
}

interface DfdRelationshipMetadata {
  schemaVersion: 1;
  subsystems?: DfdSubsystemEntry[];
  conceptGroups?: DfdConceptGroupEntry[];
  externalStores?: DfdNamedEntry[];
  derivedViews?: DfdNamedEntry[];
  dfds?: DfdEntry[];
}

interface DfdNamedEntry {
  id: string;
  displayName?: string;
}

interface DfdSubsystemEntry extends DfdNamedEntry {
  summary?: string;
}

interface DfdConceptGroupEntry extends DfdNamedEntry {
  scope?: string;
  members: DfdTermRef[];
}

interface DfdEntry extends DfdNamedEntry {
  subsystem?: string;
  path: string;
  summary?: string;
  businessOperations?: DfdBusinessOperationEntry[];
}

interface DfdBusinessOperationEntry extends DfdNamedEntry {
  summary?: string;
  relatedProcesses?: DfdRelatedProcessEntry[];
  inputs?: DfdTermRef[];
  outputs?: DfdTermRef[];
  uses?: DfdTermRef[];
}

interface DfdRelatedProcessEntry {
  id: string;
  path: string;
  reason?: string;
}

interface DfdTermRef {
  type: string;
  id: string;
}

interface ProcessMapMetadata {
  schemaVersion: 1;
  processMaps?: ProcessMapEntry[];
  externalStores?: DfdNamedEntry[];
  derivedViews?: DfdNamedEntry[];
  views?: ProcessMapViewEntry[];
}

interface ProcessMapEntry {
  id: string;
  path: string;
  summary?: string;
}

interface ProcessMapViewEntry {
  id: string;
  name?: string;
  processMap: string;
  concepts?: string[];
  relatedConcepts?: string[];
  inputs?: DfdTermRef[];
  outputs?: DfdTermRef[];
  uses?: DfdTermRef[];
  purpose?: string;
}

const CONCEPT_SUMMARY_MAX_LENGTH = 160;
const CONCEPT_METADATA_NOTE_MAX_LENGTH = 240;
const PROCESS_MAP_RULE_REFERENCE_TARGET = 'concept-spec-overview.md#process-map-rules';
const SCOPE_RULE_KINDS = new Set<ScopeRuleKind>([
  'purpose',
  'in-scope',
  'out-of-scope',
  'global-invariant',
  'ownership-boundary',
  'extension-policy',
  'assumption',
  'review-policy',
]);

const TEST_POLICY_KINDS = new Set<TestPolicyKind>([
  'verification-policy',
  'mapping-policy',
  'boundary-case',
  'identity-policy',
  'state-transition-policy',
  'generated-sql-policy',
  'review-policy',
]);

const REVIEW_PLAN_ARTIFACT_KINDS = new Set([
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
  'generated-doc',
  'script',
  'workflow',
  'unknown',
]);

/**
 * Checks DDL review metadata for structural drift.
 *
 * The command intentionally verifies references and object existence only.
 * Concept/process meaning stays with human and AI review.
 */
export function runCheckDocs(options: CheckDocsOptions): CheckDocsResult {
  const result = checkDocs(options);
  printCheckResult(result);
  if (result.errors.length > 0) {
    throw new Error(`DDL docs metadata check failed: ${result.errors.length} error(s), ${result.warnings.length} warning(s).`);
  }
  return result;
}

export function checkDocs(options: CheckDocsOptions): CheckDocsResult {
  const issues: CheckIssue[] = [];
  const sources = collectCheckSqlSources(options, issues);
  const schemaSettings = resolveSchemaSettings(options.configPath, options.defaultSchema, options.searchPath);
  const snapshot = sources.length > 0
    ? snapshotTableDocs(sources, schemaSettings, { columnOrder: 'definition' })
    : { tables: [], warnings: [] };

  for (const warning of snapshot.warnings) {
    issues.push({
      severity: 'warning',
      code: 'DDL_PARSE_WARNING',
      message: `${warning.source.filePath}: ${warning.message}`,
    });
  }

  const tableIndex = buildTableIndex(snapshot.tables);
  const conceptRegistry = options.conceptRelationshipPath
    ? readConceptRegistry(options.conceptRelationshipPath, issues)
    : { allIds: new Set<string>(), definedIds: new Set<string>() };
  const conceptIds = conceptRegistry.allIds;
  const processIds = readProcessIdsFromProcessMapMetadata(options.processDirectories ?? [], issues);
  const processFiles = collectProcessMapFiles(options.relationshipPath, options.processDirectories ?? [], issues);
  const scopeRuleRegistry = options.scopeRulesPath
    ? readScopeRuleRegistry(options.scopeRulesPath, issues)
    : undefined;
  if (options.testRulesPath) {
    readTestPolicyRegistry(options.testRulesPath, issues);
  }

  if (options.tableDocsPath) {
    checkTableDocsMetadata(options.tableDocsPath, tableIndex, { conceptIds, processIds }, issues);
  }
  if (options.orderPath) {
    checkOrderMetadata(options.orderPath, sources, issues);
  }
  if (options.relationshipPath) {
    checkRelationshipMetadata(options.relationshipPath, sources, scopeRuleRegistry, issues);
  }
  if (options.conceptRelationshipPath) {
    checkConceptRelationshipMetadata(options.conceptRelationshipPath, issues);
  }
  if (options.dfdRelationshipPath) {
    checkDfdRelationshipMetadata(options.dfdRelationshipPath, conceptRegistry, processFiles, issues);
  }
  for (const processMapPath of collectProcessMapMetadataPaths(options.processDirectories ?? [])) {
    checkProcessMapMetadata(processMapPath, conceptRegistry, issues);
  }

  return {
    errors: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
  };
}

function collectCheckSqlSources(options: CheckDocsOptions, issues: CheckIssue[]): SqlSource[] {
  const normalizedDirectories = dedupeDdlInputsByInstanceAndPath(options.ddlDirectories);
  const normalizedFiles = dedupeDdlInputsByInstanceAndPath(options.ddlFiles);
  const normalizedGlobs = dedupeDdlInputsByInstanceAndPath(options.ddlGlobs);
  const mergedFiles: DdlInput[] = [...normalizedFiles];
  for (const globInput of normalizedGlobs) {
    for (const p of expandGlobPatterns([globInput.path])) {
      mergedFiles.push({ path: p, instance: globInput.instance ?? '' });
    }
  }
  const uniqueFiles = dedupeDdlInputsByInstanceAndPath(mergedFiles);
  try {
    const rawSources = collectSqlFiles(normalizedDirectories, uniqueFiles, options.extensions);
    return options.filterPgDump
      ? rawSources.map((source) => ({ ...source, sql: filterPgDump(source.sql) }))
      : rawSources;
  } catch (error) {
    issues.push({
      severity: 'error',
      code: 'DDL_INPUT_ERROR',
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function checkTableDocsMetadata(
  metadataPath: string,
  tableIndex: Map<string, TableDocModel>,
  registry: { conceptIds: Set<string>; processIds: Set<string> },
  issues: CheckIssue[]
): void {
  let metadata: TableDocsMetadata;
  try {
    metadata = loadRawTableDocsMetadata(metadataPath);
  } catch (error) {
    issues.push({
      severity: 'error',
      code: 'TABLE_DOCS_SCHEMA_ERROR',
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const schemaNames = new Set(Array.from(tableIndex.values()).map((table) => table.schema));
  for (const schemaName of Object.keys(metadata.schemas ?? {})) {
    if (!schemaNames.has(schemaName)) {
      issues.push({
        severity: 'error',
        code: 'TABLE_DOCS_UNKNOWN_SCHEMA',
        message: `table-docs.json references unknown schema: ${schemaName}`,
      });
    }
  }

  const documentedTables = new Set<string>();
  for (const [tableKey, tableMetadata] of Object.entries(metadata.tables ?? {})) {
    const table = resolveTableKey(tableIndex, tableKey);
    if (!table) {
      issues.push({
        severity: 'error',
        code: 'TABLE_DOCS_UNKNOWN_TABLE',
        message: `table-docs.json references unknown table: ${tableKey}`,
      });
      continue;
    }
    documentedTables.add(`${table.schema}.${table.table}`);

    const columnNames = new Set(table.columns.map((column) => column.name));
    checkDesignIntentRefs(`table-docs.json table ${tableKey}`, tableMetadata, registry, issues);
    for (const columnName of Object.keys(tableMetadata.columns ?? {})) {
      if (!columnNames.has(columnName)) {
        issues.push({
          severity: 'error',
          code: 'TABLE_DOCS_UNKNOWN_COLUMN',
          message: `table-docs.json references unknown column: ${tableKey}.${columnName}`,
        });
      }
      checkDesignIntentRefs(`table-docs.json column ${tableKey}.${columnName}`, tableMetadata.columns?.[columnName], registry, issues);
    }

    const constraintNames = new Set(table.constraints.map((constraint) => constraint.name));
    for (const constraintName of Object.keys(tableMetadata.constraints ?? {})) {
      if (!constraintNames.has(constraintName)) {
        issues.push({
          severity: 'error',
          code: 'TABLE_DOCS_UNKNOWN_CONSTRAINT',
          message: `table-docs.json references unknown index/constraint: ${tableKey}.${constraintName}`,
        });
      }
      checkDesignIntentRefs(
        `table-docs.json index/constraint ${tableKey}.${constraintName}`,
        tableMetadata.constraints?.[constraintName],
        registry,
        issues
      );
    }
  }

  const uniqueTables = Array.from(new Map(
    Array.from(tableIndex.values()).map((table) => [`${table.schema}.${table.table}`, table])
  ).values());
  for (const table of uniqueTables) {
    const tableKey = `${table.schema}.${table.table}`;
    const tableMetadata = metadata.tables?.[tableKey] ?? metadata.tables?.[table.table];
    if (!documentedTables.has(tableKey)) {
      issues.push({
        severity: 'warning',
        code: 'TABLE_DOCS_MISSING_TABLE',
        message: `DDL table has no table-docs metadata: ${tableKey}`,
      });
    }

    for (const column of table.columns) {
      const columnMetadata = tableMetadata?.columns?.[column.name];
      const typeName = column.typeName.toLowerCase();
      if ((typeName.includes('json') || column.name.endsWith('_json')) && columnMetadata?.sample === undefined) {
        issues.push({
          severity: 'warning',
          code: 'TABLE_DOCS_JSON_COLUMN_WITHOUT_SAMPLE',
          message: `JSON column has no sample in table-docs metadata: ${tableKey}.${column.name}`,
        });
      }
      if (column.name.endsWith('_hash') && (columnMetadata?.designNotes?.length ?? 0) === 0) {
        issues.push({
          severity: 'warning',
          code: 'TABLE_DOCS_HASH_COLUMN_WITHOUT_REVIEW_NOTES',
          message: `Hash column has no review notes in table-docs metadata: ${tableKey}.${column.name}`,
        });
      }
    }

    for (const constraint of table.constraints) {
      const constraintMetadata = tableMetadata?.constraints?.[constraint.name];
      if (isImportantConstraintForReview(constraint) && (constraintMetadata?.designNotes?.length ?? 0) === 0) {
        issues.push({
          severity: 'warning',
          code: 'TABLE_DOCS_IMPORTANT_CONSTRAINT_WITHOUT_REVIEW_NOTES',
          message: `Important index/constraint has no review notes in table-docs metadata: ${tableKey}.${constraint.name}`,
        });
      }
    }
  }
}

function checkDesignIntentRefs(
  scope: string,
  value: unknown,
  registry: { conceptIds: Set<string>; processIds: Set<string> },
  issues: CheckIssue[]
): void {
  if (!isRecord(value)) {
    return;
  }
  const conceptRefs = value.conceptRefs;
  if (Array.isArray(conceptRefs)) {
    for (const ref of conceptRefs) {
      if (typeof ref === 'string' && registry.conceptIds.size > 0 && !registry.conceptIds.has(ref)) {
        issues.push({
          severity: 'error',
          code: 'TABLE_DOCS_UNKNOWN_CONCEPT_REF',
          message: `${scope} references unknown conceptRef: ${ref}`,
        });
      }
    }
  }
  const processRefs = value.processRefs;
  if (Array.isArray(processRefs)) {
    for (const ref of processRefs) {
      if (typeof ref === 'string' && registry.processIds.size > 0 && !registry.processIds.has(ref)) {
        issues.push({
          severity: 'error',
          code: 'TABLE_DOCS_UNKNOWN_PROCESS_REF',
          message: `${scope} references unknown processRef: ${ref}`,
        });
      }
    }
  }
}

function checkOrderMetadata(orderPath: string, sources: SqlSource[], issues: CheckIssue[]): void {
  const resolvedPath = path.resolve(process.cwd(), orderPath);
  const value = readJsonFile(resolvedPath, 'order.json', issues);
  if (!value) {
    return;
  }
  if (!isOrderMetadata(value)) {
    issues.push({
      severity: 'error',
      code: 'ORDER_SCHEMA_ERROR',
      message: `order.json must be an object with schemaVersion: 1 and string[] order: ${resolvedPath}`,
    });
    return;
  }

  const baseDir = path.dirname(resolvedPath);
  const seen = new Set<string>();
  for (const entry of value.order) {
    const normalized = normalizeRelativePath(entry);
    if (seen.has(normalized)) {
      issues.push({
        severity: 'error',
        code: 'ORDER_DUPLICATE_ENTRY',
        message: `order.json contains duplicate DDL entry: ${entry}`,
      });
    }
    seen.add(normalized);
    const resolvedEntry = path.resolve(baseDir, entry);
    if (!existsSync(resolvedEntry)) {
      issues.push({
        severity: 'error',
        code: 'ORDER_MISSING_DDL_FILE',
        message: `order.json references missing DDL file: ${entry}`,
      });
    }
  }

  const sourceEntries = new Set(
    sources.map((source) => normalizeRelativePath(path.relative(baseDir, path.resolve(process.cwd(), source.path))))
  );
  for (const sourceEntry of sourceEntries) {
    if (!seen.has(sourceEntry)) {
      issues.push({
        severity: 'error',
        code: 'ORDER_UNTRACKED_DDL_FILE',
        message: `DDL file is not registered in order.json: ${sourceEntry}`,
      });
    }
  }
}

function checkRelationshipMetadata(
  relationshipPath: string,
  sources: SqlSource[],
  scopeRuleRegistry: Set<string> | undefined,
  issues: CheckIssue[]
): void {
  const resolvedPath = path.resolve(process.cwd(), relationshipPath);
  const value = readJsonFile(resolvedPath, 'relationship.json', issues);
  if (!value) {
    return;
  }
  if (!isRelationshipMetadata(value)) {
    issues.push({
      severity: 'error',
      code: 'RELATIONSHIP_SCHEMA_ERROR',
      message: `relationship.json must be an object with schemaVersion: 1 and relationships[]: ${resolvedPath}`,
    });
    return;
  }

  const baseDir = path.dirname(resolvedPath);
  const ddlPaths = new Set(
    sources.map((source) => normalizeRelativePath(path.relative(baseDir, path.resolve(process.cwd(), source.path))))
  );
  const relationshipDdlPaths = new Set<string>();

  for (const entry of value.relationships) {
    const entryPath = normalizeRelativePath(entry.path);
    const resolvedEntryPath = path.resolve(baseDir, entry.path);
    if (!existsSync(resolvedEntryPath)) {
      issues.push({
        severity: 'error',
        code: 'RELATIONSHIP_MISSING_PATH',
        message: `relationship.json references missing path: ${entry.path}`,
      });
    }
    if (entry.path.endsWith('.sql')) {
      relationshipDdlPaths.add(entryPath);
    }
    if (entry.reason !== undefined && entry.reason.trim() === '') {
      issues.push({
        severity: 'warning',
        code: 'RELATIONSHIP_EMPTY_REASON',
        message: `relationship.json reason is empty for: ${entry.path}`,
      });
    }
    for (const target of entry.concepts ?? []) {
      checkRelationshipTarget(baseDir, 'concept', entry.path, target, issues);
    }
    for (const target of entry.processes ?? []) {
      checkRelationshipTarget(baseDir, 'process', entry.path, target, issues);
    }
    for (const scopeRule of entry.scopeRules ?? []) {
      checkRelationshipScopeRule(entry.path, scopeRule, scopeRuleRegistry, issues);
    }
  }

  for (const ddlPath of ddlPaths) {
    if (!relationshipDdlPaths.has(ddlPath)) {
      issues.push({
        severity: 'warning',
        code: 'RELATIONSHIP_UNTRACKED_DDL_FILE',
        message: `DDL file is not registered in relationship.json: ${ddlPath}`,
      });
    }
  }
}

function checkRelationshipScopeRule(
  entryPath: string,
  scopeRule: RelationshipScopeRuleRef,
  scopeRuleRegistry: Set<string> | undefined,
  issues: CheckIssue[]
): void {
  if (!scopeRuleRegistry) {
    issues.push({
      severity: 'warning',
      code: 'RELATIONSHIP_SCOPE_RULES_WITHOUT_REGISTRY',
      message: `relationship.json references scope rule without --scope-rules validation for ${entryPath}: ${scopeRule.id}`,
    });
    return;
  }
  if (!scopeRuleRegistry.has(scopeRule.id)) {
    issues.push({
      severity: 'error',
      code: 'RELATIONSHIP_UNKNOWN_SCOPE_RULE',
      message: `relationship.json references unknown scope rule for ${entryPath}: ${scopeRule.id}`,
    });
  }
  if (scopeRule.reason !== undefined && scopeRule.reason.trim() === '') {
    issues.push({
      severity: 'warning',
      code: 'RELATIONSHIP_EMPTY_SCOPE_RULE_REASON',
      message: `relationship.json scope rule reason is empty for ${entryPath}: ${scopeRule.id}`,
    });
  }
}

function checkRelationshipTarget(
  baseDir: string,
  targetKind: 'concept' | 'process',
  entryPath: string,
  target: RelationshipTarget,
  issues: CheckIssue[]
): void {
  if (!existsSync(path.resolve(baseDir, target.path))) {
    issues.push({
      severity: 'error',
      code: 'RELATIONSHIP_MISSING_TARGET',
      message: `relationship.json ${targetKind} target is missing for ${entryPath}: ${target.path}`,
    });
  }
  if (target.reason !== undefined && target.reason.trim() === '') {
    issues.push({
      severity: 'warning',
      code: 'RELATIONSHIP_EMPTY_TARGET_REASON',
      message: `relationship.json ${targetKind} reason is empty for ${entryPath}: ${target.path}`,
    });
  }
}

function checkConceptRelationshipMetadata(conceptRelationshipPath: string, issues: CheckIssue[]): void {
  const resolvedPath = path.resolve(process.cwd(), conceptRelationshipPath);
  const value = readJsonFile(resolvedPath, 'concept-relationship.json', issues);
  if (!value) {
    return;
  }
  if (!isConceptRelationshipMetadata(value)) {
    issues.push({
      severity: 'error',
      code: 'CONCEPT_RELATIONSHIP_SCHEMA_ERROR',
      message: `concept-relationship.json must be an object with schemaVersion: 1: ${resolvedPath}`,
    });
    return;
  }

  const baseDir = path.dirname(resolvedPath);
  const conceptIds = new Set<string>();
  for (const concept of value.concepts ?? []) {
    if (conceptIds.has(concept.id)) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_DUPLICATE_ID',
        message: `concept-relationship.json contains duplicate concept id: ${concept.id}`,
      });
    }
    conceptIds.add(concept.id);
    if (concept.path !== undefined && concept.path !== null && !existsSync(path.resolve(baseDir, concept.path))) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_MISSING_SPEC_PATH',
        message: `concept-relationship.json references missing concept path for ${concept.id}: ${concept.path}`,
      });
    }
    if (concept.draftPath !== undefined && concept.draftPath !== null && !existsSync(path.resolve(baseDir, concept.draftPath))) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_MISSING_DRAFT_PATH',
        message: `concept-relationship.json references missing draft concept path for ${concept.id}: ${concept.draftPath}`,
      });
    }
    if (concept.path !== undefined && concept.path !== null && concept.draftPath !== undefined && concept.draftPath !== null) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_PATH_AND_DRAFT_PATH_BOTH_SET',
        message: `concept-relationship.json concept must not set both path and draftPath: ${concept.id}`,
      });
    }
    checkConceptSummaryMetadata(concept, issues);
    checkConceptMetadataNote(`concept note ${concept.id}`, concept.note, issues);
    checkConceptLifecycleEntry(baseDir, concept, issues);
  }
  checkConceptDirectoriesRegistered(baseDir, conceptIds, issues);

  for (const relationship of value.relationships ?? []) {
    if (!conceptIds.has(relationship.from)) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_RELATIONSHIP_UNKNOWN_FROM',
        message: `concept relationship uses unknown from id: ${relationship.from}`,
      });
    }
    if (!conceptIds.has(relationship.to)) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_RELATIONSHIP_UNKNOWN_TO',
        message: `concept relationship uses unknown to id: ${relationship.to}`,
      });
    }
    checkConceptMetadataNote(`concept relationship reason ${relationship.from}->${relationship.to}`, relationship.reason, issues);
  }

  for (const view of value.views ?? []) {
    for (const conceptId of view.concepts ?? []) {
      if (!conceptIds.has(conceptId)) {
        issues.push({
          severity: 'error',
          code: 'CONCEPT_VIEW_UNKNOWN_CONCEPT',
          message: `concept view ${view.id} references unknown concept id: ${conceptId}`,
        });
      }
    }
  }

  const glossaryTermIds = new Set<string>();
  for (const term of value.glossaryTerms ?? []) {
    if (glossaryTermIds.has(term.id)) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_GLOSSARY_DUPLICATE_ID',
        message: `concept-relationship.json contains duplicate glossary term id: ${term.id}`,
      });
    }
    glossaryTermIds.add(term.id);
    for (const termPath of term.definedIn ?? []) {
      if (!existsSync(path.resolve(baseDir, termPath))) {
        issues.push({
          severity: 'error',
          code: 'CONCEPT_GLOSSARY_MISSING_DEFINED_IN_PATH',
          message: `concept-relationship.json glossary term ${term.id} references missing definedIn path: ${termPath}`,
        });
      }
    }
    checkConceptMetadataNote(`glossary meaning ${term.id}`, term.meaning, issues);
    checkConceptMetadataNote(`glossary note ${term.id}`, term.note, issues);
  }

  const relatedProcessMapIds = new Set<string>();
  for (const processMap of value.relatedProcessMaps ?? []) {
    if (relatedProcessMapIds.has(processMap.id)) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_RELATED_PROCESS_MAP_DUPLICATE_ID',
        message: `concept-relationship.json contains duplicate related process map id: ${processMap.id}`,
      });
    }
    relatedProcessMapIds.add(processMap.id);
    if (!existsSync(path.resolve(baseDir, processMap.path))) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_RELATED_PROCESS_MAP_MISSING_PATH',
        message: `concept-relationship.json related process map ${processMap.id} references missing path: ${processMap.path}`,
      });
    }
  }
}

function checkConceptMetadataNote(scope: string, value: string | undefined, issues: CheckIssue[]): void {
  if (value !== undefined && value.trim().length > CONCEPT_METADATA_NOTE_MAX_LENGTH) {
    issues.push({
      severity: 'warning',
      code: 'CONCEPT_METADATA_NOTE_TOO_LONG',
      message: `concept-relationship.json ${scope} should stay short and index-like.`,
    });
  }
}

function checkConceptSummaryMetadata(concept: ConceptEntry, issues: CheckIssue[]): void {
  const summary = concept.summary?.trim();
  if ((concept.status === 'defined' || concept.status === 'draft') && !summary) {
    issues.push({
      severity: 'warning',
      code: 'CONCEPT_SUMMARY_MISSING',
      message: `concept-relationship.json ${concept.status} concept has no summary index note: ${concept.id}`,
    });
    return;
  }
  if (summary && summary.length > CONCEPT_SUMMARY_MAX_LENGTH) {
    issues.push({
      severity: 'warning',
      code: 'CONCEPT_SUMMARY_TOO_LONG',
      message: `concept-relationship.json summary should stay short and index-like: ${concept.id}`,
    });
  }
}

function checkConceptLifecycleEntry(baseDir: string, concept: ConceptEntry, issues: CheckIssue[]): void {
  if (concept.status === 'defined') {
    if (concept.path === undefined || concept.path === null || concept.path.trim() === '') {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_DEFINED_MISSING_PATH',
        message: `concept-relationship.json defined concept must use path: ${concept.id}`,
      });
      return;
    }
    const specPath = path.resolve(baseDir, concept.path);
    const conceptDir = path.dirname(specPath);
    if (existsSync(path.join(conceptDir, 'DRAFT.md'))) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_DEFINED_HAS_DRAFT',
        message: `concept-relationship.json marks concept as defined while DRAFT.md exists: ${concept.id}`,
      });
    }
    return;
  }

  if (concept.status === 'draft') {
    if (concept.draftPath === undefined || concept.draftPath === null || concept.draftPath.trim() === '') {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_DRAFT_MISSING_DRAFT_PATH',
        message: `concept-relationship.json draft concept must use draftPath: ${concept.id}`,
      });
      return;
    }
    const draftPath = path.resolve(baseDir, concept.draftPath);
    const conceptDir = path.dirname(draftPath);
    if (existsSync(path.join(conceptDir, 'SPEC.md'))) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_DRAFT_HAS_SPEC',
        message: `concept-relationship.json marks concept as draft while SPEC.md exists: ${concept.id}`,
      });
    }
    return;
  }

  if (concept.path !== undefined && concept.path !== null) {
    issues.push({
      severity: 'error',
      code: 'CONCEPT_NON_AUTHORITATIVE_HAS_PATH',
      message: `concept-relationship.json non-authoritative concept must not use path: ${concept.id}`,
    });
  }
  if (concept.draftPath !== undefined && concept.draftPath !== null) {
    issues.push({
      severity: 'error',
      code: 'CONCEPT_NON_AUTHORITATIVE_HAS_DRAFT_PATH',
      message: `concept-relationship.json non-authoritative concept must not use draftPath: ${concept.id}`,
    });
  }
  const conceptDir = path.join(baseDir, concept.id);
  if (existsSync(path.join(conceptDir, 'SPEC.md')) || existsSync(path.join(conceptDir, 'DRAFT.md'))) {
    issues.push({
      severity: 'error',
      code: 'CONCEPT_NON_AUTHORITATIVE_HAS_SPEC_OR_DRAFT',
      message: `non-authoritative concept must not have SPEC.md or DRAFT.md: ${concept.id}`,
    });
  }
}

function checkConceptDirectoriesRegistered(baseDir: string, conceptIds: Set<string>, issues: CheckIssue[]): void {
  if (!existsSync(baseDir)) {
    return;
  }
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const conceptDir = path.join(baseDir, entry.name);
    const hasSpec = existsSync(path.join(conceptDir, 'SPEC.md'));
    const hasDraft = existsSync(path.join(conceptDir, 'DRAFT.md'));
    if (hasSpec && hasDraft) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_DIRECTORY_HAS_SPEC_AND_DRAFT',
        message: `concept directory must not contain both SPEC.md and DRAFT.md: ${entry.name}`,
      });
    }
    if ((hasSpec || hasDraft) && !conceptIds.has(entry.name)) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_DIRECTORY_NOT_REGISTERED',
        message: `concept directory with SPEC.md or DRAFT.md is missing from concept-relationship.json: ${entry.name}`,
      });
    }
  }
}

function checkDfdRelationshipMetadata(
  dfdRelationshipPath: string,
  conceptRegistry: { allIds: Set<string>; definedIds: Set<string> },
  processFiles: string[],
  issues: CheckIssue[]
): void {
  const resolvedPath = path.resolve(process.cwd(), dfdRelationshipPath);
  const value = readJsonFile(resolvedPath, 'dfd-relationship.json', issues);
  if (!value) {
    return;
  }
  if (!isDfdRelationshipMetadata(value)) {
    issues.push({
      severity: 'error',
      code: 'DFD_RELATIONSHIP_SCHEMA_ERROR',
      message: `dfd-relationship.json must be an object with schemaVersion: 1: ${resolvedPath}`,
    });
    return;
  }

  const baseDir = path.dirname(resolvedPath);
  const dfdMarkdownPaths = new Set<string>();
  if (conceptRegistry.definedIds.size === 0) {
    issues.push({
      severity: 'warning',
      code: 'DFD_CONCEPT_REGISTRY_NOT_PROVIDED',
      message: 'dfd-relationship.json cannot validate concept refs because no concept registry was loaded.',
    });
  }

  const groupIds = new Set<string>();
  const groupLabels = new Map<string, string>();
  const subsystemIds = new Set<string>();
  for (const subsystem of value.subsystems ?? []) {
    if (subsystemIds.has(subsystem.id)) {
      issues.push({
        severity: 'error',
        code: 'DFD_SUBSYSTEM_DUPLICATE_ID',
        message: `dfd-relationship.json contains duplicate subsystem id: ${subsystem.id}`,
      });
    }
    subsystemIds.add(subsystem.id);
  }
  for (const group of value.conceptGroups ?? []) {
    if (groupIds.has(group.id)) {
      issues.push({
        severity: 'error',
        code: 'DFD_GROUP_DUPLICATE_ID',
        message: `dfd-relationship.json contains duplicate concept group id: ${group.id}`,
      });
    }
    groupIds.add(group.id);
    groupLabels.set(group.id, group.displayName ?? group.id);
    if (group.scope !== 'dfd-only') {
      issues.push({
        severity: 'error',
        code: 'DFD_GROUP_SCOPE_NOT_DFD_ONLY',
        message: `DFD concept group must use scope "dfd-only": ${group.id}`,
      });
    }
    if (group.members.length === 0) {
      issues.push({
        severity: 'error',
        code: 'DFD_GROUP_EMPTY_MEMBERS',
        message: `DFD concept group has no members: ${group.id}`,
      });
    }
  }

  const externalStoreIds = new Set((value.externalStores ?? []).map((entry) => entry.id));
  const derivedViewIds = new Set((value.derivedViews ?? []).map((entry) => entry.id));

  for (const group of value.conceptGroups ?? []) {
    for (const member of group.members) {
      if (member.type === 'concept-group') {
        issues.push({
          severity: 'error',
          code: 'DFD_GROUP_MEMBER_CONCEPT_GROUP_NOT_ALLOWED',
          message: `DFD concept group member must not be another concept group: ${group.id} -> ${member.id}`,
        });
        continue;
      }
      checkDfdTermRef(`DFD concept group ${group.id}`, member, { conceptRegistry, groupIds, externalStoreIds, derivedViewIds }, issues);
    }
  }

  const dfdIds = new Set<string>();
  for (const dfd of value.dfds ?? []) {
    if (dfdIds.has(dfd.id)) {
      issues.push({
        severity: 'error',
        code: 'DFD_DUPLICATE_ID',
        message: `dfd-relationship.json contains duplicate DFD id: ${dfd.id}`,
      });
    }
    dfdIds.add(dfd.id);
    if (dfd.subsystem && subsystemIds.size > 0 && !subsystemIds.has(dfd.subsystem)) {
      issues.push({
        severity: 'error',
        code: 'DFD_UNKNOWN_SUBSYSTEM',
        message: `DFD ${dfd.id} references unknown subsystem: ${dfd.subsystem}`,
      });
    }
    if (!existsSync(path.resolve(baseDir, dfd.path))) {
      issues.push({
        severity: 'error',
        code: 'DFD_MISSING_PATH',
        message: `dfd-relationship.json references missing DFD path for ${dfd.id}: ${dfd.path}`,
      });
    } else {
      dfdMarkdownPaths.add(path.resolve(baseDir, dfd.path));
      checkDfdMarkdownAgainstRelationship(path.resolve(baseDir, dfd.path), dfd, issues);
    }
    for (const operation of dfd.businessOperations ?? []) {
      for (const input of operation.inputs ?? []) {
        checkDfdTermRef(
          `DFD ${dfd.id} operation ${operation.id} input`,
          input,
          { conceptRegistry, groupIds, externalStoreIds, derivedViewIds },
          issues
        );
      }
      for (const output of operation.outputs ?? []) {
        checkDfdTermRef(
          `DFD ${dfd.id} operation ${operation.id} output`,
          output,
          { conceptRegistry, groupIds, externalStoreIds, derivedViewIds },
          issues
        );
      }
      for (const use of operation.uses ?? []) {
        checkDfdTermRef(
          `DFD ${dfd.id} operation ${operation.id} use`,
          use,
          { conceptRegistry, groupIds, externalStoreIds, derivedViewIds },
          issues
        );
      }
    }
  }

  checkProcessFilesDoNotUseDfdGroups(processFiles, groupLabels, issues);
}

function collectProcessMapMetadataPaths(processDirectories: string[]): string[] {
  const result = new Set<string>();
  for (const directory of processDirectories) {
    const resolvedDirectory = path.resolve(process.cwd(), directory);
    if (!existsSync(resolvedDirectory)) {
      continue;
    }
    const metadataPath = path.join(resolvedDirectory, 'process-map.json');
    if (existsSync(metadataPath)) {
      result.add(metadataPath);
    }
  }
  return Array.from(result).sort();
}

function checkProcessMapMetadata(
  processMapPath: string,
  conceptRegistry: { allIds: Set<string>; definedIds: Set<string> },
  issues: CheckIssue[]
): void {
  const resolvedPath = path.resolve(process.cwd(), processMapPath);
  const value = readJsonFile(resolvedPath, 'process-map.json', issues);
  if (!value) {
    return;
  }
  if (!isProcessMapMetadata(value)) {
    issues.push({
      severity: 'error',
      code: 'PROCESS_MAP_SCHEMA_ERROR',
      message: `process-map.json must be an object with schemaVersion: 1: ${resolvedPath}`,
    });
    return;
  }

  const baseDir = path.dirname(resolvedPath);
  const processMapIds = new Set<string>();
  const processMapPaths = new Set<string>();
  for (const processMap of value.processMaps ?? []) {
    if (processMapIds.has(processMap.id)) {
      issues.push({
        severity: 'error',
        code: 'PROCESS_MAP_DUPLICATE_ID',
        message: `process-map.json contains duplicate process map id: ${processMap.id}`,
      });
    }
    processMapIds.add(processMap.id);
    processMapPaths.add(normalizeRelativePath(processMap.path));
    const resolvedProcessMapPath = path.resolve(baseDir, processMap.path);
    if (!existsSync(resolvedProcessMapPath)) {
      issues.push({
        severity: 'error',
        code: 'PROCESS_MAP_MISSING_PATH',
        message: `process-map.json references missing process map path for ${processMap.id}: ${processMap.path}`,
      });
    } else {
      checkProcessMapRuleReference(resolvedProcessMapPath, baseDir, issues);
    }
  }

  for (const markdownPath of collectMarkdownFiles(baseDir)) {
    const relativePath = normalizeRelativePath(path.relative(baseDir, markdownPath));
    if (relativePath === 'README.md') {
      continue;
    }
    if (!processMapPaths.has(relativePath)) {
      issues.push({
        severity: 'error',
        code: 'PROCESS_MAP_MARKDOWN_NOT_REGISTERED',
        message: `process markdown is not registered in process-map.json: ${relativePath}`,
      });
    }
  }

  const viewIds = new Set<string>();
  const externalStoreIds = new Set((value.externalStores ?? []).map((entry) => entry.id));
  const derivedViewIds = new Set((value.derivedViews ?? []).map((entry) => entry.id));
  if (conceptRegistry.definedIds.size === 0) {
    issues.push({
      severity: 'warning',
      code: 'PROCESS_MAP_CONCEPT_REGISTRY_NOT_PROVIDED',
      message: 'process-map.json cannot validate concept refs because no concept registry was loaded.',
    });
  }
  for (const view of value.views ?? []) {
    if (viewIds.has(view.id)) {
      issues.push({
        severity: 'error',
        code: 'PROCESS_MAP_VIEW_DUPLICATE_ID',
        message: `process-map.json contains duplicate view id: ${view.id}`,
      });
    }
    viewIds.add(view.id);
    if (!processMapIds.has(view.processMap)) {
      issues.push({
        severity: 'error',
        code: 'PROCESS_MAP_VIEW_UNKNOWN_PROCESS_MAP',
        message: `process-map.json view references unknown process map ${view.processMap}: ${view.id}`,
      });
    }
    for (const conceptId of [...(view.concepts ?? []), ...(view.relatedConcepts ?? [])]) {
      if (conceptRegistry.definedIds.size > 0 && !conceptRegistry.definedIds.has(conceptId)) {
        issues.push({
          severity: 'error',
          code: conceptRegistry.allIds.has(conceptId)
            ? 'PROCESS_MAP_VIEW_CONCEPT_NOT_DEFINED'
            : 'PROCESS_MAP_VIEW_UNKNOWN_CONCEPT',
          message: `process-map.json view references ${conceptRegistry.allIds.has(conceptId) ? 'non-defined' : 'unknown'} concept ${conceptId}: ${view.id}`,
        });
      }
    }
    for (const [fieldName, refs] of [
      ['input', view.inputs ?? []],
      ['output', view.outputs ?? []],
      ['use', view.uses ?? []],
    ] as const) {
      for (const ref of refs) {
        checkProcessMapTermRef(
          `Process Map view ${view.id} ${fieldName}`,
          ref,
          { conceptRegistry, externalStoreIds, derivedViewIds },
          issues
        );
      }
    }
  }
}

function checkProcessMapRuleReference(processMapPath: string, baseDir: string, issues: CheckIssue[]): void {
  const body = readFileSync(processMapPath, 'utf8');
  if (body.includes(PROCESS_MAP_RULE_REFERENCE_TARGET)) {
    return;
  }

  issues.push({
    severity: 'warning',
    code: 'PROCESS_MAP_RULE_REFERENCE_MISSING',
    message: `process map markdown should link to the shared Process Map Rules: ${normalizeRelativePath(path.relative(baseDir, processMapPath))}`,
  });
}

function checkDfdMarkdownAgainstRelationship(
  dfdPath: string,
  dfd: DfdEntry,
  issues: CheckIssue[]
): void {
  const body = readFileSync(dfdPath, 'utf8');
  for (const operation of dfd.businessOperations ?? []) {
    const operationBody = extractOperationSectionBody(body, operation.displayName ?? operation.id);
    if (operation.displayName && !body.includes(operation.displayName)) {
      issues.push({
        severity: 'warning',
        code: 'DFD_MARKDOWN_MISSING_OPERATION_DISPLAY_NAME',
        message: `DFD markdown does not mention operation displayName ${operation.displayName}: ${dfd.path}`,
      });
    }
    checkDfdWhoLabels(
      `DFD ${dfd.id} operation ${operation.id}`,
      operationBody,
      issues
    );
  }
}

function checkDfdWhoLabels(scope: string, body: string, issues: CheckIssue[]): void {
  const whoLabels = extractMermaidWhoLabels(body);
  if (whoLabels.length === 0) {
    issues.push({
      severity: 'warning',
      code: 'DFD_MARKDOWN_WHO_LABEL_MISSING',
      message: `${scope} should expose one or more Mermaid Who labels for role extraction.`,
    });
    return;
  }
}

function extractMermaidWhoLabels(body: string): string[] {
  const labels: string[] = [];
  const pattern = /Who:\s*([^"\/\]]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const rawLabel = match[1]?.trim();
    if (rawLabel) {
      labels.push(rawLabel);
    }
  }
  return labels;
}

function extractOperationSectionBody(body: string, operationName: string): string {
  const lines = body.split(/\r?\n/);
  let inSection = false;
  const sectionLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) {
        break;
      }
      inSection = line.toLowerCase().includes(operationName.toLowerCase());
      if (inSection) {
        sectionLines.push(line);
      }
      continue;
    }
    if (inSection) {
      sectionLines.push(line);
    }
  }
  return sectionLines.join('\n');
}

function checkDfdTermRef(
  scope: string,
  ref: DfdTermRef,
  registry: {
    conceptRegistry: { allIds: Set<string>; definedIds: Set<string> };
    groupIds: Set<string>;
    externalStoreIds: Set<string>;
    derivedViewIds: Set<string>;
  },
  issues: CheckIssue[]
): void {
  if (ref.type === 'concept') {
    if (registry.conceptRegistry.definedIds.size > 0 && !registry.conceptRegistry.definedIds.has(ref.id)) {
      const knownButNotDefined = registry.conceptRegistry.allIds.has(ref.id);
      issues.push({
        severity: 'error',
        code: knownButNotDefined ? 'DFD_REF_CONCEPT_NOT_DEFINED' : 'DFD_REF_UNKNOWN_CONCEPT',
        message: `${scope} references ${knownButNotDefined ? 'non-defined' : 'unknown'} concept: ${ref.id}`,
      });
    }
    return;
  }
  if (ref.type === 'concept-group') {
    if (!registry.groupIds.has(ref.id)) {
      issues.push({
        severity: 'error',
        code: 'DFD_REF_UNKNOWN_CONCEPT_GROUP',
        message: `${scope} references unknown DFD concept group: ${ref.id}`,
      });
    }
    return;
  }
  if (ref.type === 'external-store') {
    if (!registry.externalStoreIds.has(ref.id)) {
      issues.push({
        severity: 'error',
        code: 'DFD_REF_UNKNOWN_EXTERNAL_STORE',
        message: `${scope} references unknown external store: ${ref.id}`,
      });
    }
    return;
  }
  if (ref.type === 'derived-view') {
    if (!registry.derivedViewIds.has(ref.id)) {
      issues.push({
        severity: 'error',
        code: 'DFD_REF_UNKNOWN_DERIVED_VIEW',
        message: `${scope} references unknown derived view: ${ref.id}`,
      });
    }
    return;
  }
  issues.push({
    severity: 'error',
    code: 'DFD_REF_UNKNOWN_TYPE',
    message: `${scope} uses unsupported DFD ref type: ${ref.type}`,
  });
}

function checkProcessMapTermRef(
  scope: string,
  ref: DfdTermRef,
  registry: {
    conceptRegistry: { allIds: Set<string>; definedIds: Set<string> };
    externalStoreIds: Set<string>;
    derivedViewIds: Set<string>;
  },
  issues: CheckIssue[]
): void {
  if (ref.type === 'concept') {
    if (registry.conceptRegistry.definedIds.size > 0 && !registry.conceptRegistry.definedIds.has(ref.id)) {
      const knownButNotDefined = registry.conceptRegistry.allIds.has(ref.id);
      issues.push({
        severity: 'error',
        code: knownButNotDefined ? 'PROCESS_MAP_REF_CONCEPT_NOT_DEFINED' : 'PROCESS_MAP_REF_UNKNOWN_CONCEPT',
        message: `${scope} references ${knownButNotDefined ? 'non-defined' : 'unknown'} concept: ${ref.id}`,
      });
    }
    return;
  }
  if (ref.type === 'external-store') {
    if (!registry.externalStoreIds.has(ref.id)) {
      issues.push({
        severity: 'error',
        code: 'PROCESS_MAP_REF_UNKNOWN_EXTERNAL_STORE',
        message: `${scope} references unknown external store: ${ref.id}`,
      });
    }
    return;
  }
  if (ref.type === 'derived-view') {
    if (!registry.derivedViewIds.has(ref.id)) {
      issues.push({
        severity: 'error',
        code: 'PROCESS_MAP_REF_UNKNOWN_DERIVED_VIEW',
        message: `${scope} references unknown derived view: ${ref.id}`,
      });
    }
    return;
  }
  if (ref.type === 'concept-group') {
    issues.push({
      severity: 'error',
      code: 'PROCESS_MAP_REF_CONCEPT_GROUP_NOT_ALLOWED',
      message: `${scope} must not use DFD concept group: ${ref.id}`,
    });
    return;
  }
  issues.push({
    severity: 'error',
    code: 'PROCESS_MAP_REF_UNKNOWN_TYPE',
    message: `${scope} uses unsupported Process Map ref type: ${ref.type}`,
  });
}

function checkProcessFilesDoNotUseDfdGroups(processFiles: string[], groupLabels: Map<string, string>, issues: CheckIssue[]): void {
  if (processFiles.length === 0 || groupLabels.size === 0) {
    return;
  }
  for (const processFile of processFiles) {
    if (!existsSync(processFile)) {
      continue;
    }
    const body = readFileSync(processFile, 'utf8');
    for (const [groupId, groupLabel] of groupLabels.entries()) {
      const labels = [groupId, groupLabel].filter((value, index, values) => values.indexOf(value) === index);
      for (const label of labels) {
        if (body.includes(label)) {
          issues.push({
            severity: 'error',
            code: 'PROCESS_USES_DFD_CONCEPT_GROUP',
            message: `Process Map must not use DFD concept group ${groupId} (${label}): ${processFile}`,
          });
          break;
        }
      }
    }
  }
}

function readConceptRegistry(conceptRelationshipPath: string, issues: CheckIssue[]): { allIds: Set<string>; definedIds: Set<string> } {
  const resolvedPath = path.resolve(process.cwd(), conceptRelationshipPath);
  const value = readJsonFile(resolvedPath, 'concept-relationship.json', issues);
  if (!isConceptRelationshipMetadata(value)) {
    return { allIds: new Set(), definedIds: new Set() };
  }
  const entries = (value.concepts ?? []).filter(isConceptEntry);
  return {
    allIds: new Set(entries.map((entry) => entry.id)),
    definedIds: new Set(entries.filter((entry) => entry.status === 'defined').map((entry) => entry.id)),
  };
}

function readScopeRuleRegistry(scopeRulesPath: string, issues: CheckIssue[]): Set<string> {
  const resolvedPath = path.resolve(process.cwd(), scopeRulesPath);
  const value = readJsonFile(resolvedPath, 'scope-rules.json', issues);
  if (!value) {
    return new Set();
  }
  if (!isScopeRulesMetadata(value)) {
    issues.push({
      severity: 'error',
      code: 'SCOPE_RULES_SCHEMA_ERROR',
      message: `scope-rules.json must be an object with schemaVersion: 1 and scopeRules[]: ${resolvedPath}`,
    });
    return new Set();
  }
  const ids = new Set<string>();
  for (const scopeRule of value.scopeRules) {
    if (ids.has(scopeRule.id)) {
      issues.push({
        severity: 'error',
        code: 'SCOPE_RULE_DUPLICATE_ID',
        message: `scope-rules.json contains duplicate scope rule id: ${scopeRule.id}`,
      });
    }
    ids.add(scopeRule.id);
    if (!SCOPE_RULE_KINDS.has(scopeRule.kind)) {
      issues.push({
        severity: 'error',
        code: 'SCOPE_RULE_UNKNOWN_KIND',
        message: `scope-rules.json uses unknown scope rule kind for ${scopeRule.id}: ${scopeRule.kind}`,
      });
    }
    if (scopeRule.statement.trim() === '') {
      issues.push({
        severity: 'error',
        code: 'SCOPE_RULE_EMPTY_STATEMENT',
        message: `scope-rules.json scope rule statement must not be empty: ${scopeRule.id}`,
      });
    }
  }
  return ids;
}

function readTestPolicyRegistry(testRulesPath: string, issues: CheckIssue[]): Set<string> {
  const resolvedPath = path.resolve(process.cwd(), testRulesPath);
  const value = readJsonFile(resolvedPath, 'test-rules.json', issues);
  if (!value) {
    return new Set();
  }
  if (!isTestRulesMetadata(value)) {
    issues.push({
      severity: 'error',
      code: 'TEST_RULES_SCHEMA_ERROR',
      message: `test-rules.json must be an object with schemaVersion: 1 and testPolicies[]: ${resolvedPath}`,
    });
    return new Set();
  }
  const ids = new Set<string>();
  for (const policy of value.testPolicies) {
    if (ids.has(policy.id)) {
      issues.push({
        severity: 'error',
        code: 'TEST_POLICY_DUPLICATE_ID',
        message: `test-rules.json has duplicate test policy id: ${policy.id}`,
      });
    }
    ids.add(policy.id);
    if (!TEST_POLICY_KINDS.has(policy.kind)) {
      issues.push({
        severity: 'error',
        code: 'TEST_POLICY_UNKNOWN_KIND',
        message: `test-rules.json has unknown test policy kind: ${policy.kind}`,
      });
    }
    if (policy.statement.trim().length === 0) {
      issues.push({
        severity: 'error',
        code: 'TEST_POLICY_EMPTY_STATEMENT',
        message: `test-rules.json has empty statement for test policy: ${policy.id}`,
      });
    }
    for (const artifactKind of policy.appliesTo ?? []) {
      if (!REVIEW_PLAN_ARTIFACT_KINDS.has(artifactKind)) {
        issues.push({
          severity: 'error',
          code: 'TEST_POLICY_UNKNOWN_ARTIFACT_KIND',
          message: `test-rules.json references unknown review-plan artifact kind "${artifactKind}" in test policy: ${policy.id}`,
        });
      }
    }
  }
  return ids;
}

function readProcessIdsFromProcessMapMetadata(processDirectories: string[], issues: CheckIssue[]): Set<string> {
  const ids = new Set<string>();
  for (const processMapPath of collectProcessMapMetadataPaths(processDirectories)) {
    const value = readJsonFile(processMapPath, 'process-map.json', issues);
    if (!isProcessMapMetadata(value)) {
      continue;
    }
    for (const processMap of value.processMaps ?? []) {
      ids.add(processMap.id);
    }
  }
  return ids;
}

function collectProcessMapFiles(relationshipPath: string | undefined, processDirectories: string[], issues: CheckIssue[]): string[] {
  const paths = new Set<string>();
  if (relationshipPath) {
    const resolvedPath = path.resolve(process.cwd(), relationshipPath);
    const value = readJsonFile(resolvedPath, 'relationship.json', issues);
    if (isRelationshipMetadata(value)) {
      const baseDir = path.dirname(resolvedPath);
      for (const entry of value.relationships) {
        for (const process of entry.processes ?? []) {
          paths.add(path.resolve(baseDir, process.path));
        }
      }
    }
  }
  for (const directory of processDirectories) {
    const resolvedDirectory = path.resolve(process.cwd(), directory);
    if (!existsSync(resolvedDirectory)) {
      issues.push({
        severity: 'error',
        code: 'PROCESS_DIR_MISSING',
        message: `Process Map directory does not exist: ${directory}`,
      });
      continue;
    }
    for (const file of collectMarkdownFiles(resolvedDirectory)) {
      paths.add(file);
    }
  }
  return Array.from(paths);
}

function collectMarkdownFiles(directory: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      result.push(fullPath);
    }
  }
  return result;
}

function buildTableIndex(tables: TableDocModel[]): Map<string, TableDocModel> {
  const result = new Map<string, TableDocModel>();
  const tableNameCounts = new Map<string, number>();
  for (const table of tables) {
    result.set(`${table.schema}.${table.table}`, table);
    tableNameCounts.set(table.table, (tableNameCounts.get(table.table) ?? 0) + 1);
  }
  for (const table of tables) {
    if (tableNameCounts.get(table.table) === 1) {
      result.set(table.table, table);
    }
  }
  return result;
}

function resolveTableKey(tableIndex: Map<string, TableDocModel>, tableKey: string): TableDocModel | undefined {
  return tableIndex.get(tableKey);
}

function isImportantConstraintForReview(constraint: { kind: string; name: string; expression: string }): boolean {
  if (!constraint.name) {
    return false;
  }
  if (constraint.kind === 'UK') {
    return true;
  }
  if (constraint.kind === 'INDEX' && /_hash\b/.test(constraint.expression)) {
    return true;
  }
  if (constraint.kind === 'CHECK' && /(status|route|operation|model)/.test(constraint.name)) {
    return true;
  }
  if (constraint.kind === 'FK' && constraint.expression.includes(',')) {
    return true;
  }
  return false;
}

function readJsonFile(filePath: string, label: string, issues: CheckIssue[]): unknown | undefined {
  if (!existsSync(filePath)) {
    issues.push({
      severity: 'error',
      code: 'JSON_FILE_NOT_FOUND',
      message: `${label} file does not exist: ${filePath}`,
    });
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    issues.push({
      severity: 'error',
      code: 'JSON_PARSE_ERROR',
      message: `Failed to parse ${label}: ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    });
    return undefined;
  }
}

function isRelationshipMetadata(value: unknown): value is RelationshipMetadata {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.relationships)) {
    return false;
  }
  if (value.metadataLanguagePolicy !== undefined && typeof value.metadataLanguagePolicy !== 'string') {
    return false;
  }
  return value.relationships.every((entry) => {
    if (!isRecord(entry) || typeof entry.path !== 'string' || typeof entry.kind !== 'string') {
      return false;
    }
    if (entry.reason !== undefined && typeof entry.reason !== 'string') {
      return false;
    }
    return isScopeRuleRefArray(entry.scopeRules)
      && isTargetArray(entry.concepts)
      && isTargetArray(entry.processes);
  });
}

function isScopeRulesMetadata(value: unknown): value is ScopeRulesMetadata {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.scopeRules)) {
    return false;
  }
  return value.scopeRules.every((entry) =>
    isRecord(entry)
      && typeof entry.id === 'string'
      && typeof entry.kind === 'string'
      && typeof entry.statement === 'string'
      && (entry.reviewRisk === undefined || typeof entry.reviewRisk === 'string')
      && isOptionalStringArray(entry.riskProbes)
      && isOptionalStringArray(entry.allowedInstead)
      && isOptionalStringArray(entry.ownedDomains)
      && isOptionalStringArray(entry.externalDomains)
      && (entry.reviewAction === undefined || typeof entry.reviewAction === 'string')
  );
}

function isTestRulesMetadata(value: unknown): value is TestRulesMetadata {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.testPolicies)) {
    return false;
  }
  return value.testPolicies.every((entry) =>
    isRecord(entry)
      && typeof entry.id === 'string'
      && typeof entry.kind === 'string'
      && typeof entry.statement === 'string'
      && isOptionalStringArray(entry.appliesTo)
      && (entry.reviewRisk === undefined || typeof entry.reviewRisk === 'string')
      && isOptionalStringArray(entry.probes)
  );
}

function isScopeRuleRefArray(value: unknown): value is RelationshipScopeRuleRef[] | undefined {
  if (value === undefined) {
    return true;
  }
  return Array.isArray(value) && value.every((entry) =>
    isRecord(entry)
      && typeof entry.id === 'string'
      && (entry.reason === undefined || typeof entry.reason === 'string')
  );
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every((entry) => typeof entry === 'string'));
}

function isTargetArray(value: unknown): value is RelationshipTarget[] | undefined {
  if (value === undefined) {
    return true;
  }
  return Array.isArray(value) && value.every((entry) =>
    isRecord(entry)
      && typeof entry.path === 'string'
      && (entry.reason === undefined || typeof entry.reason === 'string')
  );
}

function isOrderMetadata(value: unknown): value is OrderMetadata {
  return isRecord(value)
    && value.schemaVersion === 1
    && Array.isArray(value.order)
    && value.order.every((entry) => typeof entry === 'string');
}

function isConceptRelationshipMetadata(value: unknown): value is ConceptRelationshipMetadata {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return false;
  }
  if (value.concepts !== undefined && !Array.isArray(value.concepts)) {
    return false;
  }
  if (value.relationships !== undefined && !Array.isArray(value.relationships)) {
    return false;
  }
  if (value.views !== undefined && !Array.isArray(value.views)) {
    return false;
  }
  if (value.glossaryTerms !== undefined && !Array.isArray(value.glossaryTerms)) {
    return false;
  }
  if (value.relatedProcessMaps !== undefined && !Array.isArray(value.relatedProcessMaps)) {
    return false;
  }
  return (value.concepts ?? []).every(isConceptEntry)
    && (value.relationships ?? []).every(isConceptRelationEntry)
    && (value.views ?? []).every(isConceptViewEntry)
    && (value.glossaryTerms ?? []).every(isConceptGlossaryTermEntry)
    && (value.relatedProcessMaps ?? []).every(isConceptRelatedProcessMapEntry);
}

function isDfdRelationshipMetadata(value: unknown): value is DfdRelationshipMetadata {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return false;
  }
  if (value.conceptGroups !== undefined && !Array.isArray(value.conceptGroups)) {
    return false;
  }
  if (value.subsystems !== undefined && !Array.isArray(value.subsystems)) {
    return false;
  }
  if (value.externalStores !== undefined && !Array.isArray(value.externalStores)) {
    return false;
  }
  if (value.derivedViews !== undefined && !Array.isArray(value.derivedViews)) {
    return false;
  }
  if (value.dfds !== undefined && !Array.isArray(value.dfds)) {
    return false;
  }
  return (value.subsystems ?? []).every(isDfdSubsystemEntry)
    && (value.conceptGroups ?? []).every(isDfdConceptGroupEntry)
    && (value.externalStores ?? []).every(isDfdNamedEntry)
    && (value.derivedViews ?? []).every(isDfdNamedEntry)
    && (value.dfds ?? []).every(isDfdEntry);
}

function isDfdSubsystemEntry(value: unknown): value is DfdSubsystemEntry {
  return isRecord(value)
    && isDfdNamedEntry(value)
    && (value.summary === undefined || typeof value.summary === 'string');
}

function isProcessMapMetadata(value: unknown): value is ProcessMapMetadata {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return false;
  }
  if (value.processMaps !== undefined && !Array.isArray(value.processMaps)) {
    return false;
  }
  if (value.externalStores !== undefined && !Array.isArray(value.externalStores)) {
    return false;
  }
  if (value.derivedViews !== undefined && !Array.isArray(value.derivedViews)) {
    return false;
  }
  if (value.views !== undefined && !Array.isArray(value.views)) {
    return false;
  }
  return (value.processMaps ?? []).every(isProcessMapEntry)
    && (value.externalStores ?? []).every(isDfdNamedEntry)
    && (value.derivedViews ?? []).every(isDfdNamedEntry)
    && (value.views ?? []).every(isProcessMapViewEntry);
}

function isProcessMapEntry(value: unknown): value is ProcessMapEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.path === 'string'
    && (value.summary === undefined || typeof value.summary === 'string');
}

function isProcessMapViewEntry(value: unknown): value is ProcessMapViewEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.processMap === 'string'
    && (value.name === undefined || typeof value.name === 'string')
    && (value.purpose === undefined || typeof value.purpose === 'string')
    && (value.concepts === undefined || (Array.isArray(value.concepts) && value.concepts.every((concept) => typeof concept === 'string')))
    && (value.relatedConcepts === undefined || (Array.isArray(value.relatedConcepts) && value.relatedConcepts.every((concept) => typeof concept === 'string')))
    && (value.inputs === undefined || (Array.isArray(value.inputs) && value.inputs.every(isDfdTermRef)))
    && (value.outputs === undefined || (Array.isArray(value.outputs) && value.outputs.every(isDfdTermRef)))
    && (value.uses === undefined || (Array.isArray(value.uses) && value.uses.every(isDfdTermRef)));
}

function isDfdNamedEntry(value: unknown): value is DfdNamedEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.displayName === undefined || typeof value.displayName === 'string');
}

function isDfdConceptGroupEntry(value: unknown): value is DfdConceptGroupEntry {
  return isRecord(value)
    && isDfdNamedEntry(value)
    && (value.scope === undefined || typeof value.scope === 'string')
    && Array.isArray(value.members)
    && value.members.every(isDfdTermRef);
}

function isDfdEntry(value: unknown): value is DfdEntry {
  return isRecord(value)
    && isDfdNamedEntry(value)
    && (value.subsystem === undefined || typeof value.subsystem === 'string')
    && typeof value.path === 'string'
    && (value.summary === undefined || typeof value.summary === 'string')
    && (value.businessOperations === undefined || (
      Array.isArray(value.businessOperations)
      && value.businessOperations.every(isDfdBusinessOperationEntry)
    ));
}

function isDfdBusinessOperationEntry(value: unknown): value is DfdBusinessOperationEntry {
  return isRecord(value)
    && isDfdNamedEntry(value)
    && (value.summary === undefined || typeof value.summary === 'string')
    && (value.relatedProcesses === undefined || (
      Array.isArray(value.relatedProcesses)
      && value.relatedProcesses.every(isDfdRelatedProcessEntry)
    ))
    && (value.inputs === undefined || (Array.isArray(value.inputs) && value.inputs.every(isDfdTermRef)))
    && (value.outputs === undefined || (Array.isArray(value.outputs) && value.outputs.every(isDfdTermRef)))
    && (value.uses === undefined || (Array.isArray(value.uses) && value.uses.every(isDfdTermRef)));
}

function isDfdRelatedProcessEntry(value: unknown): value is DfdRelatedProcessEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.path === 'string'
    && (value.reason === undefined || typeof value.reason === 'string');
}

function isDfdTermRef(value: unknown): value is DfdTermRef {
  return isRecord(value)
    && typeof value.type === 'string'
    && typeof value.id === 'string';
}

function isConceptEntry(value: unknown): value is ConceptEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.displayName === undefined || typeof value.displayName === 'string')
    && (value.path === undefined || value.path === null || typeof value.path === 'string')
    && (value.draftPath === undefined || value.draftPath === null || typeof value.draftPath === 'string')
    && (value.status === undefined || typeof value.status === 'string')
    && (value.summary === undefined || typeof value.summary === 'string')
    && (value.note === undefined || typeof value.note === 'string');
}

function isConceptRelationEntry(value: unknown): value is ConceptRelationEntry {
  return isRecord(value)
    && typeof value.from === 'string'
    && typeof value.to === 'string'
    && (value.kind === undefined || typeof value.kind === 'string')
    && (value.certainty === undefined || typeof value.certainty === 'string')
    && (value.reason === undefined || typeof value.reason === 'string');
}

function isConceptViewEntry(value: unknown): value is ConceptViewEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.concepts === undefined || (
      Array.isArray(value.concepts)
      && value.concepts.every((entry) => typeof entry === 'string')
    ));
}

function isConceptGlossaryTermEntry(value: unknown): value is ConceptGlossaryTermEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.displayTerm === 'string'
    && (value.definedIn === undefined || (
      Array.isArray(value.definedIn)
      && value.definedIn.every((entry) => typeof entry === 'string')
    ))
    && (value.meaning === undefined || typeof value.meaning === 'string')
    && (value.note === undefined || typeof value.note === 'string');
}

function isConceptRelatedProcessMapEntry(value: unknown): value is ConceptRelatedProcessMapEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.displayName === undefined || typeof value.displayName === 'string')
    && typeof value.path === 'string'
    && (value.reason === undefined || typeof value.reason === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function printCheckResult(result: CheckDocsResult): void {
  console.log(`DDL docs metadata check: ${result.errors.length} error(s), ${result.warnings.length} warning(s).`);
  for (const issue of [...result.errors, ...result.warnings]) {
    console.log(`[${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message}`);
  }
}
