'use strict';

// Global variables for style config, managed within this module
const DEFAULT_STYLE_KEY = 'rawsql-formatter-styles-v2';
let currentStyles = {};

const DEFAULT_STYLE_BASE = {
    "indentSize": 4,
    "indentChar": "space",
    "newline": "lf",
    "keywordCase": "upper",
    "commaBreak": "before",
    "cteCommaBreak": "after",
    "valuesCommaBreak": "before",
    "andBreak": "before",
    "orBreak": "before",
    "joinOnBreak": "before",
    "joinConditionContinuationIndent": false,
    "exportComment": "full",
    "commentStyle": "block",
    "withClauseStyle": "standard",
    "parenthesesOneLine": true,
    "indentNestedParentheses": true,
    "betweenOneLine": true,
    "valuesOneLine": false,
    "joinOneLine": true,
    "caseOneLine": false,
    "subqueryOneLine": false,
    "insertColumnsOneLine": true,
    "whenOneLine": false,
    "oneLineMaxLength": 100,
    "joinConditionOrderByDeclaration": false,
    "orderByDefaultDirectionStyle": "omit",
    "constraintStyle": "postgres"
};

const DEFAULT_POSTGRES_STYLE = {
    ...DEFAULT_STYLE_BASE,
    "constraintStyle": "postgres",
    "identifierEscape": "quote",
    "identifierEscapeTarget": "minimal",
    "parameterSymbol": "$",
    "parameterStyle": "indexed",
    "sourceAliasStyle": "as",
    "castStyle": "postgres"
};

const DEFAULT_STYLES = {
    "Default": {
        ...DEFAULT_STYLE_BASE,
        "identifierEscape": "none",
        "identifierEscapeTarget": "all",
        "parameterSymbol": ":",
        "parameterStyle": "named",
        "sourceAliasStyle": "as",
        "castStyle": "standard"
    },
    "OneLiner": {
        "identifierEscape": "none",
        "identifierEscapeTarget": "all",
        "parameterSymbol": ":",
        "parameterStyle": "named",
        "keywordCase": "upper",
        "sourceAliasStyle": "as",
        "castStyle": "standard",
        "constraintStyle": "postgres",
        "orderByDefaultDirectionStyle": "omit"
    },
    "Postgres": {
        ...DEFAULT_POSTGRES_STYLE
    },
    "Postgres Minimal": {
        ...DEFAULT_POSTGRES_STYLE
    },
    "MySQL": {
        ...DEFAULT_STYLE_BASE,
        "identifierEscape": "backtick",
        "identifierEscapeTarget": "minimal",
        "parameterSymbol": "?",
        "parameterStyle": "anonymous",
        "sourceAliasStyle": "as",
        "castStyle": "standard",
        "constraintStyle": "mysql"
    },
    "MySQL Minimal": {
        ...DEFAULT_STYLE_BASE,
        "identifierEscape": "backtick",
        "identifierEscapeTarget": "minimal",
        "parameterSymbol": "?",
        "parameterStyle": "anonymous",
        "sourceAliasStyle": "as",
        "castStyle": "standard",
        "constraintStyle": "mysql"
    },
    "SQLServer": {
        ...DEFAULT_STYLE_BASE,
        "identifierEscape": "bracket",
        "identifierEscapeTarget": "minimal",
        "parameterSymbol": "@",
        "parameterStyle": "named",
        "sourceAliasStyle": "as",
        "castStyle": "standard",
        "constraintStyle": "postgres"
    },
    "SQLServer Minimal": {
        ...DEFAULT_STYLE_BASE,
        "identifierEscape": "bracket",
        "identifierEscapeTarget": "minimal",
        "parameterSymbol": "@",
        "parameterStyle": "named",
        "sourceAliasStyle": "as",
        "castStyle": "standard",
        "constraintStyle": "postgres"
    }
};

function cloneStyle(style) {
    return JSON.parse(JSON.stringify(style));
}

function inferStyleDefaults(name, style) {
    if (DEFAULT_STYLES[name]) {
        return DEFAULT_STYLES[name];
    }

    const identifierEscape = style?.identifierEscape ?? "none";
    const dialectDefaults =
        identifierEscape === "backtick"
            ? { constraintStyle: "mysql" }
            : identifierEscape === "quote" && style?.parameterSymbol === "$"
              ? { castStyle: "postgres", constraintStyle: "postgres" }
              : {};

    return {
        "identifierEscapeTarget": "all",
        "sourceAliasStyle": "as",
        "castStyle": "standard",
        "constraintStyle": "postgres",
        "orderByDefaultDirectionStyle": "omit",
        "insertColumnsOneLine": true,
        "whenOneLine": false,
        "oneLineMaxLength": 100,
        "joinOnBreak": "before",
        "joinConditionContinuationIndent": false,
        ...dialectDefaults
    };
}

