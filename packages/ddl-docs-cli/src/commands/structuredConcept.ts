import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConceptRegistry } from '../relationshipMetadata';
import type { StructuredConceptOptions } from '../types';
import { formatTableCell } from '../utils/markdown';
import { slugifyIdentifier } from '../utils/slug';

const REQUIRED_SECTIONS = ['definition', 'goals', 'nonResponsibilities', 'invariants', 'openIssues'] as const;
const OPTIONAL_SECTIONS = ['rationale'] as const;
const SECTION_NAMES = new Set<string>([...REQUIRED_SECTIONS, ...OPTIONAL_SECTIONS]);
const COVERAGES = new Set(['unreviewed', 'none', 'partial', 'complete']);
const STATEMENT_TYPES = new Set(['essence', 'responsibility', 'boundary', 'invariant', 'rationale']);
const LIFECYCLE_STATUSES = new Set(['draft', 'defined', 'deprecated']);
const RELATIONSHIP_KINDS = new Set([
  'uses',
  'targets',
  'consumes',
  'depends-on',
  'supports',
  'records',
  'produces',
  'is-distinct-from',
  'variant-of',
  'must-not-redefine',
]);
const INTERNAL_LINK_KINDS = new Set([
  'explains',
  'supports',
  'bounds',
  'requires',
  'excludes',
  'derives',
  'constrains',
]);

type RequiredSection = typeof REQUIRED_SECTIONS[number];
type OptionalSection = typeof OPTIONAL_SECTIONS[number];
type SectionName = RequiredSection | OptionalSection;
type Severity = 'error' | 'warning';

interface ValidationIssue {
  severity: Severity;
  conceptId?: string;
  path: string;
  message: string;
}

interface StructuredConceptLoadResult {
  concepts: StructuredConcept[];
  knownConceptIds: Set<string>;
  issues: ValidationIssue[];
  conceptDisplayNameById: Map<string, string>;
  pageSlugByConceptId?: Map<string, string>;
}

interface StructuredConceptBase {
  schemaVersion: 1 | 2;
  id: string;
  displayName: string;
  lifecycle: {
    status: string;
    sourceDraft?: string;
  };
  sourcePath: string;
  baseDir: string;
}

interface StructuredConceptV1 extends StructuredConceptBase {
  schemaVersion: 1;
  summary: string;
  sources: Array<{
    id: string;
    type: string;
    path: string;
  }>;
  sections: Record<string, StructuredConceptSection>;
  links?: Array<{
    from: string;
    to: string;
    kind: string;
    reason: string;
    sources: string[];
  }>;
  relationships: Array<{
    to: string;
    kind: string;
    reason: string;
    sources: string[];
  }>;
}

interface StructuredConceptV2 extends StructuredConceptBase {
  schemaVersion: 2;
  definition: {
    summary: string;
    statements: StructuredConceptStatement[];
  };
  evidence: Array<{
    id: string;
    type: string;
    path: string;
  }>;
  internalLinks?: Array<StructuredConceptInternalLink>;
  externalRelationships?: Array<{
    to: string;
    kind: string;
    reason: string;
    supportedBy?: string[];
    evidence: string[];
  }>;
  reviewState?: {
    coverage?: Record<string, {
      status: string;
      reason?: string;
      resolutionCriteria?: Array<{
        id: string;
        text: string;
        evidence?: string[];
      }>;
    }>;
    openIssues?: Array<{
      id: string;
      question: string;
      status: string;
      evidence: string[];
    }>;
  };
}

type StructuredConcept = StructuredConceptV1 | StructuredConceptV2;

interface StructuredConceptStatement {
  id: string;
  displayName?: string;
  polarity: 'positive' | 'negative';
  type: string;
  text: string;
  negatesSimilarityWith?: string[];
  evidence: string[];
}

interface StructuredConceptInternalLink {
  from: string;
  to: string;
  kind: string;
  reason: string;
  evidence: string[];
}

interface StructuredConceptSection {
  coverage: string;
  reason?: string;
  resolutionCriteria?: Array<{
    id: string;
    text: string;
    sources?: string[];
  }>;
  items: Array<{
    id: string;
    displayName?: string;
    text?: string;
    question?: string;
    status?: string;
    sources: string[];
  }>;
}

export function runStructuredConceptCheck(options: StructuredConceptOptions): void {
  const result = loadAndValidateStructuredConcepts(options);
  console.log(JSON.stringify({
    schemaVersion: 1,
    concepts: result.concepts.length,
    errors: result.issues.filter((issue) => issue.severity === 'error').length,
    warnings: result.issues.filter((issue) => issue.severity === 'warning').length,
    issues: result.issues,
  }, null, 2));
  if (result.issues.some((issue) => issue.severity === 'error')) {
    throw new Error('structured concept check failed.');
  }
}

export function runStructuredConceptBuild(options: StructuredConceptOptions): void {
  const result = loadAndValidateStructuredConcepts(options);
  if (result.issues.some((issue) => issue.severity === 'error')) {
    console.log(JSON.stringify({ schemaVersion: 1, issues: result.issues }, null, 2));
    throw new Error('structured concept build failed because validation produced error(s).');
  }
  if (!options.outDir) {
    throw new Error('structured-concept build requires --out-dir.');
  }
  const outDir = path.resolve(process.cwd(), options.outDir);
  assertGeneratedOutputOutsideConceptSources(outDir, options.conceptDirectories);
  ensureDirectory(outDir);
  const pageSlugByConceptId = buildPageSlugMap(result.concepts, outDir);
  result.pageSlugByConceptId = pageSlugByConceptId;
  for (const concept of result.concepts) {
    writeText(path.join(outDir, `${pageSlugByConceptId.get(concept.id) ?? slugifyIdentifier(concept.id)}.md`), renderConceptPage(concept, result));
  }
  writeConceptIndex(path.join(outDir, 'index.md'), result, pageSlugByConceptId);
  if (options.relationshipOutPath) {
    const outPath = path.resolve(process.cwd(), options.relationshipOutPath);
    assertGeneratedOutputOutsideConceptSources(outPath, options.conceptDirectories);
    writeJson(outPath, buildRelationshipIndex(result));
  }
  if (options.reverseRelationshipOutPath) {
    const outPath = path.resolve(process.cwd(), options.reverseRelationshipOutPath);
    assertGeneratedOutputOutsideConceptSources(outPath, options.conceptDirectories);
    writeJson(outPath, buildReverseRelationshipIndex(result));
  }
  if (options.aiContextOutPath) {
    const outPath = path.resolve(process.cwd(), options.aiContextOutPath);
    assertGeneratedOutputOutsideConceptSources(outPath, options.conceptDirectories);
    writeJson(outPath, buildAiContext(result));
  }
  if (options.reviewSummaryOutPath) {
    const outPath = path.resolve(process.cwd(), options.reviewSummaryOutPath);
    assertGeneratedOutputOutsideConceptSources(outPath, options.conceptDirectories);
    writeJson(outPath, buildReviewSummary(result));
  }
  console.log(JSON.stringify({
    schemaVersion: 1,
    concepts: result.concepts.map((concept) => concept.id),
    errors: 0,
    warnings: result.issues.filter((issue) => issue.severity === 'warning').length,
  }, null, 2));
}

