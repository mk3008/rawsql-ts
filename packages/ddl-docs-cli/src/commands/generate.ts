import path from 'node:path';
import { loadDictionary, resolveLocale } from '../analyzer/dictionary';
import { analyzeColumns } from '../analyzer/columnConcepts';
import { resolveSchemaSettings } from '../config';
import { snapshotTableDocs } from '../parser/snapshotTableDocs';
import { loadConceptRegistry, loadDdlRelationshipMetadata, resolveTableRelationship } from '../relationshipMetadata';
import { renderColumnPages } from '../render/columnPages';
import { renderIndexPages } from '../render/indexPages';
import { renderReferencesPage } from '../render/referencesPage';
import { renderConceptIndex, renderConceptPages, renderProcessIndex, renderProcessPages } from '../render/sourcePages';
import { renderTableMarkdown, tableDocPath } from '../render/tableMarkdown';
import type { TableSuggestionSql } from '../render/tableMarkdown';
import { writeManifest } from '../state/manifest';
import { loadTableDocsMetadata } from '../tableDocsMetadata';
import type { DdlInput, GenerateDocsOptions, SuggestionItem } from '../types';
import { dedupeDdlInputsByInstanceAndPath } from '../utils/ddlInputDedupe';
import { collectSqlFiles, ensureDirectory, expandGlobPatterns } from '../utils/fs';
import { filterPgDump } from '../utils/pgDumpFilter';
import { writeTextFileNormalized } from '../utils/io';

const GENERATOR_VERSION = '1.0.0';

/**
 * Generates markdown docs and metadata files from DDL inputs.
 */
