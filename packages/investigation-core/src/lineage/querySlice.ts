import {
  BinarySelectQuery,
  CTECollector,
  CTEComposer,
  CTEDependencyAnalyzer,
  CTEQueryDecomposer,
  QueryScopeCollector,
  SelectQueryParser,
  SimpleSelectQuery,
  SqlFormatter,
  ValuesQuery,
  queryScopeSelectorKey,
  resolveQueryScope,
} from 'rawsql-ts';
import type {
  CommonTable,
  QueryScopeAstV1,
  QueryScopeKind,
  QueryScopeSelectorV1,
  SelectQuery,
  WithClause,
} from 'rawsql-ts';
import { analyzeCollectedQueryScopes, type OuterReferenceStatusV1, type QueryScopeMetadataV1 } from './queryScopeAnalysis';
import { extractAnalysisSelectQuery } from './rawsqlAdapter';
import { parseSchemaFactsFromDdl, type DdlInput, type SchemaFacts } from './schemaFacts';

/** Inputs for statically slicing one parser-backed query scope. */
export interface QuerySliceInputV1 {
  /** Submitted SQL parsed and sliced without execution. */
  sql: string;
  /** Structural scope selector returned for the same SQL by query-structure analysis. */
  selector: QueryScopeSelectorV1;
  /** Optional DDL sources used to resolve otherwise-unproven column ownership. */
  ddl?: DdlInput[];
  /** Optional pre-parsed schema facts. When present, these take precedence over `ddl`. */
  schemaFacts?: SchemaFacts;
}

/** Stable input-error codes for invalid source SQL or selector resolution. */
export type QuerySliceInputErrorCode =
  | 'SOURCE_SQL_INVALID'
  | 'SCOPE_SELECTOR_NOT_FOUND'
  | 'SCOPE_SELECTOR_AMBIGUOUS';

/** Input failure raised before a selected scope can enter the ready/blocked decision. */
export class QuerySliceInputError extends Error {
  /** Stable machine-readable failure code. */
  readonly code: QuerySliceInputErrorCode;

  /** Creates a typed query-slice input failure. */
  constructor(code: QuerySliceInputErrorCode, message?: string) {
    super(message ?? defaultInputErrorMessage(code));
    this.name = 'QuerySliceInputError';
    this.code = code;
  }
}

/** Stable V1 reasons why a resolved scope cannot be emitted as standalone SQL. */
export type QuerySliceDiagnosticCodeV1 =
  | 'SCOPE_CORRELATED'
  | 'SCOPE_REFERENCE_UNRESOLVED'
  | 'MULTIPLE_CTE_CONTEXTS_UNSUPPORTED'
  | 'CTE_CONTEXT_UNRESOLVED'
  | 'RECURSIVE_CTE_SLICE_UNSUPPORTED'
  | 'SLICE_SQL_GENERATION_FAILED';

/** Machine-readable evidence explaining a blocked query slice. */
export interface QuerySliceDiagnosticV1 {
  code: QuerySliceDiagnosticCodeV1;
  message: string;
}

interface QuerySliceResultBaseV1 {
  diagnostics: QuerySliceDiagnosticV1[];
  directCteNames: string[];
  includedCteNames: string[];
  kind: 'query-slice';
  outerReferenceStatus: OuterReferenceStatusV1;
  scopeKind: QueryScopeKind;
  selector: QueryScopeSelectorV1;
  version: 1;
}

/** V1 query-slice result whose selected scope was proven safe to serialize. */
export interface QuerySliceReadyV1 extends QuerySliceResultBaseV1 {
  outerReferenceStatus: 'none';
  sql: string;
  status: 'ready';
}

/** V1 query-slice result that intentionally contains no candidate SQL. */
export interface QuerySliceBlockedV1 extends QuerySliceResultBaseV1 {
  status: 'blocked';
}

/** Explicit ready/blocked result for one resolved structural query scope. */
export type QuerySliceResultV1 = QuerySliceReadyV1 | QuerySliceBlockedV1;

