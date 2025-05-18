// Import rawsql-ts modules
import { SelectQueryParser, SqlFormatter, TableSourceCollector, CTECollector, SchemaCollector } from "https://unpkg.com/rawsql-ts@0.8.3-beta/dist/esm/index.js";

const sqlInputEditor = CodeMirror.fromTextArea(document.getElementById('sql-input'), {
    mode: 'text/x-sql',
    lineNumbers: true,
    theme: 'default'
});
sqlInputEditor.setSize(null, 600); // Changed from 300 to 600

const formattedSqlEditor = CodeMirror.fromTextArea(document.getElementById('formatted-sql'), {
    mode: 'text/x-sql',
    lineNumbers: true,
    theme: 'default',
    readOnly: true
});
formattedSqlEditor.setSize(null, 600); // Changed from 300 to 600

// Style Configuration Elements
let styleJsonEditor; // Will be initialized in DOMContentLoaded
const styleSelect = document.getElementById('style-select');
const styleNameInput = document.getElementById('style-name-input');
const addNewStyleBtn = document.getElementById('add-new-style-btn');
const deleteStyleBtn = document.getElementById('delete-style-btn');
const saveStyleBtn = document.getElementById('save-style-btn');
const resetAllSettingsBtn = document.getElementById('reset-all-settings-btn'); // Added reset button
const revertStyleBtn = document.getElementById('revert-style-btn'); // Added revert button

const DEFAULT_STYLE_KEY = 'rawsql-formatter-styles';
let currentStyles = {}; // To hold all loaded/modified styles

const statusBar = document.getElementById('status-bar');
const clearInputBtn = document.getElementById('clear-input-btn');
const copyOutputBtn = document.getElementById('copy-output-btn');
const tableList = document.getElementById("table-list");
const cteList = document.getElementById("cte-list"); // Added for CTE list
const schemaInfoJsonEditorEl = document.getElementById("schema-info-json-editor"); // Updated for CodeMirror
let schemaInfoEditor; // For CodeMirror instance
const copyTableListBtn = document.getElementById('copy-table-list-btn');
const copyCteListBtn = document.getElementById('copy-cte-list-btn'); // Added for CTE list copy button
const copySchemaInfoBtn = document.getElementById('copy-schema-info-btn'); // Ensure this is present


// Tab switching logic
function initializeTabs(paneId) {
    const pane = document.getElementById(paneId);
    if (!pane) return;

    const tabButtons = pane.querySelectorAll('.tab-button');
    const tabContents = pane.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Deactivate all buttons and hide all content within this pane
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Activate clicked button and show corresponding content
            button.classList.add('active');
            const tabId = button.dataset.tab;
            const activeTabContent = pane.querySelector('#' + tabId + '-tab'); // Ensure selecting within the current pane
            if (activeTabContent) {
                activeTabContent.classList.add('active');
            }

            // Refresh CodeMirror instances if they are in the activated tab
            if (tabId === 'input-sql' && sqlInputEditor) {
                sqlInputEditor.refresh();
            }
            if (tabId === 'formatted' && formattedSqlEditor) {
                formattedSqlEditor.refresh();
            }
            if (tabId === 'style-config' && styleJsonEditor) { // Added refresh for styleJsonEditor
                styleJsonEditor.refresh();
            }
            if (tabId === 'schema' && schemaInfoEditor) { // Refresh schemaInfoEditor for the new 'schema' tab
                schemaInfoEditor.refresh();
            }
            // TODO: Add similar refresh logic if other tabs get CodeMirror instances
        });
    });

    // Activate the first tab by default if no other tab is active
    if (pane.querySelector('.tab-button.active') === null && tabButtons.length > 0) {
        tabButtons[0].click(); // Simulate a click on the first tab
    }
}

initializeTabs('left-pane');
initializeTabs('right-pane');

// Set initial SQL
const initialSql = "SELECT\n    id,\n    name,\n    email\nFROM\n    users\nWHERE\n    status = :active\nORDER BY\n    created_at DESC;";
sqlInputEditor.setValue(initialSql);