function loadAndValidateStructuredConcepts(options: StructuredConceptOptions): StructuredConceptLoadResult {
  const conceptPaths = collectConceptJsonPaths(options.conceptDirectories);
  const concepts = conceptPaths.map(loadConceptJson);
  const registry = loadConceptRegistry(options.conceptRelationshipPath);
  const conceptDisplayNameById = new Map<string, string>(
    (registry?.concepts ?? []).map((concept) => [concept.id, concept.displayName ?? concept.id])
  );
  for (const concept of concepts) {
    conceptDisplayNameById.set(concept.id, concept.displayName);
  }
  const knownConceptIds = new Set<string>([
    ...concepts.map((concept) => concept.id),
    ...(registry?.concepts.map((concept) => concept.id) ?? []),
  ]);
  const structuredConceptIds = new Set(concepts.map((concept) => concept.id));
  const issues = [
    ...buildMissingStructuredConceptIssues(registry?.concepts ?? [], structuredConceptIds),
    ...concepts.flatMap((concept) => validateConcept(concept, knownConceptIds)),
  ];
  return { concepts: concepts.sort((left, right) => left.id.localeCompare(right.id)), knownConceptIds, issues, conceptDisplayNameById };
}

function buildMissingStructuredConceptIssues(
  registryConcepts: Array<{ id: string; path?: string | null; draftPath?: string | null }>,
  structuredConceptIds: Set<string>
): ValidationIssue[] {
  return registryConcepts
    .filter((concept) => (concept.path || concept.draftPath) && !structuredConceptIds.has(concept.id))
    .map((concept) => ({
      severity: 'error',
      conceptId: concept.id,
      path: `concepts.${concept.id}`,
      message: `Concept "${concept.id}" is registered but has no concept.json. Ask AI to migrate this Concept into packages/transfer/docs/concepts/${concept.id}/concept.json before generating the structured review page.`,
    }));
}

function collectConceptJsonPaths(conceptDirectories: string[]): string[] {
  const roots = conceptDirectories.length > 0 ? conceptDirectories : ['packages/transfer/docs/concepts'];
  const result: string[] = [];
  for (const root of roots) {
    collectConceptJsonPathsRecursive(path.resolve(process.cwd(), root), result);
  }
  return Array.from(new Set(result)).sort();
}

function assertGeneratedOutputOutsideConceptSources(outputPath: string, conceptDirectories: string[]): void {
  const resolvedOutput = path.resolve(outputPath);
  for (const conceptDir of conceptDirectories) {
    const resolvedConceptDir = path.resolve(process.cwd(), conceptDir);
    const relative = path.relative(resolvedConceptDir, resolvedOutput);
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
      throw new Error(`structured-concept generated output must not be written inside concept source directory: ${resolvedOutput}`);
    }
  }
}

function buildPageSlugMap(concepts: StructuredConcept[], _outDir: string): Map<string, string> {
  return new Map(concepts.map((concept) => [concept.id, slugifyIdentifier(concept.id)]));
}

function collectConceptJsonPathsRecursive(root: string, result: string[]): void {
  if (!existsSync(root)) {
    return;
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      collectConceptJsonPathsRecursive(entryPath, result);
      continue;
    }
    if (entry.isFile() && entry.name === 'concept.json') {
      result.push(entryPath);
    }
  }
}

function loadConceptJson(sourcePath: string): StructuredConcept {
  const parsed = JSON.parse(readFileSync(sourcePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`Structured concept must be a JSON object: ${sourcePath}`);
  }
  return {
    ...(parsed as Omit<StructuredConcept, 'sourcePath' | 'baseDir'>),
    sourcePath,
    baseDir: path.dirname(sourcePath),
  } as StructuredConcept;
}

function validateConcept(concept: StructuredConcept, knownConceptIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (severity: Severity, pathName: string, message: string) => {
    issues.push({ severity, conceptId: concept.id, path: pathName, message });
  };
  if (concept.schemaVersion !== 1 && concept.schemaVersion !== 2) {
    push('error', 'schemaVersion', 'schemaVersion must be 1 or 2.');
  }
  if (!concept.id || concept.id !== path.basename(concept.baseDir)) {
    push('error', 'id', 'id must be non-empty and match the concept directory name.');
  }
  if (!concept.displayName?.trim()) {
    push('error', 'displayName', 'displayName must be non-empty.');
  }
  if (!LIFECYCLE_STATUSES.has(concept.lifecycle?.status)) {
    push('error', 'lifecycle.status', 'lifecycle.status must be draft, defined, or deprecated.');
  }
  if (concept.schemaVersion === 2) {
    validateConceptV2(concept, knownConceptIds, push);
    return issues;
  }
  validateConceptV1(concept, knownConceptIds, push);
  return issues;
}

function validateConceptV1(
  concept: StructuredConceptV1,
  knownConceptIds: Set<string>,
  push: (severity: Severity, pathName: string, message: string) => void
): void {
  if (!concept.summary?.trim()) {
    push('error', 'summary', 'summary must be non-empty.');
  }
  for (const sectionName of Object.keys(concept.sections ?? {})) {
    if (!SECTION_NAMES.has(sectionName)) {
      push('error', `sections.${sectionName}`, `section is not allowed. Definition Statements must use canonical sections only: ${Array.from(SECTION_NAMES).join(', ')}.`);
    }
  }
  const sourceIds = new Set<string>();
  for (const [index, source] of (concept.sources ?? []).entries()) {
    if (!source.id?.trim()) {
      push('error', `sources.${index}.id`, 'source id must be non-empty.');
    }
    if (sourceIds.has(source.id)) {
      push('error', `sources.${index}.id`, `source id is duplicated: ${source.id}`);
    }
    sourceIds.add(source.id);
    if (!source.path?.trim() || !existsSync(path.resolve(concept.baseDir, source.path))) {
      push('error', `sources.${index}.path`, `source path does not exist: ${source.path}`);
    }
  }
  for (const sectionName of REQUIRED_SECTIONS) {
    const section = concept.sections?.[sectionName];
    validateSection(concept, sectionName, section, sourceIds, push);
  }
  for (const sectionName of OPTIONAL_SECTIONS) {
    const section = concept.sections?.[sectionName];
    if (section) {
      validateSection(concept, sectionName, section, sourceIds, push);
    }
  }
  validateInternalLinks(concept, sourceIds, push);
  for (const [index, relationship] of (concept.relationships ?? []).entries()) {
    if (!knownConceptIds.has(relationship.to)) {
      push('error', `relationships.${index}.to`, `relationship target concept does not exist: ${relationship.to}`);
    }
    if (!RELATIONSHIP_KINDS.has(relationship.kind)) {
      push('error', `relationships.${index}.kind`, `relationship kind is not allowed: ${relationship.kind}`);
    }
    if (!relationship.reason?.trim()) {
      push('error', `relationships.${index}.reason`, 'relationship reason must be non-empty.');
    }
    validateSourceRefs(`relationships.${index}.sources`, relationship.sources, sourceIds, push);
  }
}