function normalizeStyle(name, style) {
    return {
        ...cloneStyle(inferStyleDefaults(name, style)),
        ...style
    };
}

function createDefaultStyles() {
    return Object.fromEntries(
        Object.entries(DEFAULT_STYLES).map(([name, style]) => [name, cloneStyle(style)])
    );
}

function normalizeStyles(styles) {
    const normalized = {};
    for (const [name, style] of Object.entries(styles || {})) {
        normalized[name] = normalizeStyle(name, style);
    }

    for (const [name, style] of Object.entries(DEFAULT_STYLES)) {
        if (!normalized[name]) {
            normalized[name] = cloneStyle(style);
        }
    }

    return normalized;
}

// DOM elements and external functions - these will be initialized via initStyleConfig
let styleSelect, styleNameInput, addNewStyleBtn, deleteStyleBtn, saveStyleBtn, resetAllSettingsBtn, revertStyleBtn;
let styleJsonEditor;
let formatSqlFunction, updateStatusBarFunction;
let quickStyleSelectElementGlobal; // To store the quick style select element

let domFullyInitialized = false; // Flag to ensure DOM elements and CodeMirror are ready

function initStyleConfig(elements, editorInstance, formatterFunc, statusBarUpdaterFunc, quickStyleSelectElem) {
    styleSelect = elements.styleSelect;
    styleNameInput = elements.styleNameInput;
    addNewStyleBtn = elements.addNewStyleBtn;
    deleteStyleBtn = elements.deleteStyleBtn;
    saveStyleBtn = elements.saveStyleBtn;
    resetAllSettingsBtn = elements.resetAllSettingsBtn;
    revertStyleBtn = elements.revertStyleBtn;
    quickStyleSelectElementGlobal = quickStyleSelectElem;

    styleJsonEditor = editorInstance;
    formatSqlFunction = formatterFunc;
    updateStatusBarFunction = statusBarUpdaterFunc;

    // Attach event listeners that depend on these initializations
    if (styleSelect) {
        styleSelect.addEventListener('change', handleStyleSelectChange);
    }
    if (quickStyleSelectElementGlobal) {
        quickStyleSelectElementGlobal.addEventListener('change', handleQuickStyleSelectChange);
    }
    if (addNewStyleBtn) addNewStyleBtn.addEventListener('click', handleAddNewStyle);
    if (deleteStyleBtn) deleteStyleBtn.addEventListener('click', handleDeleteStyle);
    if (saveStyleBtn) saveStyleBtn.addEventListener('click', handleSaveStyle);
    if (revertStyleBtn) revertStyleBtn.addEventListener('click', handleRevertStyle);
    if (resetAllSettingsBtn) resetAllSettingsBtn.addEventListener('click', handleResetAllSettings);

    domFullyInitialized = true; // Mark as initialized
    console.log("Style config initialized with all dependencies.");
}

function loadStylesData() {
    const storedStyles = localStorage.getItem(DEFAULT_STYLE_KEY);
    if (storedStyles) {
        currentStyles = normalizeStyles(JSON.parse(storedStyles));
        localStorage.setItem(DEFAULT_STYLE_KEY, JSON.stringify(currentStyles));
    } else {
        currentStyles = createDefaultStyles();
        localStorage.setItem(DEFAULT_STYLE_KEY, JSON.stringify(currentStyles));
    }
}

function loadStyles() {
    loadStylesData();

    if (!domFullyInitialized) {
        console.warn("loadStyles called before style system is fully initialized.");
        return;
    }

    populateStyleSelect();

    let lastStyle = localStorage.getItem('rawsql-selected-style');
    if (styleSelect && lastStyle && currentStyles[lastStyle]) {
        styleSelect.value = lastStyle;
    } else if (styleSelect && Object.keys(currentStyles).length > 0) {
        const firstStyleName = Object.keys(currentStyles)[0];
        styleSelect.value = firstStyleName;
    }

    if (styleSelect && styleSelect.value) {
        displayStyle(styleSelect.value);
    }

    if (quickStyleSelectElementGlobal && styleSelect && styleSelect.value) {
        quickStyleSelectElementGlobal.value = styleSelect.value;
    }

    if (typeof formatSqlFunction === 'function') {
        formatSqlFunction();
    }
    console.log("Styles loaded and UI updated.");
}

function getCurrentStyles() {
    return currentStyles;
}

function populateSelectWithStyles(selectElement) {
    if (!selectElement) return;
    selectElement.innerHTML = '';
    Object.keys(currentStyles).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        selectElement.appendChild(option);
    });
}