export function runGenerateDocs(options: GenerateDocsOptions): void {
  const normalizedDirectories = normalizeDdlInputs(options.ddlDirectories);
  const normalizedFiles = normalizeDdlInputs(options.ddlFiles);
  const normalizedGlobs = normalizeDdlInputs(options.ddlGlobs);

  if (normalizedDirectories.length === 0 && normalizedFiles.length === 0 && normalizedGlobs.length === 0) {
    throw new Error('At least one DDL input is required via --ddl-dir, --ddl-file, or --ddl-glob.');
  }

  const mergedFiles: DdlInput[] = [...normalizedFiles];
  for (const globInput of normalizedGlobs) {
    for (const p of expandGlobPatterns([globInput.path])) {
      mergedFiles.push({ path: p, instance: globInput.instance ?? '' });
    }
  }
  const uniqueFiles = dedupeDdlInputsByInstanceAndPath(mergedFiles);
  const rawSources = collectSqlFiles(normalizedDirectories, uniqueFiles, options.extensions);
  const sources = options.filterPgDump
    ? rawSources.map((s) => ({ ...s, sql: filterPgDump(s.sql) }))
    : rawSources;
  if (options.filterPgDump) {
    for (const source of sources) {
      if (source.sql.trim().length === 0) {
        throw new Error(
          `No schema DDL remained after --filter-pg-dump for input: ${source.path}.`
        );
      }
    }
  }
  if (sources.length === 0) {
    throw new Error('No SQL files were discovered from the provided inputs.');
  }

  const schemaSettings = resolveSchemaSettings(options.configPath, options.defaultSchema, options.searchPath);
  const snapshot = snapshotTableDocs(sources, schemaSettings, { columnOrder: options.columnOrder });
  if (snapshot.tables.length === 0) {
    throw new Error('No table definitions were detected in the supplied DDL.');
  }

  const dictionary = loadDictionary(options.dictionaryPath);
  const tableDocsMetadata = loadTableDocsMetadata(options.tableDocsPath);
  const ddlRelationshipMetadata = loadDdlRelationshipMetadata(options.relationshipPath);
  const conceptRegistry = loadConceptRegistry(options.conceptRelationshipPath);
  const locale = resolveLocale(options.locale, dictionary);
  const analysis = analyzeColumns(snapshot.tables, { locale, dictionary });
  const referenceSuggestions = buildReferenceSuggestions(snapshot.tables);
  const allSuggestions = [...analysis.suggestions, ...referenceSuggestions].sort((a, b) => a.sql.localeCompare(b.sql));
  const tableSuggestSet = new Set(allSuggestions.map((item) => `${item.schema}.${item.table}`));

  const generatedFiles: string[] = [];
  const tableOutputs: string[] = [];
  const columnOutputs: string[] = [];
  const assetOutputs: string[] = [];
  const nameMap: Record<string, string> = {};
  const suggestionsByTable = groupSuggestionsByTable(allSuggestions);

  for (const table of snapshot.tables) {
    const outputPath = tableDocPath(options.outDir, table.schemaSlug, table.tableSlug);
    ensureDirectory(path.dirname(outputPath));
    const tableSuggestions = suggestionsByTable.get(`${table.schema}.${table.table}`) ?? {
      columnCommentSql: [],
      foreignKeySql: [],
    };
    writeTextFileNormalized(
      outputPath,
      renderTableMarkdown(table, tableSuggestions, {
        labelSeparator: options.labelSeparator,
        getColumnSample: (column) => tableDocsMetadata.getColumnSample(table.schema, table.table, column.name),
        getTableDesignNotes: () => tableDocsMetadata.getTableDesignNotes(table.schema, table.table),
        getColumnDesignNotes: (column) => tableDocsMetadata.getColumnDesignNotes(table.schema, table.table, column.name),
        getConstraintDesignNotes: (constraint) => tableDocsMetadata.getConstraintDesignNotes(table.schema, table.table, constraint.name),
        getTableDesignIntent: () => tableDocsMetadata.getTableDesignIntent(table.schema, table.table),
        getColumnDesignIntent: (column) => tableDocsMetadata.getColumnDesignIntent(table.schema, table.table, column.name),
        getConstraintDesignIntent: (constraint) => tableDocsMetadata.getConstraintDesignIntent(table.schema, table.table, constraint.name),
        tableRelationship: resolveTableRelationship(table.sourceFiles, ddlRelationshipMetadata, conceptRegistry),
      })
    );
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

  const sourcePages = [
    ...renderConceptPages(options.outDir, conceptRegistry),
    ...renderProcessPages(options.outDir, ddlRelationshipMetadata),
  ];
  const conceptIndex = renderConceptIndex(options.outDir, conceptRegistry);
  const processIndex = renderProcessIndex(options.outDir, ddlRelationshipMetadata);
  if (conceptIndex) {
    sourcePages.push(conceptIndex);
  }
  if (processIndex) {
    sourcePages.push(processIndex);
  }
  for (const page of sourcePages) {
    ensureDirectory(path.dirname(page.path));
    writeTextFileNormalized(page.path, page.content);
    generatedFiles.push(page.path);
    tableOutputs.push(page.path);
  }

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

  const vitePressAssets = writeVitePressPreviewAssets(options.outDir);
  generatedFiles.push(...vitePressAssets);
  assetOutputs.push(...vitePressAssets);

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
      ddlDirectories: normalizedDirectories,
      ddlFiles: uniqueFiles,
      ddlGlobs: normalizedGlobs,
      tableDocsPath: options.tableDocsPath,
      relationshipPath: options.relationshipPath,
      conceptRelationshipPath: options.conceptRelationshipPath,
    },
    nameMap,
    tableOutputs,
    columnOutputs,
    assetOutputs,
  });

  const totalIssues = snapshot.warnings.length + analysis.findings.length;
  if (options.strict && totalIssues > 0) {
    throw new Error(`Strict mode failed: ${totalIssues} issues found.`);
  }
}

function writeVitePressPreviewAssets(outDir: string): string[] {
  const configPath = path.join(outDir, '.vitepress', 'config.mts');
  const themeIndexPath = path.join(outDir, '.vitepress', 'theme', 'index.ts');
  const themeStylePath = path.join(outDir, '.vitepress', 'theme', 'style.css');

  ensureDirectory(path.dirname(configPath));
  ensureDirectory(path.dirname(themeIndexPath));

  writeTextFileNormalized(configPath, renderVitePressConfig());
  writeTextFileNormalized(themeIndexPath, renderVitePressThemeIndex());
  writeTextFileNormalized(themeStylePath, renderVitePressThemeCss());

  return [configPath, themeIndexPath, themeStylePath];
}

