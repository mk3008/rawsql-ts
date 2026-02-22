import path from 'node:path';
import { loadDictionary, resolveLocale } from '../analyzer/dictionary';
import { analyzeColumns } from '../analyzer/columnConcepts';
import { resolveSchemaSettings } from '../config';
import { snapshotTableDocs } from '../parser/snapshotTableDocs';
import { renderColumnPages } from '../render/columnPages';
import { renderIndexPages } from '../render/indexPages';
import { renderReferencesPage } from '../render/referencesPage';
import { renderTableMarkdown, tableDocPath } from '../render/tableMarkdown';
import { writeManifest } from '../state/manifest';
import type { GenerateDocsOptions, SuggestionItem } from '../types';
import { collectSqlFiles, ensureDirectory, expandGlobPatterns } from '../utils/fs';
import { writeTextFileNormalized } from '../utils/io';

const GENERATOR_VERSION = '1.0.0';

/**
 * Generates markdown docs and metadata files from DDL inputs.
 */
export function runGenerateDocs(options: GenerateDocsOptions): void {
  if (options.ddlDirectories.length === 0 && options.ddlFiles.length === 0 && options.ddlGlobs.length === 0) {
    throw new Error('At least one DDL input is required via --ddl-dir, --ddl-file, or --ddl-glob.');
  }

  const globFiles = expandGlobPatterns(options.ddlGlobs);
  const mergedFiles = Array.from(new Set([...options.ddlFiles, ...globFiles]));
  const sources = collectSqlFiles(options.ddlDirectories, mergedFiles, options.extensions);
  if (sources.length === 0) {
    throw new Error('No SQL files were discovered from the provided inputs.');
  }

  const schemaSettings = resolveSchemaSettings(options.configPath, options.defaultSchema, options.searchPath);
  const snapshot = snapshotTableDocs(sources, schemaSettings, { columnOrder: options.columnOrder });
  if (snapshot.tables.length === 0) {
    throw new Error('No table definitions were detected in the supplied DDL.');
  }

  const dictionary = loadDictionary(options.dictionaryPath);
  const locale = resolveLocale(options.locale, dictionary);
  const analysis = analyzeColumns(snapshot.tables, { locale, dictionary });
  const referenceSuggestions = buildReferenceSuggestions(snapshot.tables);
  const allSuggestions = [...analysis.suggestions, ...referenceSuggestions].sort((a, b) => a.sql.localeCompare(b.sql));
  const tableSuggestSet = new Set(allSuggestions.map((item) => `${item.schema}.${item.table}`));

  const generatedFiles: string[] = [];
  const tableOutputs: string[] = [];
  const columnOutputs: string[] = [];
  const nameMap: Record<string, string> = {};
  const suggestionsByTable = groupSuggestionsByTable(allSuggestions);

  for (const table of snapshot.tables) {
    const outputPath = tableDocPath(options.outDir, table.schemaSlug, table.tableSlug);
    ensureDirectory(path.dirname(outputPath));
    const tableSuggestions = suggestionsByTable.get(`${table.schema}.${table.table}`) ?? {
      columnCommentSql: [],
      foreignKeySql: [],
    };
    writeTextFileNormalized(outputPath, renderTableMarkdown(table, tableSuggestions));
    generatedFiles.push(outputPath);
    tableOutputs.push(outputPath);
    nameMap[`${table.schema}.${table.table}`] = `${table.schemaSlug}/${table.tableSlug}.md`;
  }

  if (options.includeIndexes) {
    const indexPages = renderIndexPages(options.outDir, snapshot.tables, analysis.findings, tableSuggestSet);
    for (const page of indexPages) {
      ensureDirectory(path.dirname(page.path));
      writeTextFileNormalized(page.path, page.content);
      generatedFiles.push(page.path);
      tableOutputs.push(page.path);
    }
  }

  const columnPages = renderColumnPages(options.outDir, analysis.observed, analysis.findings);
  for (const page of columnPages) {
    ensureDirectory(path.dirname(page.path));
    writeTextFileNormalized(page.path, page.content);
    generatedFiles.push(page.path);
      columnOutputs.push(page.path);
  }

  const referencesPage = renderReferencesPage(options.outDir, snapshot.tables);
  ensureDirectory(path.dirname(referencesPage.path));
  writeTextFileNormalized(referencesPage.path, referencesPage.content);
  generatedFiles.push(referencesPage.path);
  tableOutputs.push(referencesPage.path);

  const metaDir = path.join(options.outDir, '_meta');
  ensureDirectory(metaDir);
  const warningsJsonPath = path.join(metaDir, 'warnings.json');
  const warningsMdPath = path.join(metaDir, 'warnings.md');
  const findingsJsonPath = path.join(metaDir, 'findings.json');
  const findingsMdPath = path.join(metaDir, 'findings.md');
  const snapshotPath = path.join(metaDir, 'snapshot.json');
  const observedPath = path.join(metaDir, 'observed-column-dictionary.json');
  const suggestedPath = path.join(metaDir, 'suggested.sql');

  writeTextFileNormalized(warningsJsonPath, JSON.stringify(snapshot.warnings, null, 2));
  writeTextFileNormalized(warningsMdPath, renderWarningsMarkdown(snapshot.warnings));
  writeTextFileNormalized(findingsJsonPath, JSON.stringify(analysis.findings, null, 2));
  writeTextFileNormalized(findingsMdPath, renderFindingsMarkdown(analysis.findings));
  writeTextFileNormalized(snapshotPath, JSON.stringify(snapshot.tables, null, 2));
  writeTextFileNormalized(observedPath, JSON.stringify(analysis.observed, null, 2));
  writeTextFileNormalized(suggestedPath, renderSuggestedSql(allSuggestions));
  generatedFiles.push(
    warningsJsonPath,
    warningsMdPath,
    findingsJsonPath,
    findingsMdPath,
    snapshotPath,
    observedPath,
    suggestedPath
  );

  const manifest = writeManifest({
    outDir: options.outDir,
    generatorVersion: GENERATOR_VERSION,
    dialect: options.dialect,
    optionsForHash: {
      dialect: options.dialect,
      locale,
      includeIndexes: options.includeIndexes,
      columnOrder: options.columnOrder,
      strict: options.strict,
      extensions: options.extensions,
      ddlDirectories: options.ddlDirectories,
      ddlFiles: mergedFiles,
      ddlGlobs: options.ddlGlobs,
    },
    nameMap,
    tableOutputs,
      columnOutputs,
  });

  console.log(`Generated ${generatedFiles.length} files under ${options.outDir}`);
  console.log(`Warnings: ${snapshot.warnings.length} (${warningsJsonPath})`);
  console.log(`Findings: ${analysis.findings.length} (${findingsJsonPath})`);
  console.log(`Manifest: ${manifest}`);

  const totalIssues = snapshot.warnings.length + analysis.findings.length;
  if (options.strict && totalIssues > 0) {
    throw new Error(`Strict mode failed: ${totalIssues} issues found.`);
  }
}