function validateConceptV2(
  concept: StructuredConceptV2,
  knownConceptIds: Set<string>,
  push: (severity: Severity, pathName: string, message: string) => void
): void {
  if (!concept.definition?.summary?.trim()) {
    push('error', 'definition.summary', 'definition summary must be non-empty.');
  }
  if (!Array.isArray(concept.definition?.statements) || concept.definition.statements.length === 0) {
    push('error', 'definition.statements', 'definition statements must contain at least one statement.');
  }
  const evidenceIds = new Set<string>();
  for (const [index, evidence] of (concept.evidence ?? []).entries()) {
    if (!evidence.id?.trim()) {
      push('error', `evidence.${index}.id`, 'evidence id must be non-empty.');
    }
    if (evidenceIds.has(evidence.id)) {
      push('error', `evidence.${index}.id`, `evidence id is duplicated: ${evidence.id}`);
    }
    evidenceIds.add(evidence.id);
    if (!evidence.path?.trim() || !existsSync(path.resolve(concept.baseDir, evidence.path))) {
      push('error', `evidence.${index}.path`, `evidence path does not exist: ${evidence.path}`);
    }
  }
  const statementIds = new Set<string>();
  for (const [index, statement] of (concept.definition?.statements ?? []).entries()) {
    const statementPath = `definition.statements.${index}`;
    if (!statement.id?.trim()) {
      push('error', `${statementPath}.id`, 'statement id must be non-empty.');
    }
    if (statementIds.has(statement.id)) {
      push('error', `${statementPath}.id`, `statement id is duplicated: ${statement.id}`);
    }
    statementIds.add(statement.id);
    if (statement.displayName !== undefined && !statement.displayName.trim()) {
      push('error', `${statementPath}.displayName`, 'statement displayName must be non-empty when present.');
    }
    if (statement.polarity !== 'positive' && statement.polarity !== 'negative') {
      push('error', `${statementPath}.polarity`, 'statement polarity must be positive or negative.');
    }
    if (!statement.type?.trim()) {
      push('error', `${statementPath}.type`, 'statement type must be non-empty.');
    } else if (!STATEMENT_TYPES.has(statement.type)) {
      push('error', `${statementPath}.type`, `statement type is not allowed. Definition Statements must use canonical types only: ${Array.from(STATEMENT_TYPES).join(', ')}.`);
    }
    if (!statement.text?.trim()) {
      push('error', `${statementPath}.text`, 'statement text must be non-empty.');
    }
    validateEvidenceRefs(`${statementPath}.evidence`, statement.evidence, evidenceIds, push);
  }
  validateV2Links(concept, statementIds, evidenceIds, push);
  validateV2ExternalRelationships(concept, knownConceptIds, statementIds, evidenceIds, push);
  for (const [key, coverage] of Object.entries(concept.reviewState?.coverage ?? {})) {
    if (!COVERAGES.has(coverage.status)) {
      push('error', `reviewState.coverage.${key}.status`, `coverage status is not allowed: ${coverage.status}`);
    }
    if (coverage.status === 'partial') {
      if (!coverage.reason?.trim()) {
        push('error', `reviewState.coverage.${key}.reason`, 'coverage partial requires reason.');
      }
      if (!Array.isArray(coverage.resolutionCriteria) || coverage.resolutionCriteria.length === 0) {
        push('error', `reviewState.coverage.${key}.resolutionCriteria`, 'coverage partial requires resolution criteria.');
      }
    }
  }
  for (const [index, issue] of (concept.reviewState?.openIssues ?? []).entries()) {
    if (!issue.id?.trim()) {
      push('error', `reviewState.openIssues.${index}.id`, 'open issue id must be non-empty.');
    }
    if (!issue.question?.trim()) {
      push('error', `reviewState.openIssues.${index}.question`, 'open issue question must be non-empty.');
    }
    validateEvidenceRefs(`reviewState.openIssues.${index}.evidence`, issue.evidence, evidenceIds, push);
  }
}

function validateV2Links(
  concept: StructuredConceptV2,
  statementIds: Set<string>,
  evidenceIds: Set<string>,
  push: (severity: Severity, pathName: string, message: string) => void
): void {
  if (concept.internalLinks !== undefined && !Array.isArray(concept.internalLinks)) {
    push('error', 'internalLinks', 'internalLinks must be an array when present.');
    return;
  }
  for (const [index, link] of (concept.internalLinks ?? []).entries()) {
    const linkPath = `internalLinks.${index}`;
    if (!statementIds.has(link.from)) {
      push('error', `${linkPath}.from`, `link source statement does not exist: ${link.from}`);
    }
    if (!statementIds.has(link.to)) {
      push('error', `${linkPath}.to`, `link target statement does not exist: ${link.to}`);
    }
    if (!INTERNAL_LINK_KINDS.has(link.kind)) {
      push('error', `${linkPath}.kind`, `link kind is not allowed: ${link.kind}`);
    }
    if (!link.reason?.trim()) {
      push('error', `${linkPath}.reason`, 'link reason must be non-empty.');
    }
    validateEvidenceRefs(`${linkPath}.evidence`, link.evidence, evidenceIds, push);
  }
}

function validateV2ExternalRelationships(
  concept: StructuredConceptV2,
  knownConceptIds: Set<string>,
  statementIds: Set<string>,
  evidenceIds: Set<string>,
  push: (severity: Severity, pathName: string, message: string) => void
): void {
  for (const [index, relationship] of (concept.externalRelationships ?? []).entries()) {
    const relationshipPath = `externalRelationships.${index}`;
    if (!knownConceptIds.has(relationship.to)) {
      push('error', `${relationshipPath}.to`, `relationship target concept does not exist: ${relationship.to}`);
    }
    if (!RELATIONSHIP_KINDS.has(relationship.kind)) {
      push('error', `${relationshipPath}.kind`, `relationship kind is not allowed: ${relationship.kind}`);
    }
    if (!relationship.reason?.trim()) {
      push('error', `${relationshipPath}.reason`, 'relationship reason must be non-empty.');
    }
    validateEvidenceRefs(`${relationshipPath}.evidence`, relationship.evidence, evidenceIds, push);
    for (const ref of relationship.supportedBy ?? []) {
      if (!statementIds.has(ref)) {
        push('error', `${relationshipPath}.supportedBy`, `supporting statement does not exist: ${ref}`);
      }
    }
  }
}

function validateEvidenceRefs(
  pathName: string,
  refs: string[] | undefined,
  evidenceIds: Set<string>,
  push: (severity: Severity, pathName: string, message: string) => void
): void {
  if (!Array.isArray(refs) || refs.length === 0) {
    push('error', pathName, 'evidence must contain at least one evidence id.');
    return;
  }
  for (const ref of refs) {
    if (!evidenceIds.has(ref)) {
      push('error', pathName, `evidence ref does not exist: ${ref}`);
    }
  }
}

