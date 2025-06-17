// analysis-features.js
// This module handles SQL analysis features like updating table lists, CTE lists, and schema information.

// Import rawsql-ts modules
import { SelectQueryParser, TableSourceCollector, CTECollector, SchemaCollector } from "https://unpkg.com/rawsql-ts/dist/esm/index.min.js";

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

// --- Table List Logic ---
function updateTableList(sqlText) {
    if (!tableListElement) return;
    tableListElement.innerHTML = ''; // Clear previous list

    if (!sqlText.trim()) {
        const li = document.createElement('li');
        li.textContent = '(SQL input is empty)';
        tableListElement.appendChild(li);
        return;
    }

    try {
        const ast = SelectQueryParser.parse(sqlText);
        const collector = new TableSourceCollector(false);
        const tables = collector.collect(ast);

        if (tables.length === 0) {
            const li = document.createElement('li');
            li.textContent = '(No tables found)';
            tableListElement.appendChild(li);
        } else {
            const uniqueTableNames = [...new Set(tables.map(t => t.table.name))];
            uniqueTableNames.forEach(tableName => {
                const li = document.createElement('li');
                li.textContent = tableName;
                tableListElement.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error parsing SQL for table list:", error);
        const li = document.createElement('li');
        let errorText = '(Error parsing SQL for table list)';
        if (error.name === 'ParseError' && error.message) {
            errorText = `(Parse Error: ${error.message.substring(0, 50)}...)`; // Keep it short
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
    // Initial population
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
        const query = SelectQueryParser.parse(sqlText);
        const cteCollector = new CTECollector();
        const ctes = cteCollector.collect(query);
        if (ctes.length > 0) {
            ctes.forEach(cte => {
                const listItem = document.createElement('li');
                listItem.textContent = cte.getSourceAliasName();
                cteListElement.appendChild(listItem);
            });
        } else {
            const listItem = document.createElement('li');
            listItem.textContent = '(No CTEs found)';
            cteListElement.appendChild(listItem);
        }
    } catch (error) {
        console.error("Error collecting CTEs:", error);
        const listItem = document.createElement('li');
        let errorText = 'Error collecting CTEs.';
        if (error.name === 'ParseError' && error.message) {
            errorText = `(Parse Error: ${error.message.substring(0, 50)}...)`; // Keep it short
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
    // Initial population
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
        const query = SelectQueryParser.parse(sqlText);
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
        if (error.name === 'ParseError' && error.message) {
            errorMessage = `Error parsing SQL for schema: ${error.message}`;
            if (error.details) {
                errorMessage += `\nAt line ${error.details.startLine}, column ${error.details.startColumn}. Found: '${error.details.found}'`;
            }
        } else if (error.message) {
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