// Function to update status bar
function updateStatusBar(message, isError = false) {
    statusBar.textContent = message;
    statusBar.style.color = isError ? 'red' : 'green';
    if (statusBar.timer) {
        clearTimeout(statusBar.timer);
    }
    // For non-error messages, or specific short error messages, auto-clear.
    // For persistent error messages (like parse errors), don't auto-clear.
    if (!isError || message.length < 50) { // Heuristic for auto-clear
        statusBar.timer = setTimeout(() => {
            statusBar.textContent = 'Ready';
            statusBar.style.color = 'gray';
        }, 3000);
    }
}

// Function to format SQL
function formatSql() {
    const sqlText = sqlInputEditor.getValue();
    if (!sqlText.trim()) {
        formattedSqlEditor.setValue('');
        updateStatusBar('Input SQL is empty.');
        return;
    }

    try {
        let formatOptions = {};
        const activeLeftTabButton = document.querySelector('#left-pane .tab-button.active');

        if (activeLeftTabButton && activeLeftTabButton.dataset.tab === 'style-config' && styleJsonEditor) {
            try {
                const previewStyleJson = styleJsonEditor.getValue();
                if (previewStyleJson.trim()) {
                    formatOptions = JSON.parse(previewStyleJson);
                    updateStatusBar('Previewing with current style editor content.', false);
                } else {
                    const selectedStyleName = styleSelect.value;
                    if (selectedStyleName && currentStyles[selectedStyleName]) {
                        formatOptions = currentStyles[selectedStyleName];
                    }
                }
            } catch (e) {
                updateStatusBar(`Error in Style JSON (preview): ${e.message}`, true);
                formattedSqlEditor.setValue("Invalid JSON in Style Editor. Cannot format SQL for preview.");
                return;
            }
        } else {
            const selectedStyleName = styleSelect.value;
            if (selectedStyleName && currentStyles[selectedStyleName]) {
                formatOptions = currentStyles[selectedStyleName];
            }
        }

        const query = SelectQueryParser.parse(sqlText); // MODIFIED
        const formatter = new SqlFormatter(formatOptions); // MODIFIED
        const formattedSql = formatter.format(query).formattedSql;
        formattedSqlEditor.setValue(formattedSql);
        updateStatusBar('SQL formatted successfully.');
    } catch (error) {
        console.error("Error formatting SQL:", error);
        let errorMessage = `Error formatting SQL: ${error.message}`;
        if (error.name === 'ParseError' && error.details) { // Display detailed parse error
            errorMessage += `\\nAt line ${error.details.startLine}, column ${error.details.startColumn}. Found: '${error.details.found}'`;
        }
        updateStatusBar(errorMessage, true);
        formattedSqlEditor.setValue(errorMessage); // Show error in output editor
    }
}

// Debounce timer for auto-format
let debounceTimer = null;
const DEBOUNCE_DELAY = 250; // ms

// Attach listener to sqlInputEditor for changes
sqlInputEditor.on('changes', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(formatSql, DEBOUNCE_DELAY);
});

// Event listener for Clear Input button
clearInputBtn.addEventListener('click', () => {
    sqlInputEditor.setValue('');
    formattedSqlEditor.setValue(''); // Also clear output
    updateTableList(''); // Clear table list as well
    updateCTEList(''); // Clear CTE list as well
    updateSchemaInfo(''); // Ensure this line is present to clear schema info
    updateStatusBar('Input cleared.');
    sqlInputEditor.focus(); // Focus back to input
});

// Event listener for Copy Table List button
// const copyTableListBtn = document.getElementById('copy-table-list-btn'); // Already defined above
if (copyTableListBtn) {
    copyTableListBtn.addEventListener('click', () => {
        const tableListElem = document.getElementById("table-list");
        if (tableListElem && tableListElem.children.length > 0) {
            const tableNames = Array.from(tableListElem.children)
                .map(li => li.textContent)
                .filter(name => name && !name.startsWith("(")) // Filter out placeholder messages
                .join("\n");

            if (tableNames) {
                navigator.clipboard.writeText(tableNames).then(() => {
                    updateStatusBar('Table list copied to clipboard!');
                }).catch(err => {
                    console.error('Failed to copy table list: ', err);
                    updateStatusBar('Failed to copy table list.', true);
                });
            } else {
                updateStatusBar('No table names to copy.', true);
            }
        } else {
            updateStatusBar('Table list is empty.', true);
        }
    });
}