function validateSection(
  concept: StructuredConcept,
  sectionName: SectionName,
  section: StructuredConceptSection | undefined,
  sourceIds: Set<string>,
  push: (severity: Severity, pathName: string, message: string) => void
): void {
  if (!section) {
    push('error', `sections.${sectionName}`, 'required section is missing.');
    return;
  }
  if (!COVERAGES.has(section.coverage)) {
    push('error', `sections.${sectionName}.coverage`, `coverage is not allowed: ${section.coverage}`);
  }
  if (!Array.isArray(section.items)) {
    push('error', `sections.${sectionName}.items`, 'items must be an array.');
    return;
  }
  if (section.coverage === 'none' && section.items.length === 0 && !section.reason?.trim()) {
    push('error', `sections.${sectionName}.reason`, 'coverage none with empty items requires reason.');
  }
  if (section.coverage === 'partial') {
    if (!section.reason?.trim()) {
      push('error', `sections.${sectionName}.reason`, 'coverage partial requires reason.');
    }
    if (!Array.isArray(section.resolutionCriteria) || section.resolutionCriteria.length === 0) {
      push('error', `sections.${sectionName}.resolutionCriteria`, 'coverage partial requires resolution criteria.');
    }
  }
  if (section.coverage === 'complete' && section.items.length === 0) {
    push('warning', `sections.${sectionName}.items`, 'coverage complete with empty items is suspicious.');
  }
  if (concept.lifecycle.status === 'defined' && section.coverage === 'unreviewed') {
    push('error', `sections.${sectionName}.coverage`, 'defined concepts must not keep unreviewed sections.');
  }
  const itemIds = new Set<string>();
  for (const [index, item] of section.items.entries()) {
    const itemPath = `sections.${sectionName}.items.${index}`;
    if (!item.id?.trim()) {
      push('error', `${itemPath}.id`, 'item id must be non-empty.');
    }
    if (item.displayName !== undefined && !item.displayName.trim()) {
      push('error', `${itemPath}.displayName`, 'item displayName must be non-empty when present.');
    }
    if (itemIds.has(item.id)) {
      push('error', `${itemPath}.id`, `item id is duplicated in section: ${item.id}`);
    }
    itemIds.add(item.id);
    if (sectionName === 'openIssues') {
      if (!item.question?.trim()) {
        push('error', `${itemPath}.question`, 'open issue item requires question.');
      }
    } else if (!item.text?.trim()) {
      push('error', `${itemPath}.text`, 'section item requires text.');
    }
    validateSourceRefs(`${itemPath}.sources`, item.sources, sourceIds, push);
  }
  for (const [index, criterion] of (section.resolutionCriteria ?? []).entries()) {
    const criterionPath = `sections.${sectionName}.resolutionCriteria.${index}`;
    if (!criterion.id?.trim()) {
      push('error', `${criterionPath}.id`, 'resolution criterion id must be non-empty.');
    }
    if (!criterion.text?.trim()) {
      push('error', `${criterionPath}.text`, 'resolution criterion text must be non-empty.');
    }
    if (criterion.sources !== undefined) {
      validateSourceRefs(`${criterionPath}.sources`, criterion.sources, sourceIds, push);
    }
  }
}

function validateInternalLinks(
  concept: StructuredConceptV1,
  sourceIds: Set<string>,
  push: (severity: Severity, pathName: string, message: string) => void
): void {
  if (concept.links !== undefined && !Array.isArray(concept.links)) {
    push('error', 'links', 'links must be an array when present.');
    return;
  }
  const itemRefs = collectSectionItemRefs(concept);
  for (const [index, link] of (concept.links ?? []).entries()) {
    const linkPath = `links.${index}`;
    if (!itemRefs.has(link.from)) {
      push('error', `${linkPath}.from`, `link source section item does not exist: ${link.from}`);
    }
    if (!itemRefs.has(link.to)) {
      push('error', `${linkPath}.to`, `link target section item does not exist: ${link.to}`);
    }
    if (!INTERNAL_LINK_KINDS.has(link.kind)) {
      push('error', `${linkPath}.kind`, `link kind is not allowed: ${link.kind}`);
    }
    if (!link.reason?.trim()) {
      push('error', `${linkPath}.reason`, 'link reason must be non-empty.');
    }
    validateSourceRefs(`${linkPath}.sources`, link.sources, sourceIds, push);
  }
}

function collectSectionItemRefs(concept: StructuredConceptV1): Set<string> {
  const refs = new Set<string>();
  for (const sectionName of sectionNames(concept)) {
    for (const item of concept.sections[sectionName].items) {
      refs.add(`${sectionName}.${item.id}`);
    }
  }
  return refs;
}

function sectionNames(concept: StructuredConceptV1): SectionName[] {
  return [
    ...REQUIRED_SECTIONS,
    ...OPTIONAL_SECTIONS.filter((sectionName) => concept.sections[sectionName]),
  ];
}

function validateSourceRefs(
  pathName: string,
  refs: string[] | undefined,
  sourceIds: Set<string>,
  push: (severity: Severity, pathName: string, message: string) => void
): void {
  if (!Array.isArray(refs) || refs.length === 0) {
    push('error', pathName, 'sources must contain at least one source id.');
    return;
  }
  for (const ref of refs) {
    if (!sourceIds.has(ref)) {
      push('error', pathName, `source ref does not exist: ${ref}`);
    }
  }
}

function renderConceptPage(concept: StructuredConcept, result: StructuredConceptLoadResult): string {
  if (concept.schemaVersion === 2) {
    return renderConceptPageV2(concept, result);
  }
  return renderConceptPageV1(concept, result);
}

function renderConceptPageV1(concept: StructuredConceptV1, result: StructuredConceptLoadResult): string {
  const conceptIssues = result.issues.filter((issue) => issue.conceptId === concept.id);
  const openIssues = concept.sections.openIssues.items;
  const lines = [
    '<!-- generated-by: @rawsql-ts/ddl-docs-cli structured-concept -->',
    '',
    `# ${concept.displayName}`,
    '',
    concept.summary,
    '',
    '## Review Summary',
    '',
    `- Schema version: \`${concept.schemaVersion}\``,
    `- Concept ID: \`${concept.id}\``,
    `- Lifecycle: \`${concept.lifecycle.status}\``,
    `- Open questions: ${openIssues.length > 0 ? 'present' : 'none'}`,
    '',
  ];
  appendV1OpenQuestions(lines, concept);
  appendDefinitionStatementsV1(lines, concept);
  appendInternalLinks(lines, concept);
  appendRelationships(lines, concept, result.conceptDisplayNameById, result.pageSlugByConceptId);
  appendV1Coverage(lines, concept);
  appendSources(lines, concept);
  appendValidation(lines, conceptIssues);
  appendTechnicalMetadata(lines, concept);
  return `${lines.join('\n')}\n`;
}

function renderConceptPageV2(concept: StructuredConceptV2, result: StructuredConceptLoadResult): string {
  const conceptIssues = result.issues.filter((issue) => issue.conceptId === concept.id);
  const lines = [
    '<!-- generated-by: @rawsql-ts/ddl-docs-cli structured-concept -->',
    '',
    '[<- Concepts](./)',
    '',
    `# ${concept.displayName}`,
    '',
  ];
  lines.push(`<div class="concept-definition-summary">${escapeHtml(concept.definition.summary)}</div>`);
  lines.push('');
  appendV2ReviewSummary(lines, concept, conceptIssues, result.conceptDisplayNameById, result.pageSlugByConceptId);
  appendV2OpenQuestions(lines, concept);
  appendDefinitionStatementsV2(lines, concept);
  appendV2InternalLinks(lines, concept);
  appendV2ExternalRelationships(lines, concept, result.conceptDisplayNameById);
  appendV2Coverage(lines, concept);
  appendV2Evidence(lines, concept);
  appendValidation(lines, conceptIssues);
  appendTechnicalMetadata(lines, concept);
  return `${lines.join('\n')}\n`;
}