function populateStyleSelect() {
    populateSelectWithStyles(styleSelect);
    populateSelectWithStyles(quickStyleSelectElementGlobal);
}

function displayStyle(styleName) {
    if (!currentStyles[styleName]) return;
    const style = currentStyles[styleName];
    if (styleNameInput) styleNameInput.value = styleName;
    if (styleJsonEditor) {
        styleJsonEditor.setValue(JSON.stringify(style, null, 4));
    }
}

function saveStylesAndFormat() {
    localStorage.setItem(DEFAULT_STYLE_KEY, JSON.stringify(currentStyles));
    if (typeof formatSqlFunction === 'function') {
        formatSqlFunction();
    }
}

export {
    initStyleConfig,
    loadStyles,
    loadStylesData, // Exported
    saveStylesAndFormat,
    populateStyleSelect,
    displayStyle,
    DEFAULT_STYLE_KEY,
    getCurrentStyles
};

function handleStyleSelectChange() {
    if (!styleSelect) return;
    const selectedStyleName = styleSelect.value;
    if (selectedStyleName) {
        localStorage.setItem('rawsql-selected-style', selectedStyleName);
        displayStyle(selectedStyleName);
        if (quickStyleSelectElementGlobal) quickStyleSelectElementGlobal.value = selectedStyleName;
        if (typeof formatSqlFunction === 'function') formatSqlFunction();
    }
}

function handleQuickStyleSelectChange(event) {
    const selected = event.target.value;
    if (selected && currentStyles[selected]) {
        if (styleSelect) styleSelect.value = selected;
        localStorage.setItem('rawsql-selected-style', selected);
        displayStyle(selected);
        if (typeof formatSqlFunction === 'function') formatSqlFunction();
    }
}

function handleAddNewStyle() {
    const newStyleName = prompt("Enter a name for the new style:", "My Custom Style");
    if (newStyleName && newStyleName.trim() !== "") {
        if (currentStyles[newStyleName]) {
            alert("A style with this name already exists. Please choose a different name.");
            return;
        }
        const baseStyleName = styleSelect && styleSelect.value ? styleSelect.value : Object.keys(currentStyles)[0] || "Default";
        const baseStyle = currentStyles[baseStyleName] ? JSON.parse(JSON.stringify(currentStyles[baseStyleName])) : { indentSize: 4, indentChar: " ", keywordCase: "upper" };
        currentStyles[newStyleName] = baseStyle;
        populateStyleSelect();
        if (styleSelect) styleSelect.value = newStyleName;
        displayStyle(newStyleName);
        saveStylesAndFormat();
        if (typeof updateStatusBarFunction === 'function') updateStatusBarFunction(`Style '${newStyleName}' added.`, false);
    }
}

function handleDeleteStyle() {
    if (!styleSelect) return;
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
            if (styleNameInput) styleNameInput.value = '';
            if (styleJsonEditor) styleJsonEditor.setValue('');
        }
        saveStylesAndFormat();
        if (typeof updateStatusBarFunction === 'function') updateStatusBarFunction(`Style '${selectedStyleName}' deleted.`, false);
    }
}

function handleSaveStyle() {
    if (!styleSelect || !styleNameInput || !styleJsonEditor) return;
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
        if (typeof updateStatusBarFunction === 'function') updateStatusBarFunction("Error: Invalid JSON in style configuration.", true);
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
    saveStylesAndFormat();
    displayStyle(newStyleName);
    if (typeof updateStatusBarFunction === 'function') updateStatusBarFunction(`Style '${newStyleName}' saved.`, false);
}

function handleRevertStyle() {
    if (!styleSelect) return;
    const selectedStyleName = styleSelect.value;
    if (selectedStyleName && currentStyles[selectedStyleName]) {
        if (confirm("Are you sure you want to revert changes to the style '" + selectedStyleName + "'? Unsaved modifications in the editor will be lost.")) {
            displayStyle(selectedStyleName);
            if (typeof formatSqlFunction === 'function') formatSqlFunction();
            if (typeof updateStatusBarFunction === 'function') updateStatusBarFunction(`Style '${selectedStyleName}' reverted to last saved state.`, false);
        }
    } else {
        alert("No style selected or style not found to revert.");
    }
}

function handleResetAllSettings() {
    if (confirm("Are you sure you want to reset all settings? Saved styles will be deleted.")) {
        localStorage.removeItem(DEFAULT_STYLE_KEY);
        localStorage.removeItem('rawsql-selected-style');
        currentStyles = {};
        loadStyles();
        if (typeof updateStatusBarFunction === 'function') updateStatusBarFunction('All settings have been reset.', false);

        const firstLeftTab = document.querySelector('#left-pane .tab-button');
        if (firstLeftTab) {
            firstLeftTab.click();
        }
    }
}