function renderVitePressConfig(): string {
  return [
    "import { defineConfig } from 'vitepress';",
    '',
    'export default defineConfig({',
    "  title: 'DDL Review',",
    "  description: 'Generated table definition review docs',",
    '  cleanUrls: true,',
    '  appearance: true,',
    '});',
    '',
  ].join('\n');
}

function renderVitePressThemeIndex(): string {
  return [
    "import DefaultTheme from 'vitepress/theme';",
    "import { defineComponent, h, nextTick, onMounted, watch } from 'vue';",
    "import { useRoute } from 'vitepress';",
    "import './style.css';",
    '',
    "const MERMAID_CDN_URL = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';",
    '',
    'declare global {',
    '  interface Window {',
    '    mermaid?: {',
    '      initialize: (options: Record<string, unknown>) => void;',
    '      run: (options: { nodes: HTMLElement[] }) => Promise<void>;',
    '    };',
    '    ddlDocsMermaidLoading?: Promise<void>;',
    '  }',
    '}',
    '',
    'function loadMermaid(): Promise<void> {',
    "  if (typeof window === 'undefined') {",
    '    return Promise.resolve();',
    '  }',
    '  if (window.mermaid) {',
    '    return Promise.resolve();',
    '  }',
    '  if (window.ddlDocsMermaidLoading) {',
    '    return window.ddlDocsMermaidLoading;',
    '  }',
    '  window.ddlDocsMermaidLoading = new Promise((resolve, reject) => {',
    "    const script = document.createElement('script');",
    '    script.src = MERMAID_CDN_URL;',
    '    script.async = true;',
    '    script.onload = () => resolve();',
    '    script.onerror = () => reject(new Error(`Failed to load Mermaid from ${MERMAID_CDN_URL}`));',
    '    document.head.appendChild(script);',
    '  });',
    '  return window.ddlDocsMermaidLoading;',
    '}',
    '',
    'async function renderMermaidBlocks(): Promise<void> {',
    "  if (typeof document === 'undefined') {",
    '    return;',
    '  }',
    '  const renderTargets: HTMLElement[] = [];',
    "  const markdownBlocks = Array.from(document.querySelectorAll<HTMLElement>('div.language-mermaid'));",
    '  for (const block of markdownBlocks) {',
    "    const code = block.querySelector('code')?.textContent?.trim() ?? '';",
    '    if (!code) {',
    '      continue;',
    '    }',
    "    const target = document.createElement('div');",
    "    target.className = 'ddl-docs-mermaid';",
    '    target.textContent = code;',
    '    block.replaceWith(target);',
    '  }',
    "  const blocks = Array.from(document.querySelectorAll<HTMLElement>('.ddl-docs-mermaid:not([data-ddl-docs-mermaid-rendered])'));",
    '  for (const block of blocks) {',
    "    const code = block.textContent?.trim() ?? '';",
    '    if (!code) {',
    '      continue;',
    '    }',
    "    block.dataset.ddlDocsMermaidRendered = 'true';",
    '    renderTargets.push(block);',
    '  }',
    '  if (renderTargets.length === 0) {',
    '    return;',
    '  }',
    '  try {',
    '    await loadMermaid();',
    '    window.mermaid?.initialize({ startOnLoad: false, securityLevel: "strict" });',
    '    await window.mermaid?.run({ nodes: renderTargets });',
    '  } catch (error) {',
    '    for (const target of renderTargets) {',
    "      target.classList.add('ddl-docs-mermaid-failed');",
    '    }',
    '    console.warn(error);',
    '  }',
    '}',
    '',
    'const DdlDocsLayout = defineComponent({',
    '  setup() {',
    '    const route = useRoute();',
    '    onMounted(() => {',
    '      void nextTick(renderMermaidBlocks);',
    '    });',
    '    watch(',
    '      () => route.path,',
    '      () => {',
    '        void nextTick(renderMermaidBlocks);',
    '      }',
    '    );',
    '    return () => h(DefaultTheme.Layout);',
    '  },',
    '});',
    '',
    'export default {',
    '  extends: DefaultTheme,',
    '  Layout: DdlDocsLayout,',
    '};',
    '',
  ].join('\n');
}