function appendV2ReviewSummary(
  lines: string[],
  concept: StructuredConceptV2,
  conceptIssues: ValidationIssue[],
  conceptDisplayNameById: Map<string, string>,
  pageSlugByConceptId: Map<string, string> | undefined
): void {
  const openIssues = concept.reviewState?.openIssues ?? [];
  const relationships = concept.externalRelationships ?? [];
  const linkedConcepts = distinctRelationshipTargets(relationships);
  const coverage = summarizeV2Coverage(concept);
  const statementTypeCounts = countStatementTypes(concept.definition.statements);
  lines.push('<div class="concept-review-summary dense">');
  lines.push('  <div class="concept-summary-top">');
  lines.push('    <div class="concept-header-meta">');
  lines.push(`      <span>id <code>${escapeHtml(concept.id)}</code></span>`);
  lines.push(`      <span>format schema <code>v${concept.schemaVersion}</code></span>`);
  lines.push('    </div>');
  lines.push(`    ${formatConceptStatus(concept.lifecycle.status, lifecycleTone(concept.lifecycle.status))}`);
  lines.push('  </div>');
  lines.push('  <div class="concept-primary-statuses">');
  lines.push(`    ${formatConceptStatus(`validation: ${conceptIssues.length > 0 ? `${conceptIssues.length} issue(s)` : 'ok'}`, conceptIssues.length > 0 ? 'danger' : 'ok')}`);
  lines.push(`    ${formatConceptStatus(`coverage: ${coverage.label}`, coverage.tone)}`);
  lines.push(`    ${formatConceptStatus(`open questions ${openIssues.length > 0 ? openIssues.length : 'none'}`, openIssues.length > 0 ? 'warn' : 'ok')}`);
  lines.push('  </div>');
  lines.push('  <div class="concept-summary-row concept-checks">');
  lines.push(`    ${formatPresenceStatus('meaning', statementTypeCounts.essence > 0)}`);
  lines.push(`    ${formatPresenceStatus('responsibilities', statementTypeCounts.responsibility > 0)}`);
  lines.push(`    ${formatPresenceStatus('boundaries', statementTypeCounts.boundary > 0)}`);
  lines.push(`    ${formatPresenceStatus('invariants', statementTypeCounts.invariant > 0)}`);
  lines.push(`    ${formatOptionalPresenceStatus('rationale', statementTypeCounts.rationale > 0)}`);
  lines.push(`    ${formatPresenceStatus('evidence', concept.evidence.length > 0)}`);
  lines.push(`    ${formatOptionalPresenceStatus('linked concepts', linkedConcepts.length > 0)}`);
  lines.push('  </div>');
  if (linkedConcepts.length > 0) {
    lines.push('  <div class="concept-related-concepts">');
    for (const conceptId of linkedConcepts) {
      lines.push(`    ${formatConceptSummaryLink(conceptId, conceptDisplayNameById, pageSlugByConceptId)}`);
    }
    lines.push('  </div>');
  }
  lines.push('</div>');
  lines.push('');
}

function formatConceptStatus(label: string, tone: 'ok' | 'warn' | 'danger' | 'neutral'): string {
  return `<span class="concept-status ${tone}">${escapeHtml(label)}</span>`;
}

function lifecycleTone(status: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'defined') {
    return 'ok';
  }
  if (status === 'draft') {
    return 'warn';
  }
  if (status === 'deprecated') {
    return 'neutral';
  }
  return 'danger';
}

function formatPresenceStatus(label: string, present: boolean): string {
  return formatConceptStatus(`${label}: ${present ? 'present' : 'missing'}`, present ? 'ok' : 'warn');
}

function formatOptionalPresenceStatus(label: string, present: boolean): string {
  return formatConceptStatus(`${label}: ${present ? 'present' : 'not set'}`, present ? 'ok' : 'neutral');
}

function countStatementTypes(statements: StructuredConceptStatement[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const statement of statements) {
    counts[statement.type] = (counts[statement.type] ?? 0) + 1;
  }
  return counts;
}

function summarizeV2Coverage(concept: StructuredConceptV2): { label: string; tone: 'ok' | 'warn' | 'danger' } {
  const statuses = Object.values(concept.reviewState?.coverage ?? {}).map((coverage) => coverage.status);
  if (statuses.length === 0) {
    return { label: 'none', tone: 'warn' };
  }
  if (statuses.includes('unreviewed')) {
    return { label: 'unreviewed', tone: 'danger' };
  }
  if (statuses.includes('partial')) {
    return { label: 'partial', tone: 'warn' };
  }
  return { label: 'complete', tone: 'ok' };
}

function summarizeConceptCoverage(concept: StructuredConcept): string {
  if (concept.schemaVersion === 2) {
    return summarizeV2Coverage(concept).label;
  }

  const statuses = sectionNames(concept).map((sectionName) => concept.sections[sectionName].coverage);
  if (statuses.includes('unreviewed')) {
    return 'unreviewed';
  }
  if (statuses.includes('partial')) {
    return 'partial';
  }
  return 'complete';
}

function distinctRelationshipTargets(relationships: Array<{ to: string }>): string[] {
  return [...new Set(relationships.map((relationship) => relationship.to))];
}

function appendDefinitionStatementsV2(lines: string[], concept: StructuredConceptV2): void {
  const statements = concept.definition.statements;
  lines.push('## Definition Statements');
  lines.push('');
  appendStatementGroup(lines, 'Meaning', statements.filter((statement) => statement.type === 'essence'));
  appendStatementGroup(lines, 'Responsibilities', statements.filter((statement) => statement.type === 'responsibility'));
  appendStatementGroup(lines, 'Boundaries', statements.filter((statement) => statement.type === 'boundary'), true);
  appendStatementGroup(lines, 'Invariants', statements.filter((statement) => statement.type === 'invariant'));
  appendStatementGroup(lines, 'Rationale', statements.filter((statement) => statement.type === 'rationale'));
}

function appendStatementGroup(lines: string[], title: string, statements: StructuredConceptStatement[], showSimilarity = false): void {
  if (statements.length === 0) {
    return;
  }
  lines.push(`### ${title}`);
  lines.push('');
  lines.push(`<p class="concept-section-count">${statements.length} statements</p>`);
  lines.push('');
  lines.push('<table class="concept-statement-table">');
  if (showSimilarity) {
    lines.push('<thead><tr><th>Statement</th><th>Text</th><th>Similarity negated</th></tr></thead>');
    lines.push('<tbody>');
    for (const statement of statements) {
      lines.push(`<tr><td>${formatStatementName(statement)}</td><td>${escapeHtml(statement.text)}</td><td>${formatStatementSimilarity(statement)}</td></tr>`);
    }
  } else {
    lines.push('<thead><tr><th>Statement</th><th>Text</th></tr></thead>');
    lines.push('<tbody>');
    for (const statement of statements) {
      lines.push(`<tr><td>${formatStatementName(statement)}</td><td>${escapeHtml(statement.text)}</td></tr>`);
    }
  }
  lines.push('</tbody>');
  lines.push('</table>');
  lines.push('');
}

function formatStatementName(statement: StructuredConceptStatement): string {
  return statement.displayName
    ? `${escapeHtml(statement.displayName)}<br><small><code>${escapeHtml(statement.id)}</code></small>`
    : `<code>${escapeHtml(statement.id)}</code>`;
}

function formatStatementRef(id: string, statementById: Map<string, StructuredConceptStatement>): string {
  const statement = statementById.get(id);
  if (!statement) {
    return `<code>${escapeHtml(id)}</code>`;
  }
  return formatStatementName(statement);
}

function formatV1ItemRef(ref: string): string {
  const [sectionName, itemId] = ref.split('.', 2);
  if (!itemId) {
    return `<code>${escapeHtml(ref)}</code>`;
  }
  return `${escapeHtml(definitionStatementSectionTitle(sectionName as SectionName))}<br><small><code>${escapeHtml(itemId)}</code></small>`;
}