// Event listener for Copy CTE List button
if (copyCteListBtn) {
    copyCteListBtn.addEventListener('click', () => {
        if (cteList && cteList.children.length > 0) {
            const textToCopy = Array.from(cteList.children).map(li => li.textContent).join('\n');
            navigator.clipboard.writeText(textToCopy).then(() => {
                updateStatusBar('CTE list copied to clipboard.');
            }).catch(err => {
                console.error('Failed to copy CTE list: ', err);
                updateStatusBar('Failed to copy CTE list.', true);
            });
        } else {
            updateStatusBar('No CTEs to copy.', true);
        }
    });
}

// Event listener for Copy Schema Info button - Ensure this is present
if (copySchemaInfoBtn) {
    copySchemaInfoBtn.addEventListener('click', () => {
        if (schemaInfoEditor && schemaInfoEditor.getValue() && schemaInfoEditor.getValue() !== 'Error collecting schema info.' && schemaInfoEditor.getValue() !== '(SQL input is empty)') {
            navigator.clipboard.writeText(schemaInfoEditor.getValue()).then(() => {
                updateStatusBar('Schema info copied to clipboard.');
            }).catch(err => {
                console.error('Failed to copy schema info: ', err);
                updateStatusBar('Failed to copy schema info.', true);
            });
        } else {
            updateStatusBar('No schema info to copy.', true);
        }
    });
}

// Event listener for Copy Output button
copyOutputBtn.addEventListener('click', () => {
    const textToCopy = formattedSqlEditor.getValue();
    if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            updateStatusBar('Formatted SQL copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            updateStatusBar('Failed to copy SQL.', true);
        });
    } else {
        updateStatusBar('Nothing to copy.', true);
    }
});

// --- Style Configuration Logic ---

function loadStyles() {
    const storedStyles = localStorage.getItem(DEFAULT_STYLE_KEY);
    if (storedStyles) {
        currentStyles = JSON.parse(storedStyles);
    } else {
        // Default styles if nothing is in localStorage
        currentStyles = {
            "Default": {
                "identifierEscape": {
                    "start": "",
                    "end": ""
                },
                "parameterSymbol": ":",
                "parameterStyle": "named",
                "indentSize": 4,
                "indentChar": " ",
                "newline": "\n",
                "keywordCase": "lower",
                "commaBreak": "before",
                "andBreak": "before"
            },
            "OneLiner": { // Added OneLiner style
                "identifierEscape": {
                    "start": "",
                    "end": ""
                },
                "parameterSymbol": ":",
                "parameterStyle": "named",
                "keywordCase": "lower",
                // For a true one-liner, most other formatting options that add newlines or spaces would be omitted or set to minimize them.
                // For example, indentSize would be irrelevant if there are no newlines.
                // The rawsql-ts library's default behavior for unlisted options will apply.
                // If specific "one-liner" behavior is desired beyond just keywordCase,
                // additional properties like newline: "", indentChar: "", etc., might be needed
                // depending on how SqlFormatter handles missing properties for compactness.
                // For now, sticking to the provided JSON.
            },
            "Postgres": {
                "identifierEscape": {
                    "start": "\"",
                    "end": "\""
                },
                "parameterSymbol": "$",
                "parameterStyle": "indexed",
                "indentSize": 4,
                "indentChar": " ",
                "newline": "\n",
                "keywordCase": "upper",
                "commaBreak": "before",
                "andBreak": "before"
            },
            "MySQL": {
                "identifierEscape": {
                    "start": "`",
                    "end": "`"
                },
                "parameterSymbol": "?",
                "parameterStyle": "anonymous",
                "indentSize": 4,
                "indentChar": " ",
                "newline": "\n",
                "keywordCase": "upper",
                "commaBreak": "before",
                "andBreak": "before"
            },
            "SQLServer": {
                "identifierEscape": {
                    "start": "[",
                    "end": "]"
                },
                "parameterSymbol": "@",
                "parameterStyle": "named",
                "indentSize": 4,
                "indentChar": " ",
                "newline": "\n",
                "keywordCase": "upper",
                "commaBreak": "before",
                "andBreak": "before"
            }
        };
        saveStyles(); // Save the default styles
    }
    populateStyleSelect();
    // --- Remember last selected style ---
    let lastStyle = localStorage.getItem('rawsql-selected-style');
    if (lastStyle && currentStyles[lastStyle]) {
        styleSelect.value = lastStyle;
        displayStyle(lastStyle);
    } else if (Object.keys(currentStyles).length > 0) {
        const firstStyleName = Object.keys(currentStyles)[0];
        styleSelect.value = firstStyleName;
        displayStyle(firstStyleName);
    }
    // quick-style-selectも同期
    const quickStyleSelect = document.getElementById('quick-style-select');
    if (quickStyleSelect && styleSelect.value) quickStyleSelect.value = styleSelect.value;
    formatSql();
}

