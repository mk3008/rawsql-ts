// Import rawsql-ts modules
import { SelectQueryParser, SqlFormatter, TableSourceCollector, CTECollector, SchemaCollector } from "https://unpkg.com/rawsql-ts/dist/esm/index.min.js";
// Import style configuration module
import { initStyleConfig, loadStyles as loadStylesFromModule, saveStylesAndFormat, displayStyle as displayStyleFromModule, populateStyleSelect as populateStyleSelectFromModule, getCurrentStyles as getStylesFromModule, DEFAULT_STYLE_KEY as STYLE_CONFIG_DEFAULT_KEY } from './style-config.js';
// Import analysis features module
import { initAnalysisFeatures } from './analysis-features.js';

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

const DEFAULT_STYLE_KEY = STYLE_CONFIG_DEFAULT_KEY; // Use from module
let currentStyles = getStylesFromModule(); // Use from module

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
        currentStyles = getStylesFromModule(); // Ensure currentStyles is up-to-date

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
    // updateTableList(''); // Will be handled by analysis-features module via sqlInputEditor change
    // updateCTEList(''); // Will be handled by analysis-features module via sqlInputEditor change
    // updateSchemaInfo(''); // Will be handled by analysis-features module via sqlInputEditor change
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
    loadStylesFromModule();
}

function saveStyles() {
    saveStylesAndFormat();
}

function populateStyleSelect() {
    populateStyleSelectFromModule();
}

function displayStyle(styleName) {
    displayStyleFromModule(styleName);
}

// Function to set up event listeners for style controls
function setupStyleControls() {
    // Event listeners are now managed within style-config.js
    // This function will now primarily be for initializing the module
    // with necessary DOM elements and CodeMirror instances.
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Quick style select: change style for preview only
    const quickStyleSelect = document.getElementById('quick-style-select');
    // if (quickStyleSelect) { // This listener is now in style-config.js
    //     quickStyleSelect.addEventListener('change', () => {
    //         const selected = quickStyleSelect.value;
    //         if (selected && currentStyles[selected]) {
    //             styleSelect.value = selected;
    //             displayStyle(selected);
    //             formatSql();
    //         }
    //     });
    // }
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

    // Initialize style configuration module
    const styleElements = {
        styleSelect,
        styleNameInput,
        addNewStyleBtn,
        deleteStyleBtn,
        saveStyleBtn,
        resetAllSettingsBtn,
        revertStyleBtn
    };
    initStyleConfig(styleElements, styleJsonEditor, formatSql, updateStatusBar, quickStyleSelect);


    // Initialize tabs for both panes
    initializeTabs('left-pane');
    initializeTabs('right-pane');

    // Set initial SQL and load styles
    const initialSql = "SELECT\n    id,\n    name,\n    email\nFROM\n    users\nWHERE\n    status = :active\nORDER BY\n    created_at DESC;";
    sqlInputEditor.setValue(initialSql);

    loadStyles(); // Load styles first
    formatSql(); // Initial format

    // Initialize analysis features
    initAnalysisFeatures({
        sqlInputEditor: sqlInputEditor,
        tableList: tableList,
        cteList: cteList,
        schemaInfoEditor: schemaInfoEditor,
        debounceDelay: DEBOUNCE_DELAY
    });


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