function formatV1ItemName(item: { id: string; displayName?: string }): string {
  return item.displayName
    ? `${escapeHtml(item.displayName)}<br><small><code>${escapeHtml(item.id)}</code></small>`
    : `<code>${escapeHtml(item.id)}</code>`;
}

function formatConceptRef(id: string, conceptDisplayNameById: Map<string, string>): string {
  const displayName = conceptDisplayNameById.get(id);
  if (!displayName || displayName === id) {
    return `<code>${escapeHtml(id)}</code>`;
  }
  return `${escapeHtml(displayName)}<br><small><code>${escapeHtml(id)}</code></small>`;
}

function formatConceptLinkRef(
  id: string,
  conceptDisplayNameById: Map<string, string>,
  pageSlugByConceptId: Map<string, string> | undefined
): string {
  const slug = pageSlugByConceptId?.get(id) ?? slugifyIdentifier(id);
  const displayName = conceptDisplayNameById.get(id);
  const label = displayName && displayName !== id ? escapeHtml(displayName) : `<code>${escapeHtml(id)}</code>`;
  const idLine = displayName && displayName !== id
    ? `<br><small><code>${escapeHtml(id)}</code></small>`
    : '';
  return `<a href="./${escapeHtml(slug)}">${label}</a>${idLine}`;
}

function formatConceptSummaryLink(
  id: string,
  conceptDisplayNameById: Map<string, string>,
  pageSlugByConceptId: Map<string, string> | undefined
): string {
  const slug = pageSlugByConceptId?.get(id) ?? slugifyIdentifier(id);
  const displayName = conceptDisplayNameById.get(id) ?? id;
  return `<a href="./${escapeHtml(slug)}">${escapeHtml(displayName)}</a>`;
}

function formatStatementSimilarity(statement: StructuredConceptStatement): string {
  if (!statement.negatesSimilarityWith?.length) {
    return '-';
  }
  return statement.negatesSimilarityWith.map((ref) => `<code>${escapeHtml(ref)}</code>`).join(', ');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderConceptMermaid(concept: StructuredConceptV2): string {
  const lines = [
    '```mermaid',
    'flowchart LR',
  ];
  for (const statement of concept.definition.statements) {
    const shape = statement.polarity === 'negative'
      ? `{{"${escapeMermaidLabel(statement.id)}"}}`
      : `["${escapeMermaidLabel(statement.id)}"]`;
    lines.push(`  ${mermaidNodeId(statement.id)}${shape}`);
  }
  for (const link of concept.internalLinks ?? []) {
    lines.push(`  ${mermaidNodeId(link.from)} -- "${escapeMermaidLabel(link.kind)}" --> ${mermaidNodeId(link.to)}`);
  }
  const externalNodes = new Set<string>();
  for (const relationship of concept.externalRelationships ?? []) {
    const externalId = `external_${mermaidNodeId(relationship.to)}`;
    if (!externalNodes.has(externalId)) {
      lines.push(`  ${externalId}[/"${escapeMermaidLabel(relationship.to)}"/]`);
      externalNodes.add(externalId);
    }
    for (const ref of relationship.supportedBy ?? []) {
      lines.push(`  ${mermaidNodeId(ref)} -. "${escapeMermaidLabel(relationship.kind)}" .-> ${externalId}`);
    }
  }
  lines.push('```');
  return lines.join('\n');
}

function mermaidNodeId(value: string): string {
  return `n_${value.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function escapeMermaidLabel(value: string): string {
  return value.replace(/"/g, '\\"');
}

function countCoverage(concept: StructuredConceptV1): Record<string, number> {
  const counts: Record<string, number> = {
    unreviewed: 0,
    none: 0,
    partial: 0,
    complete: 0,
  };
  for (const sectionName of sectionNames(concept)) {
    counts[concept.sections[sectionName].coverage] = (counts[concept.sections[sectionName].coverage] ?? 0) + 1;
  }
  return counts;
}

function formatCoverageSummary(counts: Record<string, number>): string {
  return [
    `complete ${counts.complete ?? 0}`,
    `partial ${counts.partial ?? 0}`,
    `none ${counts.none ?? 0}`,
    `unreviewed ${counts.unreviewed ?? 0}`,
  ].join(' / ');
}

function reviewFocus(concept: StructuredConceptV1): string {
  const hasUnreviewed = sectionNames(concept).some((sectionName) => concept.sections[sectionName].coverage === 'unreviewed');
  if (hasUnreviewed) {
    return '`unreviewed sections remain`';
  }
  if (concept.sections.openIssues.items.length > 0) {
    return '`open issues need human decisions`';
  }
  const hasPartial = sectionNames(concept).some((sectionName) => concept.sections[sectionName].coverage === 'partial');
  if (hasPartial) {
    return '`partially covered sections need review`';
  }
  return '`ready for approval review`';
}

function appendSection(lines: string[], sectionName: SectionName, section: StructuredConceptSection): void {
  lines.push(`## ${sectionTitle(sectionName)}`);
  lines.push('');
  lines.push(`Coverage: \`${section.coverage}\``);
  if (section.reason) {
    lines.push('');
    lines.push(`Reason: ${section.reason}`);
  }
  if (section.resolutionCriteria?.length) {
    lines.push('');
    lines.push('Resolution criteria:');
    lines.push('');
    for (const criterion of section.resolutionCriteria) {
      const sources = criterion.sources?.length ? ` Sources: ${criterion.sources.map((source) => `\`${source}\``).join(', ')}` : '';
      lines.push(`- \`${criterion.id}\`: ${criterion.text}${sources}`);
    }
  }
  lines.push('');
  if (section.items.length === 0) {
    lines.push('- None');
    lines.push('');
    return;
  }
  for (const item of section.items) {
    lines.push(`### ${item.id}`);
    lines.push('');
    lines.push(sectionName === 'openIssues' ? item.question ?? '' : item.text ?? '');
    if (item.status) {
      lines.push('');
      lines.push(`Status: \`${item.status}\``);
    }
    lines.push('');
    lines.push(`Sources: ${item.sources.map((source) => `\`${source}\``).join(', ')}`);
    lines.push('');
  }
}

function appendV1OpenQuestions(lines: string[], concept: StructuredConceptV1): void {
  lines.push('## Open Questions');
  lines.push('');
  const section = concept.sections.openIssues;
  if (!section.items.length) {
    lines.push('- None');
    lines.push('');
    return;
  }
  lines.push('| Issue | Status | Question | Sources |');
  lines.push('| --- | --- | --- | --- |');
  for (const item of section.items) {
    lines.push(`| \`${item.id}\` | \`${item.status ?? 'open'}\` | ${formatTableCell(item.question ?? item.text)} | ${item.sources.map((source) => `\`${source}\``).join(', ')} |`);
  }
  lines.push('');
}

function appendDefinitionStatementsV1(lines: string[], concept: StructuredConceptV1): void {
  lines.push('## Definition Statements');
  lines.push('');
  for (const sectionName of sectionNames(concept).filter((name) => name !== 'openIssues')) {
    const section = concept.sections[sectionName];
    if (!section.items.length) {
      continue;
    }
    lines.push(`### ${definitionStatementSectionTitle(sectionName)}`);
    lines.push('');
    lines.push('<table class="concept-statement-table">');
    lines.push('<thead><tr><th>Statement</th><th>Text</th></tr></thead>');
    lines.push('<tbody>');
    for (const item of section.items) {
      lines.push(`<tr><td>${formatV1ItemName(item)}</td><td>${escapeHtml(item.text ?? item.question ?? '')}</td></tr>`);
    }
    lines.push('</tbody>');
    lines.push('</table>');
    lines.push('');
  }
}