function renderVitePressThemeCss(): string {
  return [
    '.VPDoc .container {',
    '  max-width: none !important;',
    '}',
    '',
    '.VPDoc .content {',
    '  max-width: none !important;',
    '}',
    '',
    '.VPDoc .content-container {',
    '  max-width: none !important;',
    '}',
    '',
    '.VPDoc.has-aside .content {',
    '  padding-right: 0 !important;',
    '}',
    '',
    '.VPDoc .aside {',
    '  display: none !important;',
    '}',
    '',
    '.vp-doc h1 {',
    '  margin-top: 0;',
    '}',
    '',
    '.vp-doc h2 {',
    '  margin: 32px 0 14px;',
    '  padding-top: 18px;',
    '}',
    '',
    '.vp-doc table {',
    '  display: table;',
    '  min-width: 100%;',
    '  width: max-content;',
    '  margin: 12px 0 22px;',
    '  font-size: 12px;',
    '  line-height: 1.25;',
    '}',
    '',
    '.vp-doc tr {',
    '  border-top: 1px solid var(--vp-c-divider);',
    '}',
    '',
    '.vp-doc th,',
    '.vp-doc td {',
    '  padding: 5px 8px;',
    '  vertical-align: top;',
    '}',
    '',
    '.vp-doc th {',
    '  white-space: nowrap;',
    '}',
    '',
    '.vp-doc td {',
    '  min-width: 56px;',
    '}',
    '',
    '.vp-doc td:nth-child(2),',
    '.vp-doc td:nth-child(3),',
    '.vp-doc td:nth-child(4),',
    '.vp-doc td:nth-child(5),',
    '.vp-doc td:nth-child(6),',
    '.vp-doc td:nth-child(7) {',
    '  white-space: nowrap;',
    '}',
    '',
    '.vp-doc td:last-child {',
    '  min-width: 260px;',
    '  max-width: 520px;',
    '}',
    '',
    '.vp-doc code {',
    '  font-size: 0.9em;',
    '  line-height: 1.15;',
    '  padding: 1px 5px;',
    '}',
    '',
    ".vp-doc div[class*='language-'] {",
    '  margin: 12px 0 22px;',
    '}',
    '',
    ".vp-doc div[class*='language-'] pre {",
    '  max-height: 440px;',
    '}',
    '',
    '.ddl-docs-mermaid {',
    '  margin: 16px 0 24px;',
    '  padding: 16px;',
    '  overflow-x: auto;',
    '  border: 1px solid var(--vp-c-divider);',
    '  border-radius: 8px;',
    '  background: var(--vp-c-bg-soft);',
    '}',
    '',
    '.ddl-docs-mermaid svg {',
    '  max-width: 100%;',
    '  height: auto;',
    '}',
    '',
    '.ddl-docs-mermaid-failed {',
    '  white-space: pre;',
    '  font-family: var(--vp-font-family-mono);',
    '  font-size: 12px;',
    '}',
    '',
  ].join('\n');
}

function normalizeDdlInputs(inputs: Array<DdlInput | string>): DdlInput[] {
  return inputs
    .map((entry) => {
      if (typeof entry === 'string') {
        return { path: entry, instance: '' };
      }
      return { path: entry.path, instance: entry.instance ?? '' };
    })
    .filter((entry) => Boolean(entry.path));
}

function groupSuggestionsByTable(
  suggestions: SuggestionItem[]
): Map<string, TableSuggestionSql> {
  const map = new Map<string, TableSuggestionSql>();
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
    lines.push(`  - source: ${warning.source.filePath}${warning.source.statementIndex != null ? `#${warning.source.statementIndex}` : ''}`);
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
      const tableKeyParts = reference.fromTableKey.split('.');
      const schema = tableKeyParts[0] ?? '';
      const tableName = tableKeyParts[1] ?? '';
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