function saveStyles() {
    localStorage.setItem(DEFAULT_STYLE_KEY, JSON.stringify(currentStyles));
    updateStatusBar('Styles saved.', false);
    formatSql(); // Re-format SQL with the new style
}

function populateStyleSelect() {
    styleSelect.innerHTML = '';
    const quickStyleSelect = document.getElementById('quick-style-select');
    if (quickStyleSelect) quickStyleSelect.innerHTML = '';
    for (const styleName in currentStyles) {
        const option = document.createElement('option');
        option.value = styleName;
        option.textContent = styleName;
        styleSelect.appendChild(option);
        if (quickStyleSelect) {
            const quickOption = document.createElement('option');
            quickOption.value = styleName;
            quickOption.textContent = styleName;
            quickStyleSelect.appendChild(quickOption);
        }
    }
}

function displayStyle(styleName) {
    if (currentStyles[styleName]) {
        styleNameInput.value = styleName;
        try {
            const styleJsonString = JSON.stringify(currentStyles[styleName], null, 2);
            styleJsonEditor.setValue(styleJsonString);
        } catch (e) {
            console.error("Error stringifying style JSON:", e);
            styleJsonEditor.setValue("Error displaying style: Invalid JSON structure.");
            updateStatusBar("Error displaying style: Invalid JSON structure.", true);
        }
        styleJsonEditor.refresh(); // Ensure editor content is visible
    } else {
        styleNameInput.value = '';
        styleJsonEditor.setValue('');
        styleJsonEditor.refresh();
    }
}