function appendV1Coverage(lines: string[], concept: StructuredConceptV1): void {
  lines.push('## Coverage');
  lines.push('');
  lines.push('| Area | Coverage | Reason | Resolution criteria |');
  lines.push('| --- | --- | --- | --- |');
  for (const sectionName of sectionNames(concept)) {
    const section = concept.sections[sectionName];
    const criteria = section.resolutionCriteria
      ?.map((criterion) => `\`${criterion.id}\`: ${criterion.text}`)
      .join('<br>');
    lines.push(`| \`${sectionName}\` | \`${section.coverage}\` | ${formatTableCell(section.reason)} | ${formatTableCell(criteria)} |`);
  }
  lines.push('');
}

function appendInternalLinks(lines: string[], concept: StructuredConceptV1): void {
  lines.push('## Internal Links');
  lines.push('');
  if (!concept.links?.length) {
    lines.push('- None');
    lines.push('');
    return;
  }
  lines.push('| From | Kind | To | Reason | Sources |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const link of concept.links) {
    lines.push(`| ${formatV1ItemRef(link.from)} | \`${link.kind}\` | ${formatV1ItemRef(link.to)} | ${formatTableCell(link.reason)} | ${link.sources.map((source) => `\`${source}\``).join(', ')} |`);
  }
  lines.push('');
}

function appendV2InternalLinks(lines: string[], concept: StructuredConceptV2): void {
  lines.push('## Internal Links');
  lines.push('');
  if (!concept.internalLinks?.length) {
    lines.push('- None');
    lines.push('');
    return;
  }
  lines.push('| From | Kind | To | Reason | Evidence |');
  lines.push('| --- | --- | --- | --- | --- |');
  const statementById = new Map(concept.definition.statements.map((statement) => [statement.id, statement]));
  for (const link of concept.internalLinks) {
    lines.push(`| ${formatStatementRef(link.from, statementById)} | \`${link.kind}\` | ${formatStatementRef(link.to, statementById)} | ${formatTableCell(link.reason)} | ${link.evidence.map((ref) => `\`${ref}\``).join(', ')} |`);
  }
  lines.push('');
}

function appendV2ExternalRelationships(
  lines: string[],
  concept: StructuredConceptV2,
  conceptDisplayNameById: Map<string, string>
): void {
  lines.push('## External Relationships');
  lines.push('');
  if (!concept.externalRelationships?.length) {
    lines.push('- None');
    lines.push('');
    return;
  }
  lines.push('| Concept | Kind | Reason | Supported by | Evidence |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const relationship of concept.externalRelationships) {
    lines.push(`| ${formatConceptRef(relationship.to, conceptDisplayNameById)} | \`${relationship.kind}\` | ${formatTableCell(relationship.reason)} | ${formatTableCell(relationship.supportedBy?.map((ref) => `\`${ref}\``).join(', '))} | ${relationship.evidence.map((ref) => `\`${ref}\``).join(', ')} |`);
  }
  lines.push('');
}

function appendV2OpenQuestions(lines: string[], concept: StructuredConceptV2): void {
  lines.push('## Open Questions');
  lines.push('');
  if (!concept.reviewState?.openIssues?.length) {
    lines.push('- None');
    lines.push('');
    return;
  }
  lines.push('| Issue | Status | Question | Evidence |');
  lines.push('| --- | --- | --- | --- |');
  for (const issue of concept.reviewState.openIssues) {
    lines.push(`| \`${issue.id}\` | \`${issue.status}\` | ${formatTableCell(issue.question)} | ${issue.evidence.map((ref) => `\`${ref}\``).join(', ')} |`);
  }
  lines.push('');
}

function appendV2Coverage(lines: string[], concept: StructuredConceptV2): void {
  lines.push('## Coverage');
  lines.push('');
  const coverageEntries = Object.entries(concept.reviewState?.coverage ?? {});
  if (coverageEntries.length === 0) {
    lines.push('- None');
    lines.push('');
    return;
  }
  lines.push('| Area | Coverage | Reason | Resolution criteria |');
  lines.push('| --- | --- | --- | --- |');
  for (const [area, coverage] of coverageEntries) {
    const criteria = coverage.resolutionCriteria
      ?.map((criterion) => `\`${criterion.id}\`: ${criterion.text}`)
      .join('<br>');
    lines.push(`| \`${area}\` | \`${coverage.status}\` | ${formatTableCell(coverage.reason)} | ${formatTableCell(criteria)} |`);
  }
  lines.push('');
}

function appendV2Evidence(lines: string[], concept: StructuredConceptV2): void {
  lines.push('## Evidence');
  lines.push('');
  lines.push('| Evidence ID | Type | Path | Exists |');
  lines.push('| --- | --- | --- | --- |');
  for (const evidence of concept.evidence) {
    lines.push(`| \`${evidence.id}\` | \`${evidence.type}\` | \`${evidence.path}\` | ${existsSync(path.resolve(concept.baseDir, evidence.path)) ? 'yes' : 'no'} |`);
  }
  lines.push('');
}

function appendRelationships(
  lines: string[],
  concept: StructuredConceptV1,
  conceptDisplayNameById: Map<string, string>,
  pageSlugByConceptId: Map<string, string> | undefined
): void {
  lines.push('## External Relationships');
  lines.push('');
  if (concept.relationships.length === 0) {
    lines.push('- None');
    lines.push('');
    return;
  }
  lines.push('| Concept | Kind | Reason | Sources |');
  lines.push('| --- | --- | --- | --- |');
  for (const relationship of concept.relationships) {
    lines.push(`| ${formatConceptLinkRef(relationship.to, conceptDisplayNameById, pageSlugByConceptId)} | \`${relationship.kind}\` | ${formatTableCell(relationship.reason)} | ${relationship.sources.map((source) => `\`${source}\``).join(', ')} |`);
  }
  lines.push('');
}

function appendSources(lines: string[], concept: StructuredConceptV1): void {
  lines.push('## Evidence');
  lines.push('');
  lines.push('| Source ID | Type | Path | Exists |');
  lines.push('| --- | --- | --- | --- |');
  for (const source of concept.sources) {
    lines.push(`| \`${source.id}\` | \`${source.type}\` | \`${source.path}\` | ${existsSync(path.resolve(concept.baseDir, source.path)) ? 'yes' : 'no'} |`);
  }
  lines.push('');
}

function appendValidation(lines: string[], issues: ValidationIssue[]): void {
  lines.push('## Validation');
  lines.push('');
  if (issues.length === 0) {
    lines.push('- No validation issues.');
    lines.push('');
    return;
  }
  lines.push('| Severity | Path | Message |');
  lines.push('| --- | --- | --- |');
  for (const issue of issues) {
    lines.push(`| \`${issue.severity}\` | \`${issue.path}\` | ${formatTableCell(issue.message)} |`);
  }
  lines.push('');
}

function appendTechnicalMetadata(lines: string[], concept: StructuredConcept): void {
  lines.push('## Technical Metadata');
  lines.push('');
  lines.push(`- Source JSON: \`${relativePath(concept.sourcePath)}\``);
  lines.push('');
}