function groupSuggestionsByTable(
  suggestions: SuggestionItem[]
): Map<string, { columnCommentSql: string[]; foreignKeySql: string[] }> {
  const map = new Map<string, { columnCommentSql: string[]; foreignKeySql: string[] }>();
  for (const suggestion of suggestions) {
    const key = `${suggestion.schema}.${suggestion.table}`;
    const bucket = map.get(key) ?? { columnCommentSql: [], foreignKeySql: [] };
    if (suggestion.kind === 'column_comment') {
      bucket.columnCommentSql.push(suggestion.sql);
    } else {
      bucket.foreignKeySql.push(suggestion.sql);
    }
    map.set(key, bucket);
  }
  for (const [key, bucket] of map.entries()) {
    map.set(key, {
      columnCommentSql: Array.from(new Set(bucket.columnCommentSql)).sort(),
      foreignKeySql: Array.from(new Set(bucket.foreignKeySql)).sort(),
    });
  }
  return map;
}

function renderWarningsMarkdown(warnings: Array<{ kind: string; message: string; statementPreview: string; source: { filePath: string; statementIndex?: number } }>): string {
  const lines: string[] = [];
  lines.push('# Warnings');
  lines.push('');
  if (warnings.length === 0) {
    lines.push('- None');
    lines.push('');
    return lines.join('\n');
  }
  for (const warning of warnings) {
    lines.push(`- [${warning.kind}] ${warning.message}`);
    lines.push(`  - source: ${warning.source.filePath}${warning.source.statementIndex ? `#${warning.source.statementIndex}` : ''}`);
    lines.push(`  - statement: ${warning.statementPreview}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderFindingsMarkdown(findings: Array<{ kind: string; message: string; severity: string }>): string {
  const lines: string[] = [];
  lines.push('# Findings');
  lines.push('');
  if (findings.length === 0) {
    lines.push('- None');
    lines.push('');
    return lines.join('\n');
  }
  for (const finding of findings) {
    lines.push(`- [${finding.kind}] (${finding.severity}) ${finding.message}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderSuggestedSql(suggestions: SuggestionItem[]): string {
  const lines: string[] = [];
  lines.push('-- suggested: v1 (not applied)');
  if (suggestions.length === 0) {
    lines.push('-- none');
    return lines.join('\n');
  }
  for (const suggestion of suggestions.sort((a, b) => a.sql.localeCompare(b.sql))) {
    lines.push(suggestion.sql);
  }
  return lines.join('\n');
}

function buildReferenceSuggestions(tables: Array<{ outgoingReferences: Array<{ source: string; fromTableKey: string; fromColumns: string[]; targetTableKey: string; targetColumns: string[] }> }>): SuggestionItem[] {
  const dedupe = new Set<string>();
  const suggestions: SuggestionItem[] = [];
  for (const table of tables) {
    for (const reference of table.outgoingReferences) {
      if (reference.source !== 'suggested') {
        continue;
      }
      const key = `${reference.fromTableKey}|${reference.fromColumns.join(',')}|${reference.targetTableKey}|${reference.targetColumns.join(',')}`;
      if (dedupe.has(key)) {
        continue;
      }
      dedupe.add(key);
      const [schema, tableName] = reference.fromTableKey.split('.');
      if (!schema || !tableName) {
        continue;
      }
      suggestions.push({
        kind: 'foreign_key',
        schema,
        table: tableName,
        column: reference.fromColumns.join(','),
        sql: `ALTER TABLE ${quoteQualifiedName(reference.fromTableKey)} ADD FOREIGN KEY (${reference.fromColumns
          .map((column) => quoteIdentifier(column))
          .join(', ')}) REFERENCES ${quoteQualifiedName(reference.targetTableKey)}(${reference.targetColumns
          .map((column) => quoteIdentifier(column))
          .join(', ')});`,
      });
    }
  }
  return suggestions.sort((a, b) => a.sql.localeCompare(b.sql));
}

function quoteQualifiedName(value: string): string {
  return value
    .split('.')
    .map((part) => quoteIdentifier(part))
    .join('.');
}

function quoteIdentifier(value: string): string {
  const normalized = value.replace(/^"|"$/g, '');
  return `"${normalized.replace(/"/g, '""')}"`;
}
