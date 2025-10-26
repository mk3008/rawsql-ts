// analysis-features.js
// This module handles SQL analysis features like updating table lists, CTE lists, and schema information.

// Import rawsql-ts modules from local vendor bundle for consistent class instances
import {
    SqlParser,
    TableSourceCollector,
    CTECollector,
    SchemaCollector,
    MultiQuerySplitter
} from './vendor/rawsql.browser.js';

let tableListElement, cteListElement, schemaInfoEditorInstance, sqlInputElement, debounceDelayMs;

export function initAnalysisFeatures(options) {
    tableListElement = options.tableList;
    cteListElement = options.cteList;
    schemaInfoEditorInstance = options.schemaInfoEditor;
    sqlInputElement = options.sqlInputEditor;
    debounceDelayMs = options.debounceDelay;

    if (!tableListElement) console.error("Analysis Features: tableList element not provided.");
    if (!cteListElement) console.error("Analysis Features: cteList element not provided.");
    if (!schemaInfoEditorInstance) console.error("Analysis Features: schemaInfoEditor instance not provided.");
    if (!sqlInputElement) console.error("Analysis Features: sqlInputEditor instance not provided.");
    if (debounceDelayMs === undefined) console.error("Analysis Features: debounceDelay not provided.");

    setupTableListAutoUpdate();
    setupCTEListAutoUpdate();
    setupSchemaInfoAutoUpdate();
}

let parseCache = { text: null, splitResult: null, statements: null, errors: null };