function renderConceptIndex(result: { concepts: StructuredConcept[]; issues: ValidationIssue[] }, pageSlugByConceptId: Map<string, string>): string {
  const lines = [
    '<!-- structured-concept-review:start -->',
    '',
    'Review concept lifecycle, coverage, validation issues, and summaries. Edit the source `concept.json` files, not this generated page.',
    '',
    '| Concept ID | Display Name | Lifecycle | Coverage | Issues | Summary |',
    '| --- | --- | --- | --- | ---: | --- |',
  ];
  for (const concept of result.concepts) {
    const issueCount = result.issues.filter((issue) => issue.conceptId === concept.id).length;
    const coverage = summarizeConceptCoverage(concept);
    const lifecycle = formatConceptStatus(concept.lifecycle.status, lifecycleTone(concept.lifecycle.status));
    const pageSlug = pageSlugByConceptId.get(concept.id) ?? slugifyIdentifier(concept.id);
    lines.push(`| [${concept.id}](./${pageSlug}.md) | ${formatTableCell(concept.displayName)} | ${lifecycle} | ${coverage} | ${issueCount} | ${formatTableCell(conceptSummary(concept))} |`);
  }
  lines.push('');
  lines.push('<!-- structured-concept-review:end -->');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeConceptIndex(indexPath: string, result: { concepts: StructuredConcept[]; issues: ValidationIssue[] }, pageSlugByConceptId: Map<string, string>): void {
  const section = renderConceptIndex(result, pageSlugByConceptId).trimEnd();
  if (!existsSync(indexPath)) {
    writeText(indexPath, [
      '<!-- generated-by: @rawsql-ts/ddl-docs-cli structured-concept -->',
      '',
      '# Concepts',
      '',
      section,
      '',
    ].join('\n'));
    return;
  }
  const current = readFileSync(indexPath, 'utf8');
  const markerPattern = /\r?\n?<!-- structured-concept-(?:poc|review):start -->[\s\S]*?<!-- structured-concept-(?:poc|review):end -->\r?\n?/;
  const next = markerPattern.test(current)
    ? current.replace(markerPattern, `\n${section}\n`)
    : `${current.trimEnd()}\n\n${section}\n`;
  writeText(indexPath, next);
}

function conceptSummary(concept: StructuredConcept): string {
  return concept.schemaVersion === 1 ? concept.summary : concept.definition.summary;
}

function conceptRelationships(concept: StructuredConcept): Array<{
  to: string;
  kind: string;
  reason: string;
  sources: string[];
  supportedBy?: string[];
}> {
  if (concept.schemaVersion === 1) {
    return concept.relationships;
  }
  return (concept.externalRelationships ?? []).map((relationship) => ({
    to: relationship.to,
    kind: relationship.kind,
    reason: relationship.reason,
    sources: relationship.evidence,
    supportedBy: relationship.supportedBy,
  }));
}

function buildRelationshipIndex(result: { concepts: StructuredConcept[] }): unknown {
  return {
    schemaVersion: 1,
    generatedBy: 'structured-concept',
    concepts: result.concepts.map((concept) => ({
      id: concept.id,
      displayName: concept.displayName,
      status: concept.lifecycle.status,
      path: `${concept.id}/concept.json`,
      summary: conceptSummary(concept),
    })),
    relationships: result.concepts.flatMap((concept) =>
      conceptRelationships(concept).map((relationship) => ({
        from: concept.id,
        to: relationship.to,
        kind: relationship.kind,
        reason: relationship.reason,
        sources: relationship.sources,
        supportedBy: relationship.supportedBy,
      }))
    ),
  };
}

function buildReverseRelationshipIndex(result: { concepts: StructuredConcept[] }): unknown {
  const incoming = new Map<string, unknown[]>();
  for (const concept of result.concepts) {
    for (const relationship of conceptRelationships(concept)) {
      const bucket = incoming.get(relationship.to) ?? [];
      bucket.push({
        from: concept.id,
        kind: relationship.kind,
        reason: relationship.reason,
        sources: relationship.sources,
        supportedBy: relationship.supportedBy,
      });
      incoming.set(relationship.to, bucket);
    }
  }
  return {
    schemaVersion: 1,
    generatedBy: 'structured-concept',
    concepts: Object.fromEntries(Array.from(incoming.entries()).sort(([left], [right]) => left.localeCompare(right))),
  };
}

function buildAiContext(result: { concepts: StructuredConcept[] }): unknown {
  return {
    schemaVersion: 1,
    generatedBy: 'structured-concept',
    concepts: result.concepts.map((concept) => concept.schemaVersion === 1
      ? {
          id: concept.id,
          displayName: concept.displayName,
          lifecycle: concept.lifecycle,
          summary: concept.summary,
          sections: concept.sections,
          links: concept.links ?? [],
          relationships: concept.relationships,
          sources: concept.sources,
        }
      : {
          id: concept.id,
          displayName: concept.displayName,
          lifecycle: concept.lifecycle,
          definition: concept.definition,
          internalLinks: concept.internalLinks ?? [],
          externalRelationships: concept.externalRelationships ?? [],
          evidence: concept.evidence,
          reviewState: concept.reviewState ?? {},
        }),
  };
}

function buildReviewSummary(result: { concepts: StructuredConcept[]; issues: ValidationIssue[] }): unknown {
  return {
    schemaVersion: 1,
    generatedBy: 'structured-concept',
    conceptCount: result.concepts.length,
    validation: {
      errors: result.issues.filter((issue) => issue.severity === 'error').length,
      warnings: result.issues.filter((issue) => issue.severity === 'warning').length,
      issues: result.issues,
    },
    coverage: result.concepts.map((concept) => concept.schemaVersion === 1
      ? {
          id: concept.id,
          openIssueCount: concept.sections.openIssues.items.length,
          internalLinkCount: concept.links?.length ?? 0,
          sections: Object.fromEntries(sectionNames(concept).map((sectionName) => [
            sectionName,
            {
              coverage: concept.sections[sectionName].coverage,
              itemCount: concept.sections[sectionName].items.length,
            },
          ])),
        }
      : {
          id: concept.id,
          openIssueCount: concept.reviewState?.openIssues?.length ?? 0,
          internalLinkCount: concept.internalLinks?.length ?? 0,
          statementCount: concept.definition.statements.length,
          externalRelationshipCount: concept.externalRelationships?.length ?? 0,
          coverage: concept.reviewState?.coverage ?? {},
        }),
  };
}

function sectionTitle(sectionName: SectionName): string {
  return {
    definition: 'Definition',
    goals: 'Goals',
    nonResponsibilities: 'Non-responsibilities',
    invariants: 'Invariants',
    openIssues: 'Open Issues',
    rationale: 'Rationale',
  }[sectionName];
}

function definitionStatementSectionTitle(sectionName: SectionName): string {
  return {
    definition: 'Meaning',
    goals: 'Responsibilities',
    nonResponsibilities: 'Boundaries',
    invariants: 'Invariants',
    openIssues: 'Open Questions',
    rationale: 'Rationale',
  }[sectionName];
}

function writeJson(filePath: string, value: unknown): void {
  writeText(filePath, JSON.stringify(value, null, 2));
}

function writeText(filePath: string, value: string): void {
  ensureDirectory(path.dirname(filePath));
  writeFileSync(filePath, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

function ensureDirectory(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function relativePath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