interface LexicalCteContext {
  owner: QueryScopeAstV1;
  withClause: WithClause;
}

interface ExternalCteReference {
  context: LexicalCteContext;
  name: string;
}

interface SliceAnalysisContext {
  astScopes: QueryScopeAstV1[];
  metadataBySelector: Map<string, QueryScopeMetadataV1>;
  schemaFacts?: SchemaFacts;
  scopeBySelector: Map<string, QueryScopeAstV1>;
}

/**
 * Produces SQL only when one selected query scope is statically proven standalone.
 * Blocked results intentionally contain no candidate SQL.
 */
export function sliceQueryScope(input: QuerySliceInputV1): QuerySliceResultV1 {
  const schemaFacts = input.schemaFacts ?? (input.ddl && input.ddl.length > 0 ? parseSchemaFactsFromDdl(input.ddl) : undefined);
  const query = parseSourceSql(input.sql);
  const astScopes = collectScopes(query);
  const resolution = resolveQueryScope(astScopes, input.selector);
  if (resolution.status === 'not_found') {
    throw new QuerySliceInputError('SCOPE_SELECTOR_NOT_FOUND');
  }
  if (resolution.status === 'ambiguous') {
    throw new QuerySliceInputError('SCOPE_SELECTOR_AMBIGUOUS');
  }

  const metadata = analyzeCollectedQueryScopes(astScopes, schemaFacts);
  const metadataBySelector = new Map(metadata.map((item) => [queryScopeSelectorKey(item.selector), item]));
  const scopeBySelector = new Map(astScopes.map((scope) => [queryScopeSelectorKey(scope.selector), scope]));
  const selectedMetadata = metadataBySelector.get(queryScopeSelectorKey(resolution.scope.selector));
  if (!selectedMetadata) {
    throw new QuerySliceInputError('SCOPE_SELECTOR_NOT_FOUND');
  }

  const base = {
    diagnostics: [] as QuerySliceDiagnosticV1[],
    directCteNames: selectedMetadata.directCteNames,
    includedCteNames: [] as string[],
    kind: 'query-slice' as const,
    outerReferenceStatus: selectedMetadata.outerReferenceStatus,
    scopeKind: selectedMetadata.kind,
    selector: selectedMetadata.selector,
    version: 1 as const,
  };
  if (selectedMetadata.outerReferenceStatus === 'correlated') {
    return blocked(base, 'SCOPE_CORRELATED', 'The selected scope references a containing query scope.');
  }
  if (selectedMetadata.outerReferenceStatus === 'unresolved') {
    return blocked(base, 'SCOPE_REFERENCE_UNRESOLVED', 'Column ownership in the selected scope is not statically proven.');
  }

  const analysis: SliceAnalysisContext = { astScopes, metadataBySelector, schemaFacts, scopeBySelector };
  const boundaryCheck = proveStandaloneBoundary(resolution.scope.query, schemaFacts);
  if (boundaryCheck) return blocked(base, boundaryCheck.code, boundaryCheck.message);
  const externalCteReferences = collectExternalCteReferences(resolution.scope, analysis);
  if ('diagnostic' in externalCteReferences) {
    return blocked(base, externalCteReferences.diagnostic.code, externalCteReferences.diagnostic.message);
  }
  const ownCteNames = declaredCteNames(resolution.scope.query);

  try {
    if (selectedMetadata.kind === 'cte') {
      const cteResult = sliceCteScope(resolution.scope, externalCteReferences, analysis);
      if ('diagnostic' in cteResult) return blocked(base, cteResult.diagnostic.code, cteResult.diagnostic.message);
      return ready(base, cteResult.sql, cteResult.includedCteNames);
    }

    if (externalCteReferences.length === 0) {
      return ready(base, serializeAndValidate(resolution.scope.query), []);
    }
    if (ownCteNames.length > 0) {
      return blocked(
        base,
        'MULTIPLE_CTE_CONTEXTS_UNSUPPORTED',
        'The selected scope combines its own WITH clause with an outer lexical CTE context.',
      );
    }

    const composed = composeExternalCtes(resolution.scope, externalCteReferences, analysis);
    if ('diagnostic' in composed) return blocked(base, composed.diagnostic.code, composed.diagnostic.message);
    return ready(base, composed.sql, composed.includedCteNames);
  } catch (error) {
    return blocked(
      base,
      'SLICE_SQL_GENERATION_FAILED',
      `Standalone SQL generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// API output shape review: kept the existing ready-only result.sql contract
// and generated-artifact formatter boundary. Canonical parsed queries, AST
// identities, and candidate SQL for blocked results remain internal. CTE proof
// compares dependency membership while preserving decomposer output order.

function proveStandaloneBoundary(query: SelectQuery, schemaFacts?: SchemaFacts): QuerySliceDiagnosticV1 | null {
  const boundaryScopes = collectScopes(query);
  const boundaryMetadata = analyzeCollectedQueryScopes(boundaryScopes, schemaFacts);
  const unresolvedDescendant = boundaryMetadata.find((metadata) =>
    metadata.parentSelector && metadata.outerReferenceStatus === 'unresolved');
  return unresolvedDescendant
    ? {
        code: 'SCOPE_REFERENCE_UNRESOLVED',
        message: 'A descendant scope references a name that is not resolved inside the selected boundary.',
      }
    : null;
}

function collectExternalCteReferences(
  selected: QueryScopeAstV1,
  analysis: SliceAnalysisContext,
): ExternalCteReference[] | { diagnostic: QuerySliceDiagnosticV1 } {
  const references: ExternalCteReference[] = [];
  const seen = new Set<string>();
  const subtree = analysis.astScopes.filter((scope) => selectorContains(scope.selector, selected.selector));
  for (const scope of subtree) {
    const metadata = analysis.metadataBySelector.get(queryScopeSelectorKey(scope.selector));
    for (const name of metadata?.directCteNames ?? []) {
      const context = resolveCteReferenceContext(scope, name, analysis.scopeBySelector);
      if (!context) {
        return diagnostic('CTE_CONTEXT_UNRESOLVED', 'A CTE name in the selected subtree has no unique visible lexical definition.');
      }
      if (selectorContains(context.owner.selector, selected.selector)) {
        continue;
      }
      const key = `${queryScopeSelectorKey(context.owner.selector)}\u0000${name}`;
      if (!seen.has(key)) {
        seen.add(key);
        references.push({ context, name });
      }
    }
  }
  return references;
}

function sliceCteScope(
  selected: QueryScopeAstV1,
  externalCteReferences: ExternalCteReference[],
  analysis: SliceAnalysisContext,
): { includedCteNames: string[]; sql: string } | { diagnostic: QuerySliceDiagnosticV1 } {
  const owner = selected.parentSelector
    ? analysis.scopeBySelector.get(queryScopeSelectorKey(selected.parentSelector))
    : undefined;
  const location = selected.selector.path.at(-1);
  const withClause = owner ? leadingWithClause(owner.query) : null;
  if (!owner || location?.kind !== 'cte' || !withClause) {
    return diagnostic('CTE_CONTEXT_UNRESOLVED', 'The lexical WITH owner for the selected CTE cannot be resolved.');
  }
  if (withClause.recursive) {
    return diagnostic('RECURSIVE_CTE_SLICE_UNSUPPORTED', 'Recursive WITH contexts are not sliced in V1.');
  }
  if (!(owner.query instanceof SimpleSelectQuery) || !isSingleDirectWithContext(owner.query, withClause)) {
    return diagnostic('CTE_CONTEXT_UNRESOLVED', 'The selected CTE does not have one analyzer-safe lexical WITH context.');
  }
  const result = new CTEQueryDecomposer().extractCTE(owner.query, location.name);
  const context = { owner, withClause };
  const contextCheck = externalCteReferences.length > 0
    ? proveSingleContext(externalCteReferences, analysis, [location.name])
    : proveContextDependencies(context, result.dependencies, analysis, [location.name]);
  if ('diagnostic' in contextCheck) return contextCheck;
  if (contextCheck.context.owner !== owner) {
    return diagnostic('MULTIPLE_CTE_CONTEXTS_UNSUPPORTED', 'The selected CTE requires a different lexical WITH context.');
  }
  if (!sameNameSet(contextCheck.requiredCteNames, result.dependencies)) {
    return diagnostic('CTE_CONTEXT_UNRESOLVED', 'The selected CTE dependency closure does not match the existing decomposer.');
  }
  const unsafeDefinition = unsafeCteDefinition(withClause, [location.name, ...result.dependencies]);
  if (unsafeDefinition) return { diagnostic: unsafeDefinition };

  return {
    includedCteNames: result.dependencies,
    sql: validateGeneratedSql(result.executableSql),
  };
}

function composeExternalCtes(
  selected: QueryScopeAstV1,
  externalCteReferences: ExternalCteReference[],
  analysis: SliceAnalysisContext,
): { includedCteNames: string[]; sql: string } | { diagnostic: QuerySliceDiagnosticV1 } {
  if (!(selected.query instanceof SimpleSelectQuery)) {
    return diagnostic('CTE_CONTEXT_UNRESOLVED', 'External CTE composition currently requires a simple SELECT scope body.');
  }
  const contextCheck = proveSingleContext(externalCteReferences, analysis);
  if ('diagnostic' in contextCheck) return contextCheck;
  const { context, requiredCteNames } = contextCheck;
  if (!(context.owner.query instanceof SimpleSelectQuery)
    || !isSingleDirectWithContext(context.owner.query, context.withClause)) {
    return diagnostic('CTE_CONTEXT_UNRESOLVED', 'The external CTEs do not belong to one analyzer-safe lexical WITH context.');
  }
  const unsafeDefinition = unsafeCteDefinition(context.withClause, requiredCteNames);
  if (unsafeDefinition) return { diagnostic: unsafeDefinition };

  const tablesByName = new Map(context.withClause.tables.map((table) => [table.getSourceAliasName(), table]));
  const editedCtes = requiredCteNames.map((name) => ({
    name,
    query: serializeSelectCte(tablesByName.get(name)),
  }));
  const rootSql = new SqlFormatter().format(selected.query).formattedSql;
  const sql = new CTEComposer().compose(editedCtes, rootSql);
  return { includedCteNames: requiredCteNames, sql: validateGeneratedSql(sql) };
}

function proveSingleContext(
  references: ExternalCteReference[],
  analysis: SliceAnalysisContext,
  lexicalSourceCteNames: string[] = [],
): { context: LexicalCteContext; requiredCteNames: string[] } | { diagnostic: QuerySliceDiagnosticV1 } {
  const contextKeys = new Set(references.map((reference) => queryScopeSelectorKey(reference.context.owner.selector)));
  if (contextKeys.size !== 1) {
    return diagnostic('MULTIPLE_CTE_CONTEXTS_UNSUPPORTED', 'The selected scope depends on more than one lexical WITH context.');
  }
  const context = references[0].context;
  return proveContextDependencies(
    context,
    [...new Set(references.map((reference) => reference.name))],
    analysis,
    lexicalSourceCteNames,
  );
}

function proveContextDependencies(
  context: LexicalCteContext,
  directCteNames: string[],
  analysis: SliceAnalysisContext,
  lexicalSourceCteNames: string[] = [],
): { context: LexicalCteContext; requiredCteNames: string[] } | { diagnostic: QuerySliceDiagnosticV1 } {
  if (context.withClause.recursive) {
    return diagnostic('RECURSIVE_CTE_SLICE_UNSUPPORTED', 'Recursive WITH contexts are not sliced in V1.');
  }
  if (!(context.owner.query instanceof SimpleSelectQuery)) {
    return diagnostic('CTE_CONTEXT_UNRESOLVED', 'The lexical WITH owner is not supported by the existing dependency analyzer.');
  }

  const analyzer = new CTEDependencyAnalyzer();
  analyzer.analyzeDependencies(context.owner.query);
  if (analyzer.hasCircularDependency()) {
    return diagnostic('RECURSIVE_CTE_SLICE_UNSUPPORTED', 'Circular CTE dependencies are not sliced in V1.');
  }
  const required = collectDependencyClosure(directCteNames, analyzer);
  const executionOrder = analyzer.getExecutionOrder().filter((name) => required.has(name));
  if (executionOrder.length !== required.size) {
    return diagnostic('CTE_CONTEXT_UNRESOLVED', 'The existing CTE analyzer could not prove the complete dependency closure.');
  }
  const lexicalVisibilityDiagnostic = validateCteDependencyVisibility(
    context,
    [...new Set([...lexicalSourceCteNames, ...required])],
    analyzer,
    analysis,
  );
  if (lexicalVisibilityDiagnostic) return { diagnostic: lexicalVisibilityDiagnostic };

  for (const requiredName of executionOrder) {
    const cteScope = findCteScope(context.owner.selector, requiredName, analysis.astScopes);
    if (!cteScope) {
      return diagnostic('CTE_CONTEXT_UNRESOLVED', `The parser-backed scope for CTE ${requiredName} is unavailable.`);
    }
    const cteMetadata = analysis.metadataBySelector.get(queryScopeSelectorKey(cteScope.selector));
    if (cteMetadata?.outerReferenceStatus === 'correlated') {
      return diagnostic('SCOPE_CORRELATED', `Required CTE ${requiredName} references a containing query scope.`);
    }
    if (!cteMetadata || cteMetadata.outerReferenceStatus === 'unresolved') {
      return diagnostic('SCOPE_REFERENCE_UNRESOLVED', `Column ownership in required CTE ${requiredName} is not statically proven.`);
    }
    const boundaryDiagnostic = proveStandaloneBoundary(cteScope.query, analysis.schemaFacts);
    if (boundaryDiagnostic) return { diagnostic: boundaryDiagnostic };
    const nestedScopes = analysis.astScopes.filter((scope) => selectorContains(scope.selector, cteScope.selector));
    for (const nestedScope of nestedScopes) {
      const nestedMetadata = analysis.metadataBySelector.get(queryScopeSelectorKey(nestedScope.selector));
      for (const dependencyName of nestedMetadata?.directCteNames ?? []) {
        const dependencyContext = resolveCteReferenceContext(nestedScope, dependencyName, analysis.scopeBySelector);
        if (!dependencyContext) {
          return diagnostic('CTE_CONTEXT_UNRESOLVED', `CTE ${requiredName} has an unresolved lexical dependency.`);
        }
        if (queryScopeSelectorKey(dependencyContext.owner.selector) !== queryScopeSelectorKey(context.owner.selector)) {
          return diagnostic('MULTIPLE_CTE_CONTEXTS_UNSUPPORTED', 'A required CTE depends on another lexical WITH context.');
        }
      }
    }
  }
  return { context, requiredCteNames: executionOrder };
}

function validateCteDependencyVisibility(
  context: LexicalCteContext,
  sourceCteNames: string[],
  analyzer: CTEDependencyAnalyzer,
  analysis: SliceAnalysisContext,
): QuerySliceDiagnosticV1 | null {
  for (const sourceName of sourceCteNames) {
    const sourceScope = findCteScope(context.owner.selector, sourceName, analysis.astScopes);
    if (!sourceScope) {
      return {
        code: 'CTE_CONTEXT_UNRESOLVED',
        message: `The parser-backed scope for CTE ${sourceName} is unavailable.`,
      };
    }
    for (const dependencyName of analyzer.getDependencies(sourceName)) {
      const dependencyContext = resolveLexicalCteContext(sourceScope, dependencyName, analysis.scopeBySelector);
      if (!dependencyContext
        || queryScopeSelectorKey(dependencyContext.owner.selector) !== queryScopeSelectorKey(context.owner.selector)) {
        return {
          code: 'CTE_CONTEXT_UNRESOLVED',
          message: `CTE ${sourceName} depends on ${dependencyName}, which is not visible from its non-recursive WITH position.`,
        };
      }
    }
  }
  return null;
}

function resolveLexicalCteContext(
  selected: QueryScopeAstV1,
  name: string,
  scopeBySelector: Map<string, QueryScopeAstV1>,
): LexicalCteContext | null {
  let child = selected;
  let parentSelector = selected.parentSelector;
  while (parentSelector) {
    const owner = scopeBySelector.get(queryScopeSelectorKey(parentSelector));
    if (!owner) return null;
    const withClause = leadingWithClause(owner.query);
    if (withClause) {
      const visibleTables = visibleTablesForChild(withClause, owner.selector, child.selector);
      const matches = visibleTables.filter((table) => table.getSourceAliasName() === name);
      if (matches.length > 1) return null;
      if (matches.length === 1) return { owner, withClause };
    }
    child = owner;
    parentSelector = owner.parentSelector;
  }
  return null;
}

function resolveCteReferenceContext(
  scope: QueryScopeAstV1,
  name: string,
  scopeBySelector: Map<string, QueryScopeAstV1>,
): LexicalCteContext | null {
  const ownWithClause = leadingWithClause(scope.query);
  if (ownWithClause) {
    const matches = ownWithClause.tables.filter((table) => table.getSourceAliasName() === name);
    if (matches.length > 1) return null;
    if (matches.length === 1) return { owner: scope, withClause: ownWithClause };
  }
  return resolveLexicalCteContext(scope, name, scopeBySelector);
}

function visibleTablesForChild(
  withClause: WithClause,
  ownerSelector: QueryScopeSelectorV1,
  childSelector: QueryScopeSelectorV1,
): CommonTable[] {
  const next = childSelector.path[ownerSelector.path.length];
  if (next?.kind === 'cte' && !withClause.recursive) {
    return withClause.tables.slice(0, next.index);
  }
  return withClause.tables;
}

function collectDependencyClosure(names: string[], analyzer: CTEDependencyAnalyzer): Set<string> {
  const required = new Set<string>();
  const visit = (name: string): void => {
    if (required.has(name)) return;
    required.add(name);
    analyzer.getDependencies(name).forEach(visit);
  };
  names.forEach(visit);
  return required;
}

function sameNameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const expected = new Set(right);
  return expected.size === new Set(left).size && left.every((name) => expected.has(name));
}

function findCteScope(
  ownerSelector: QueryScopeSelectorV1,
  name: string,
  scopes: QueryScopeAstV1[],
): QueryScopeAstV1 | undefined {
  return scopes.find((scope) => {
    const segment = scope.selector.path.at(-1);
    return scope.kind === 'cte'
      && segment?.kind === 'cte'
      && segment.name === name
      && scope.parentSelector
      && queryScopeSelectorKey(scope.parentSelector) === queryScopeSelectorKey(ownerSelector);
  });
}

function isSingleDirectWithContext(query: SimpleSelectQuery, withClause: WithClause): boolean {
  const collected = new CTECollector().collect(query);
  const direct = new Set(withClause.tables);
  return collected.length === withClause.tables.length && collected.every((cte) => direct.has(cte));
}

function unsafeCteDefinition(withClause: WithClause, names: string[]): QuerySliceDiagnosticV1 | null {
  const tablesByName = new Map<string, CommonTable[]>();
  for (const table of withClause.tables) {
    const current = tablesByName.get(table.getSourceAliasName()) ?? [];
    current.push(table);
    tablesByName.set(table.getSourceAliasName(), current);
  }
  for (const name of names) {
    const matches = tablesByName.get(name) ?? [];
    if (matches.length !== 1) {
      return diagnostic('CTE_CONTEXT_UNRESOLVED', `CTE ${name} does not resolve to exactly one definition.`).diagnostic;
    }
    const table = matches[0];
    if (!isSelectQuery(table.query) || table.materialized !== null || (table.aliasExpression.columns?.length ?? 0) > 0) {
      return diagnostic(
        'CTE_CONTEXT_UNRESOLVED',
        `CTE ${name} uses a definition shape that the existing composer cannot preserve safely.`,
      ).diagnostic;
    }
  }
  return null;
}

function serializeSelectCte(table: CommonTable | undefined): string {
  if (!table || !isSelectQuery(table.query)) {
    throw new Error('Required CTE definition is unavailable or is not a SELECT query.');
  }
  return new SqlFormatter().format(table.query).formattedSql;
}

function serializeAndValidate(query: SelectQuery): string {
  return validateGeneratedSql(new SqlFormatter().format(query).formattedSql);
}

function validateGeneratedSql(sql: string): string {
  SelectQueryParser.parse(sql);
  return sql;
}

function parseSourceSql(sql: string): SelectQuery {
  try {
    return extractAnalysisSelectQuery(sql);
  } catch (error) {
    throw new QuerySliceInputError(
      'SOURCE_SQL_INVALID',
      `The source SQL cannot be parsed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function collectScopes(query: SelectQuery): QueryScopeAstV1[] {
  try {
    return new QueryScopeCollector().collect(query);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Query scope selector collision:')) {
      throw new QuerySliceInputError('SCOPE_SELECTOR_AMBIGUOUS');
    }
    throw error;
  }
}

function leadingWithClause(query: SelectQuery): WithClause | null {
  if (query instanceof SimpleSelectQuery || query instanceof ValuesQuery) return query.withClause;
  if (query instanceof BinarySelectQuery) return leadingWithClause(query.left);
  return null;
}

function declaredCteNames(query: SelectQuery): string[] {
  return leadingWithClause(query)?.tables.map((table) => table.getSourceAliasName()) ?? [];
}

function isSelectQuery(query: CommonTable['query']): query is SelectQuery {
  return query instanceof SimpleSelectQuery || query instanceof BinarySelectQuery || query instanceof ValuesQuery;
}

function selectorContains(candidate: QueryScopeSelectorV1, ancestor: QueryScopeSelectorV1): boolean {
  const candidateKey = queryScopeSelectorKey(candidate);
  const ancestorKey = queryScopeSelectorKey(ancestor);
  return candidateKey === ancestorKey || candidateKey.startsWith(`${ancestorKey}/`);
}

function ready(
  base: Omit<QuerySliceResultBaseV1, 'includedCteNames'> & { includedCteNames: string[] },
  sql: string,
  includedCteNames: string[],
): QuerySliceReadyV1 {
  return { ...base, diagnostics: [], includedCteNames, outerReferenceStatus: 'none', sql, status: 'ready' };
}

function blocked(
  base: QuerySliceResultBaseV1,
  code: QuerySliceDiagnosticCodeV1,
  message: string,
): QuerySliceBlockedV1 {
  return { ...base, diagnostics: [{ code, message }], status: 'blocked' };
}

function diagnostic(
  code: QuerySliceDiagnosticCodeV1,
  message: string,
): { diagnostic: QuerySliceDiagnosticV1 } {
  return { diagnostic: { code, message } };
}

function defaultInputErrorMessage(code: QuerySliceInputErrorCode): string {
  switch (code) {
    case 'SOURCE_SQL_INVALID':
      return 'The source SQL cannot be parsed.';
    case 'SCOPE_SELECTOR_NOT_FOUND':
      return 'The selector does not identify a scope in the supplied SQL.';
    case 'SCOPE_SELECTOR_AMBIGUOUS':
      return 'The selector identifies more than one scope in the supplied SQL.';
  }
}