function getParseResult(sqlText) {
    if (parseCache.text === sqlText) {
        return parseCache;
    }

    const splitResult = MultiQuerySplitter.split(sqlText);
    const statements = new Map();
    const errors = [];

    for (const query of splitResult.queries) {
        if (query.isEmpty) {
            continue;
        }

        try {
            const ast = SqlParser.parse(query.sql);
            statements.set(query.index, { ast, sql: query.sql });
        } catch (error) {
            errors.push({
                index: query.index,
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    parseCache = { text: sqlText, splitResult, statements, errors };
    return parseCache;
}

function isSelectStatement(ast) {
    return Boolean(ast && typeof ast === 'object' && ast.__selectQueryType);
}

// Extract SELECT statements from the current SQL text for downstream analysis.
function extractSelectStatements(sqlText) {
    const { splitResult, statements } = getParseResult(sqlText);
    const selectStatements = [];

    for (const query of splitResult.queries) {
        if (query.isEmpty) {
            continue;
        }
        const parsed = statements.get(query.index);
        if (parsed && isSelectStatement(parsed.ast)) {
            selectStatements.push(parsed);
        }
    }

    return selectStatements;
}

// --- Table List Logic ---
function updateTableList(sqlText) {
    if (!tableListElement) return;
    tableListElement.innerHTML = '';

    if (!sqlText.trim()) {
        const li = document.createElement('li');
        li.textContent = '(SQL input is empty)';
        tableListElement.appendChild(li);
        return;
    }

    try {
        const selectStatements = extractSelectStatements(sqlText);
        if (selectStatements.length === 0) {
            const li = document.createElement('li');
            li.textContent = '(No SELECT statements found)';
            tableListElement.appendChild(li);
            return;
        }

        const tableNames = new Set();
        for (const { ast } of selectStatements) {
            const collector = new TableSourceCollector(false);
            const tables = collector.collect(ast);
            tables.forEach(t => {
                if (t?.table?.name) {
                    tableNames.add(t.table.name);
                }
            });
        }

        if (tableNames.size === 0) {
            const li = document.createElement('li');
            li.textContent = '(No tables found)';
            tableListElement.appendChild(li);
            return;
        }

        Array.from(tableNames).forEach(tableName => {
            const li = document.createElement('li');
            li.textContent = tableName;
            tableListElement.appendChild(li);
        });
    } catch (error) {
        console.error('Error parsing SQL for table list:', error);
        const li = document.createElement('li');
        let errorText = '(Error parsing SQL for table list)';
        if (error?.message) {
            errorText = `(Error: ${error.message.substring(0, 80)}...)`;
        }
        li.textContent = errorText;
        tableListElement.appendChild(li);
    }
}

function setupTableListAutoUpdate() {
    if (!sqlInputElement) return;
    let tableListDebounceTimer = null;
    sqlInputElement.on('changes', () => {
        if (tableListDebounceTimer) clearTimeout(tableListDebounceTimer);
        tableListDebounceTimer = setTimeout(() => updateTableList(sqlInputElement.getValue()), debounceDelayMs);
    });
    updateTableList(sqlInputElement.getValue());
}

// --- CTE List Logic ---
function updateCTEList(sqlText) {
    if (!cteListElement) return;
    cteListElement.innerHTML = '';
    if (!sqlText.trim()) {
        const li = document.createElement('li');
        li.textContent = '(SQL input is empty)';
        cteListElement.appendChild(li);
        return;
    }

    try {
        const selectStatements = extractSelectStatements(sqlText);
        if (selectStatements.length === 0) {
            const listItem = document.createElement('li');
            listItem.textContent = '(No SELECT statements found)';
            cteListElement.appendChild(listItem);
            return;
        }

        const cteNames = new Set();
        for (const { ast } of selectStatements) {
            const collector = new CTECollector();
            const ctes = collector.collect(ast);
            ctes.forEach(cte => {
                const name = cte.getSourceAliasName();
                if (name) {
                    cteNames.add(name);
                }
            });
        }

        if (cteNames.size === 0) {
            const listItem = document.createElement('li');
            listItem.textContent = '(No CTEs found)';
            cteListElement.appendChild(listItem);
            return;
        }

        Array.from(cteNames).forEach(name => {
            const listItem = document.createElement('li');
            listItem.textContent = name;
            cteListElement.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error collecting CTEs:', error);
        const listItem = document.createElement('li');
        let errorText = 'Error collecting CTEs.';
        if (error?.message) {
            errorText = `(Error: ${error.message.substring(0, 80)}...)`;
        }
        listItem.textContent = errorText;
        cteListElement.appendChild(listItem);
    }
}

function setupCTEListAutoUpdate() {
    if (!sqlInputElement) return;
    let cteListDebounceTimer = null;
    sqlInputElement.on('changes', () => {
        if (cteListDebounceTimer) clearTimeout(cteListDebounceTimer);
        cteListDebounceTimer = setTimeout(() => updateCTEList(sqlInputElement.getValue()), debounceDelayMs);
    });
    updateCTEList(sqlInputElement.getValue());
}

// --- Schema Info Logic ---
function updateSchemaInfo(sqlText) {
    if (!schemaInfoEditorInstance) return;

    if (!sqlText.trim()) {
        schemaInfoEditorInstance.setValue('(SQL input is empty)');
        schemaInfoEditorInstance.refresh();
        return;
    }

    try {
        const selectStatements = extractSelectStatements(sqlText);
        if (selectStatements.length === 0) {
            schemaInfoEditorInstance.setValue('(No SELECT statements found for schema analysis)');
            schemaInfoEditorInstance.refresh();
            return;
        }

        // Focus on the first SELECT statement for schema introspection.
        const query = selectStatements[0].ast;
        const schemaCollector = new SchemaCollector();
        const schemaInfo = schemaCollector.collect(query);

        if (schemaInfo && schemaInfo.length > 0) {
            schemaInfoEditorInstance.setValue(JSON.stringify(schemaInfo, null, 2));
        } else {
            schemaInfoEditorInstance.setValue('(No schema information collected or schema is empty)');
        }
    } catch (error) {
        console.error("Error collecting schema info:", error);
        let errorMessage = 'Error collecting schema info.';
        if (error?.message) {
            errorMessage = `Error collecting schema info: ${error.message}`;
        }
        schemaInfoEditorInstance.setValue(errorMessage);
    }
    schemaInfoEditorInstance.refresh();
}

function setupSchemaInfoAutoUpdate() {
    if (!sqlInputElement) return;
    let schemaInfoDebounceTimer = null;
    sqlInputElement.on('changes', () => {
        if (schemaInfoDebounceTimer) clearTimeout(schemaInfoDebounceTimer);
        schemaInfoDebounceTimer = setTimeout(() => {
            const sqlText = sqlInputElement.getValue();
            updateSchemaInfo(sqlText);
        }, debounceDelayMs);
    });
    // Initial population
    updateSchemaInfo(sqlInputElement.getValue());
}