// Function to set up event listeners for style controls
function setupStyleControls() {
    addNewStyleBtn.addEventListener('click', () => {
        const newStyleName = prompt("Enter a name for the new style:", "My Custom Style");
        if (newStyleName && newStyleName.trim() !== "") {
            if (currentStyles[newStyleName]) {
                alert("A style with this name already exists. Please choose a different name.");
                return;
            }
            const baseStyleName = styleSelect.value || Object.keys(currentStyles)[0] || "Default";
            const baseStyle = currentStyles[baseStyleName] ? JSON.parse(JSON.stringify(currentStyles[baseStyleName])) : { indent: "    ", keywordCase: "upper" };
            currentStyles[newStyleName] = baseStyle;
            populateStyleSelect();
            styleSelect.value = newStyleName;
            displayStyle(newStyleName);
            saveStyles();
            updateStatusBar(`Style '${newStyleName}' added.`, false);
        }
    });

    deleteStyleBtn.addEventListener('click', () => {
        const selectedStyleName = styleSelect.value;
        if (!selectedStyleName) {
            alert("No style selected to delete.");
            return;
        }
        if (Object.keys(currentStyles).length <= 1) {
            alert("Cannot delete the last style. Create another style first or edit this one.");
            return;
        }
        if (confirm(`Are you sure you want to delete the style '${selectedStyleName}'?`)) {
            delete currentStyles[selectedStyleName];
            populateStyleSelect();
            if (Object.keys(currentStyles).length > 0) {
                const firstStyleName = Object.keys(currentStyles)[0];
                styleSelect.value = firstStyleName;
                displayStyle(firstStyleName);
            } else {
                styleNameInput.value = '';
                styleJsonEditor.setValue('');
            }
            saveStyles();
            updateStatusBar(`Style '${selectedStyleName}' deleted.`, false);
        }
    });

    saveStyleBtn.addEventListener('click', () => {
        const originalStyleName = styleSelect.value;
        const newStyleName = styleNameInput.value.trim();
        let styleJson;
        if (!newStyleName) {
            alert("Style name cannot be empty.");
            return;
        }
        try {
            styleJson = JSON.parse(styleJsonEditor.getValue());
        } catch (e) {
            alert("Invalid JSON in style configuration. Please correct it.\nError: " + e.message);
            updateStatusBar("Error: Invalid JSON in style configuration.", true);
            return;
        }
        if (!originalStyleName) {
            alert("No style selected to save to. This is an unexpected error.");
            return;
        }
        if (originalStyleName !== newStyleName) {
            if (currentStyles[newStyleName]) {
                alert(`A style named '${newStyleName}' already exists. Please choose a different name or delete the existing one first.`);
                return;
            }
            currentStyles[newStyleName] = styleJson;
            delete currentStyles[originalStyleName];
            populateStyleSelect();
            styleSelect.value = newStyleName;
        } else {
            currentStyles[originalStyleName] = styleJson;
        }
        saveStyles();
        displayStyle(newStyleName);
        updateStatusBar(`Style '${newStyleName}' saved.`, false);
    });

    styleSelect.addEventListener('change', () => {
        const selectedStyleName = styleSelect.value;
        if (selectedStyleName) {
            localStorage.setItem('rawsql-selected-style', selectedStyleName);
            displayStyle(selectedStyleName);
            const quickStyleSelect = document.getElementById('quick-style-select');
            if (quickStyleSelect) quickStyleSelect.value = selectedStyleName;
            formatSql();
        }
    });

    const quickStyleSelect = document.getElementById('quick-style-select');
    if (quickStyleSelect) {
        quickStyleSelect.addEventListener('change', () => {
            const selected = quickStyleSelect.value;
            if (selected && currentStyles[selected]) {
                styleSelect.value = selected;
                localStorage.setItem('rawsql-selected-style', selected);
                displayStyle(selected);
                formatSql();
            }
        });
    }

    if (revertStyleBtn) {
        revertStyleBtn.addEventListener('click', () => {
            const selectedStyleName = styleSelect.value;
            if (selectedStyleName && currentStyles[selectedStyleName]) {
                if (confirm("Are you sure you want to revert changes to the style '" + selectedStyleName + "'? Unsaved modifications in the editor will be lost.")) {
                    displayStyle(selectedStyleName);
                    formatSql();
                    updateStatusBar(`Style '${selectedStyleName}' reverted to last saved state.`, false);
                }
            } else {
                alert("No style selected or style not found to revert.");
            }
        });
    }

    if (resetAllSettingsBtn) {
        resetAllSettingsBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to reset all settings? Saved styles will be deleted.")) {
                localStorage.removeItem(DEFAULT_STYLE_KEY);
                currentStyles = {};
                loadStyles();
                updateStatusBar('All settings have been reset.', false);
                const firstLeftTab = document.querySelector('#left-pane .tab-button');
                if (firstLeftTab) {
                    firstLeftTab.click();
                }
            }
        });
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Quick style select: change style for preview only
    const quickStyleSelect = document.getElementById('quick-style-select');
    if (quickStyleSelect) {
        quickStyleSelect.addEventListener('change', () => {
            const selected = quickStyleSelect.value;
            if (selected && currentStyles[selected]) {
                styleSelect.value = selected;
                displayStyle(selected);
                formatSql();
            }
        });
    }
    // Initialize CodeMirror for Style JSON editor
    // Ensure the textarea exists before trying to initialize CodeMirror
    const styleJsonTextarea = document.getElementById('style-json-editor');
    if (styleJsonTextarea) {
        styleJsonEditor = CodeMirror.fromTextArea(styleJsonTextarea, {
            mode: { name: "javascript", json: true },
            lineNumbers: true,
            theme: 'default',
            lineWrapping: true
        });
        styleJsonEditor.setSize(null, 300); // Adjust height as needed

        // Add event listener for changes in styleJsonEditor for live preview
        let styleDebounceTimer = null;
        styleJsonEditor.on('changes', () => {
            if (styleDebounceTimer) clearTimeout(styleDebounceTimer);
            styleDebounceTimer = setTimeout(() => {
                const activeLeftTabButton = document.querySelector('#left-pane .tab-button.active');
                if (activeLeftTabButton && activeLeftTabButton.dataset.tab === 'style-config') {
                    formatSql();
                }
            }, DEBOUNCE_DELAY);
        });

    } else {
        console.error("style-json-editor textarea not found!");
    }

    // Initialize CodeMirror for Schema Info (MOVED EARLIER)
    if (schemaInfoJsonEditorEl) {
        schemaInfoEditor = CodeMirror.fromTextArea(schemaInfoJsonEditorEl, {
            mode: { name: "javascript", json: true },
            lineNumbers: true,
            theme: 'default',
            readOnly: true,
            lineWrapping: true
        });
        schemaInfoEditor.setSize(null, 600); // Adjust height as needed
    } else {
        console.error("schema-info-json-editor textarea not found!");
    }

    // Initialize tabs for both panes
    initializeTabs('left-pane');
    initializeTabs('right-pane');

    // Set initial SQL and load styles
    const initialSql = "SELECT\n    id,\n    name,\n    email\nFROM\n    users\nWHERE\n    status = :active\nORDER BY\n    created_at DESC;";
    sqlInputEditor.setValue(initialSql);

    loadStyles(); // Load styles first
    setupStyleControls(); // Then set up controls which might depend on loaded styles
    formatSql(); // Initial format
    setupTableListAutoUpdate(); // Setup auto-update for table list
    setupCTEListAutoUpdate(); // Setup auto-update for CTE list
    setupSchemaInfoAutoUpdate(); // Now schemaInfoEditor is initialized for the direct call

    // Activate the first tab in each pane if not already set by HTML
    const firstLeftTab = document.querySelector('#left-pane .tab-button');
    if (firstLeftTab && !firstLeftTab.classList.contains('active')) {
        firstLeftTab.click();
    }
    const firstRightTab = document.querySelector('#right-pane .tab-button');
    if (firstRightTab && !firstRightTab.classList.contains('active')) {
        firstRightTab.click();
    }
});

