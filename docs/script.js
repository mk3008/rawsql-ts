// Import rawsql-ts modules
import { SelectQueryParser, SqlFormatter } from "https://unpkg.com/rawsql-ts/dist/esm/index.js";

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
    // Clear previous timer if any
    if (statusBar.timer) {
        clearTimeout(statusBar.timer);
    }
    if (!isError) { // Only reset to 'Ready' if it's not an error message
        statusBar.timer = setTimeout(() => {
            statusBar.textContent = 'Ready';
            statusBar.style.color = 'gray';
        }, 3000); // Reset after 3 seconds
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
            // Preview mode: Use current content of styleJsonEditor if valid
            try {
                const previewStyleJson = styleJsonEditor.getValue();
                if (previewStyleJson.trim()) {
                    formatOptions = JSON.parse(previewStyleJson);
                    updateStatusBar('Previewing with current style editor content.', false);
                } else {
                    // Editor is empty, try to use selected style from dropdown
                    const selectedStyleName = styleSelect.value;
                    if (selectedStyleName && currentStyles[selectedStyleName]) {
                        formatOptions = currentStyles[selectedStyleName];
                    }
                }
            } catch (e) {
                updateStatusBar(`Error in Style JSON (preview): \\${e.message}`, true);
                // Don't format if preview JSON is invalid, or use last known good/selected style
                // For now, let's prevent formatting with invalid JSON
                formattedSqlEditor.setValue("Invalid JSON in Style Editor. Cannot format SQL for preview.");
                return;
            }
        } else {
            // Normal mode: Use selected style from dropdown
            const selectedStyleName = styleSelect.value;
            if (selectedStyleName && currentStyles[selectedStyleName]) {
                formatOptions = currentStyles[selectedStyleName];
            }
        }

        const query = SelectQueryParser.parse(sqlText);
        const formatter = new SqlFormatter(formatOptions); // Use selected/parsed options
        const formattedSql = formatter.format(query).formattedSql;
        formattedSqlEditor.setValue(formattedSql);
        updateStatusBar('SQL formatted successfully.');
    } catch (error) {
        console.error("Error formatting SQL:", error);
        updateStatusBar(`Error formatting SQL: ${error.message}`, true);
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
    updateStatusBar('Input cleared.');
    sqlInputEditor.focus(); // Focus back to input
});

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

addNewStyleBtn.addEventListener('click', () => {
    const newStyleName = prompt("Enter a name for the new style:", "My Custom Style");
    if (newStyleName && newStyleName.trim() !== "") {
        if (currentStyles[newStyleName]) {
            alert("A style with this name already exists. Please choose a different name.");
            return;
        }
        // Create a new style based on the "Default" or the currently selected one
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
        // Select the first available style or clear inputs
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

    if (!originalStyleName) { // Should not happen if a style is always selected or being added
        alert("No style selected to save to. This is an unexpected error.");
        return;
    }

    // If name changed, check for conflicts and update key
    if (originalStyleName !== newStyleName) {
        if (currentStyles[newStyleName]) {
            alert(`A style named '${newStyleName}' already exists. Please choose a different name or delete the existing one first.`);
            return;
        }
        // Create new entry and delete old one
        currentStyles[newStyleName] = styleJson;
        delete currentStyles[originalStyleName];
        populateStyleSelect(); // Update dropdown with new name
        styleSelect.value = newStyleName; // Select the new name
    } else {
        // Just update the content for the existing name
        currentStyles[originalStyleName] = styleJson;
    }

    saveStyles(); // This will also re-format SQL
    displayStyle(newStyleName); // Refresh display, especially if name changed
    updateStatusBar(`Style '${newStyleName}' saved.`, false);
});


styleSelect.addEventListener('change', () => {
    const selectedStyleName = styleSelect.value;
    if (selectedStyleName) {
        // 記憶する
        localStorage.setItem('rawsql-selected-style', selectedStyleName);
        displayStyle(selectedStyleName);
        // quick-style-selectも同期
        const quickStyleSelect = document.getElementById('quick-style-select');
        if (quickStyleSelect) quickStyleSelect.value = selectedStyleName;
        formatSql();
    }
});
// quick-style-selectのイベントでも記憶する
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

// Event listener for Revert Changes button
if (revertStyleBtn) {
    revertStyleBtn.addEventListener('click', () => {
        const selectedStyleName = styleSelect.value;
        if (selectedStyleName && currentStyles[selectedStyleName]) {
            if (confirm("Are you sure you want to revert changes to the style \'" + selectedStyleName + "\'? Unsaved modifications in the editor will be lost.")) {
                displayStyle(selectedStyleName); // This will reload the saved state into the editor
                formatSql(); // Re-format SQL with the reverted style
                updateStatusBar(`Style '\\${selectedStyleName}' reverted to last saved state.`, false);
            }
        } else {
            alert("No style selected or style not found to revert.");
        }
    });
}

// Event listener for Reset All Settings button
if (resetAllSettingsBtn) {
    resetAllSettingsBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to reset all settings? Saved styles will be deleted.")) { // Changed to English
            localStorage.removeItem(DEFAULT_STYLE_KEY);
            currentStyles = {}; // Clear in-memory styles
            // Force loadStyles to re-create default and repopulate everything
            loadStyles();
            updateStatusBar('All settings have been reset.', false); // Changed to English
            // Optionally, switch to the first tab or a default view if needed
            const firstLeftTab = document.querySelector('#left-pane .tab-button');
            if (firstLeftTab) {
                firstLeftTab.click();
            }
        }
    });
}

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
                // Only format if the style-config tab is active
                const activeLeftTabButton = document.querySelector('#left-pane .tab-button.active');
                if (activeLeftTabButton && activeLeftTabButton.dataset.tab === 'style-config') {
                    formatSql();
                }
            }, DEBOUNCE_DELAY);
        });

    } else {
        console.error("style-json-editor textarea not found!");
    }

    // Initialize tabs for both panes
    initializeTabs('left-pane');
    initializeTabs('right-pane');

    // Set initial SQL and load styles
    const initialSql = "SELECT\n    id,\n    name,\n    email\nFROM\n    users\nWHERE\n    status = :active\nORDER BY\n    created_at DESC;";
    sqlInputEditor.setValue(initialSql);

    loadStyles(); // Load styles, which will also call formatSql

    // Ensure the correct tab is active and CodeMirror instances are refreshed
    // This is a bit of a belt-and-suspenders approach, but helps with initial load issues.
    const activeLeftTabButton = document.querySelector('#left-pane .tab-button.active');
    if (activeLeftTabButton) {
        const tabId = activeLeftTabButton.dataset.tab;
        if (tabId === 'input-sql' && sqlInputEditor) sqlInputEditor.refresh();
        if (tabId === 'style-config' && styleJsonEditor) styleJsonEditor.refresh();
    }

    const activeRightTabButton = document.querySelector('#right-pane .tab-button.active');
    if (activeRightTabButton) {
        const tabId = activeRightTabButton.dataset.tab;
        if (tabId === 'formatted' && formattedSqlEditor) formattedSqlEditor.refresh();
    }
});