/**
 * Updates the table list in the Analysis 1 tab based on the SQL input.
 * @param {string} sqlText - The SQL query string.
 */
// --- Table List Logic ---
function updateTableList(sqlText) {
    if (!tableList) return;
    tableList.innerHTML = ''; // Clear previous list

    if (!sqlText.trim()) {
        const li = document.createElement('li');
        li.textContent = '(SQL input is empty)';
        tableList.appendChild(li);
        return;
    }

    try {
        const ast = SelectQueryParser.parse(sqlText); // MODIFIED

        // find all table sources
        const collector = new TableSourceCollector(false); // MODIFIED
        const tables = collector.collect(ast);

        if (tables.length === 0) {
            const li = document.createElement('li');
            li.textContent = '(No tables found)';
            tableList.appendChild(li);
        } else {
            const uniqueTableNames = [...new Set(tables.map(t => t.table.name))];
            uniqueTableNames.forEach(tableName => {
                const li = document.createElement('li');
                li.textContent = tableName;
                tableList.appendChild(li);
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
        tableList.appendChild(li);
    }
}

function setupTableListAutoUpdate() {
    let tableListDebounceTimer = null;
    sqlInputEditor.on('changes', () => {
        if (tableListDebounceTimer) clearTimeout(tableListDebounceTimer);
        tableListDebounceTimer = setTimeout(() => updateTableList(sqlInputEditor.getValue()), DEBOUNCE_DELAY);
    });
    // Initial population
    updateTableList(sqlInputEditor.getValue());
}

// --- CTE List Logic ---
function updateCTEList(sqlText) {
    if (!cteList) return;
    cteList.innerHTML = '';
    if (!sqlText.trim()) {
        const li = document.createElement('li');
        li.textContent = '(SQL input is empty)';
        cteList.appendChild(li);
        return;
    }

    try {
        const query = SelectQueryParser.parse(sqlText); // MODIFIED
        const cteCollector = new CTECollector(); // MODIFIED
        const ctes = cteCollector.collect(query);
        if (ctes.length > 0) {
            ctes.forEach(cte => {
                const listItem = document.createElement('li');
                listItem.textContent = cte.getSourceAliasName();
                cteList.appendChild(listItem); // ADDED: Append to list
            });
        } else {
            const listItem = document.createElement('li');
            listItem.textContent = '(No CTEs found)';
            cteList.appendChild(listItem);
        }
    } catch (error) {
        console.error("Error collecting CTEs:", error);
        const listItem = document.createElement('li');
        let errorText = 'Error collecting CTEs.';
        if (error.name === 'ParseError' && error.message) {
            errorText = `(Parse Error: ${error.message.substring(0, 50)}...)`; // Keep it short
        }
        listItem.textContent = errorText;
        cteList.appendChild(listItem);
    }
}

function setupCTEListAutoUpdate() {
    let cteListDebounceTimer = null;
    sqlInputEditor.on('changes', () => {
        if (cteListDebounceTimer) clearTimeout(cteListDebounceTimer);
        cteListDebounceTimer = setTimeout(() => updateCTEList(sqlInputEditor.getValue()), DEBOUNCE_DELAY);
    });
    // Initial population
    updateCTEList(sqlInputEditor.getValue());
}

// --- Schema Info Logic ---
function updateSchemaInfo(sqlText) {
    if (!schemaInfoEditor) return; // Check for CodeMirror instance

    if (!sqlText.trim()) {
        schemaInfoEditor.setValue('(SQL input is empty)');
        schemaInfoEditor.refresh(); // Refresh CodeMirror
        return;
    }

    try {
        const query = SelectQueryParser.parse(sqlText); // MODIFIED
        const schemaCollector = new SchemaCollector(); // MODIFIED
        const schemaInfo = schemaCollector.collect(query);

        if (schemaInfo && schemaInfo.length > 0) {
            schemaInfoEditor.setValue(JSON.stringify(schemaInfo, null, 2));
        } else {
            schemaInfoEditor.setValue('(No schema information collected or schema is empty)');
        }
    } catch (error) {
        console.error("Error collecting schema info:", error);
        let errorMessage = 'Error collecting schema info.';
        if (error.name === 'ParseError' && error.message) {
            errorMessage = `Error parsing SQL for schema: ${error.message}`;
            if (error.details) { // Add line/column info if available
                errorMessage += `\\nAt line ${error.details.startLine}, column ${error.details.startColumn}. Found: '${error.details.found}'`;
            }
        } else if (error.message) {
            errorMessage = `Error collecting schema info: ${error.message}`;
        }
        schemaInfoEditor.setValue(errorMessage);
    }
    schemaInfoEditor.refresh(); // Refresh CodeMirror
}

function setupSchemaInfoAutoUpdate() {
    let schemaInfoDebounceTimer = null;
    sqlInputEditor.on('changes', () => {
        if (schemaInfoDebounceTimer) clearTimeout(schemaInfoDebounceTimer);
        schemaInfoDebounceTimer = setTimeout(() => {
            const sqlText = sqlInputEditor.getValue();
            // updateTableList and updateCTEList are handled by their own setup functions
            updateSchemaInfo(sqlText); // Update schema info
        }, DEBOUNCE_DELAY);
    });
    // Initial population
    updateSchemaInfo(sqlInputEditor.getValue());
}
