'use strict';

// Global variables for style config, managed within this module
const DEFAULT_STYLE_KEY = 'rawsql-formatter-styles-v2';
let currentStyles = {};

// DOM elements and external functions - these will be initialized via initStyleConfig
let styleSelect, styleNameInput, addNewStyleBtn, deleteStyleBtn, saveStyleBtn, resetAllSettingsBtn, revertStyleBtn;
let styleJsonEditor;
let formatSqlFunction, updateStatusBarFunction;
let quickStyleSelectElementGlobal; // To store the quick style select element
let styleGuiContainer;
let styleConfigTabs;
let styleConfigEditPane;
let styleConfigJsonPane;
let isSyncingStyleGui = false;
let syncGuiTimer = null;
let previewFormatTimer = null;

let domFullyInitialized = false; // Flag to ensure DOM elements and CodeMirror are ready

const STYLE_CONTROL_GROUPS = [
    {
        title: 'Basics',
        controls: [
            { key: 'keywordCase', label: 'Keyword case', type: 'select', options: ['preserve', 'lower', 'upper'] },
            { key: 'identifierEscape', label: 'Identifier escape', type: 'select', options: ['none', 'quote', 'backtick', 'bracket'] },
            { key: 'identifierEscapeMode', label: 'Identifier escape mode', type: 'select', options: ['all', 'minimal'] },
            { key: 'parameterSymbol', label: 'Parameter symbol', type: 'select', options: [':', '$', '@', '?'] },
            { key: 'parameterStyle', label: 'Parameter style', type: 'select', options: ['named', 'indexed', 'anonymous'] },
            { key: 'indentSize', label: 'Indent size', type: 'number', min: 0, max: 12, step: 1 },
            { key: 'newline', label: 'Newline', type: 'select', options: ['lf', 'crlf'] }
        ]
    },
    {
        title: 'Breaks',
        controls: [
            { key: 'commaBreak', label: 'SELECT comma', type: 'select', options: ['none', 'before', 'after'] },
            { key: 'cteCommaBreak', label: 'CTE comma', type: 'select', options: ['none', 'before', 'after'] },
            { key: 'valuesCommaBreak', label: 'VALUES comma', type: 'select', options: ['none', 'before', 'after'] },
            { key: 'andBreak', label: 'AND break', type: 'select', options: ['none', 'before', 'after'] },
            { key: 'orBreak', label: 'OR break', type: 'select', options: ['none', 'before', 'after'] },
            { key: 'joinOnBreak', label: 'JOIN ON break', type: 'select', options: ['none', 'before', 'after'] },
            { key: 'joinConditionContinuationIndent', label: 'Indent JOIN conditions', type: 'checkbox' },
            { key: 'joinConditionOrderByDeclaration', label: 'JOIN condition declaration order', type: 'checkbox' }
        ]
    },
    {
        title: 'Comments',
        controls: [
            { key: 'exportComment', label: 'Export comments', type: 'select', options: ['none', 'full', 'true', 'false'] },
            { key: 'commentStyle', label: 'Comment style', type: 'select', options: ['block', 'line'] }
        ]
    },
    {
        title: 'Other',
        controls: [
            { key: 'withClauseStyle', label: 'WITH style', type: 'select', options: ['standard', 'cte-oneline', 'full-oneline'] }
        ]
    },
    {
        title: 'One-line Rules',
        controls: [
            { key: 'parenthesesOneLine', label: 'Parentheses', type: 'checkbox' },
            { key: 'indentNestedParentheses', label: 'Indent nested parentheses', type: 'checkbox' },
            { key: 'betweenOneLine', label: 'BETWEEN', type: 'checkbox' },
            { key: 'valuesOneLine', label: 'VALUES', type: 'checkbox' },
            { key: 'joinOneLine', label: 'JOIN', type: 'checkbox' },
            { key: 'caseOneLine', label: 'CASE', type: 'checkbox' },
            { key: 'subqueryOneLine', label: 'Subquery', type: 'checkbox' },
            { key: 'insertColumnsOneLine', label: 'INSERT columns', type: 'checkbox' },
            { key: 'whenOneLine', label: 'MERGE WHEN', type: 'checkbox' }
        ]
    }
];

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
    createStyleGuiControls();
    if (styleJsonEditor && typeof styleJsonEditor.on === 'function') {
        styleJsonEditor.on('changes', scheduleStyleGuiSyncFromJson);
    }

    domFullyInitialized = true; // Mark as initialized
    console.log("Style config initialized with all dependencies.");
}

function loadStylesData() {
    const storedStyles = localStorage.getItem(DEFAULT_STYLE_KEY);
    if (storedStyles) {
        currentStyles = JSON.parse(storedStyles);
    } else {
        currentStyles = {
            "Default": {
                "identifierEscape": "none",
                "identifierEscapeMode": "all",
                "parameterSymbol": ":",
                "parameterStyle": "named",
                "indentSize": 4,
                "indentChar": "space",
                "newline": "lf",
                "keywordCase": "lower",
                "commaBreak": "before",
                "valuesCommaBreak": "before",
                "andBreak": "before",
                "orBreak": "before",
                "exportComment": true,
                "commentStyle": "block",
                "withClauseStyle": "standard",
                "parenthesesOneLine": true,
                "indentNestedParentheses": true,
                "betweenOneLine": true,
                "valuesOneLine": false,
                "joinOneLine": true,
                "caseOneLine": false,
                "subqueryOneLine": false,
                "joinConditionOrderByDeclaration": false
            },
            "OneLiner": {
                "identifierEscape": "none",
                "identifierEscapeMode": "all",
                "parameterSymbol": ":",
                "parameterStyle": "named",
                "keywordCase": "lower"
            },
            "Postgres": {
                "identifierEscape": "quote",
                "identifierEscapeMode": "all",
                "parameterSymbol": "$",
                "parameterStyle": "indexed",
                "indentSize": 4,
                "indentChar": "space",
                "newline": "lf",
                "keywordCase": "upper",
                "commaBreak": "before",
                "valuesCommaBreak": "before",
                "andBreak": "before",
                "orBreak": "before",
                "exportComment": true,
                "commentStyle": "block",
                "withClauseStyle": "standard",
                "parenthesesOneLine": true,
                "indentNestedParentheses": true,
                "betweenOneLine": true,
                "valuesOneLine": false,
                "joinOneLine": true,
                "caseOneLine": false,
                "subqueryOneLine": false,
                "joinConditionOrderByDeclaration": false
            },
            "MySQL": {
                "identifierEscape": "backtick",
                "identifierEscapeMode": "all",
                "parameterSymbol": "?",
                "parameterStyle": "anonymous",
                "indentSize": 4,
                "indentChar": "space",
                "newline": "lf",
                "keywordCase": "upper",
                "commaBreak": "before",
                "valuesCommaBreak": "before",
                "andBreak": "before",
                "orBreak": "before",
                "exportComment": true,
                "commentStyle": "block",
                "withClauseStyle": "standard",
                "parenthesesOneLine": true,
                "indentNestedParentheses": true,
                "betweenOneLine": true,
                "valuesOneLine": false,
                "joinOneLine": true,
                "caseOneLine": false,
                "subqueryOneLine": false,
                "joinConditionOrderByDeclaration": false
            },
            "SQLServer": {
                "identifierEscape": "bracket",
                "identifierEscapeMode": "all",
                "parameterSymbol": "@",
                "parameterStyle": "named",
                "indentSize": 4,
                "indentChar": "space",
                "newline": "lf",
                "keywordCase": "upper",
                "commaBreak": "before",
                "valuesCommaBreak": "before",
                "andBreak": "before",
                "orBreak": "before",
                "exportComment": true,
                "commentStyle": "block",
                "withClauseStyle": "standard",
                "parenthesesOneLine": true,
                "indentNestedParentheses": true,
                "betweenOneLine": true,
                "valuesOneLine": false,
                "joinOneLine": true,
                "caseOneLine": false,
                "subqueryOneLine": false,
                "joinConditionOrderByDeclaration": false
            }
        };
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
    const styles = { ...currentStyles };
    const selectedStyleName = styleSelect?.value;
    const previewStyle = getPreviewStyleFromEditor();
    if (selectedStyleName && previewStyle) {
        styles[selectedStyleName] = previewStyle;
    }
    return styles;
}

function getPreviewStyleFromEditor() {
    if (!styleJsonEditor) return null;
    try {
        return JSON.parse(styleJsonEditor.getValue() || '{}');
    } catch {
        return null;
    }
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

function createStyleGuiControls() {
    if (styleGuiContainer) return;
    const textarea = document.getElementById('style-json-editor');
    const form = textarea?.closest('.style-editor-form');
    if (!form) return;

    styleGuiContainer = document.createElement('div');
    styleGuiContainer.className = 'style-gui-panel';

    for (const group of STYLE_CONTROL_GROUPS) {
        const section = document.createElement('section');
        section.className = 'style-gui-section';

        const heading = document.createElement('h4');
        heading.textContent = group.title;
        section.appendChild(heading);

        if (group.description) {
            const description = document.createElement('p');
            description.className = 'style-gui-section-description';
            description.textContent = group.description;
            section.appendChild(description);
        }

        const grid = document.createElement('div');
        grid.className = 'style-gui-grid';

        for (const control of group.controls) {
            grid.appendChild(createStyleControl(control));
        }

        section.appendChild(grid);
        styleGuiContainer.appendChild(section);
    }

    const jsonLabel = form.querySelector('label[for="style-json-editor"]');
    const editorWrapper = styleJsonEditor?.getWrapperElement?.();

    styleConfigTabs = document.createElement('div');
    styleConfigTabs.className = 'style-config-tabs';

    const tabList = document.createElement('div');
    tabList.className = 'style-config-tab-list';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'style-config-tab-btn active';
    editButton.dataset.styleConfigTab = 'edit';
    editButton.textContent = 'Edit';

    const jsonButton = document.createElement('button');
    jsonButton.type = 'button';
    jsonButton.className = 'style-config-tab-btn';
    jsonButton.dataset.styleConfigTab = 'json';
    jsonButton.textContent = 'JSON';

    tabList.appendChild(editButton);
    tabList.appendChild(jsonButton);

    styleConfigEditPane = document.createElement('div');
    styleConfigEditPane.className = 'style-config-tab-pane active';
    styleConfigEditPane.dataset.styleConfigPane = 'edit';
    styleConfigEditPane.appendChild(styleGuiContainer);

    styleConfigJsonPane = document.createElement('div');
    styleConfigJsonPane.className = 'style-config-tab-pane';
    styleConfigJsonPane.dataset.styleConfigPane = 'json';
    if (jsonLabel) {
        styleConfigJsonPane.appendChild(jsonLabel);
    }
    if (editorWrapper) {
        styleConfigJsonPane.appendChild(editorWrapper);
    } else if (textarea) {
        styleConfigJsonPane.appendChild(textarea);
    }

    styleConfigTabs.appendChild(tabList);
    styleConfigTabs.appendChild(styleConfigEditPane);
    styleConfigTabs.appendChild(styleConfigJsonPane);

    tabList.addEventListener('click', handleStyleConfigTabClick);

    form.insertBefore(styleConfigTabs, textarea);
}

function handleStyleConfigTabClick(event) {
    const button = event.target.closest('.style-config-tab-btn');
    if (!button || !styleConfigTabs) return;

    const target = button.dataset.styleConfigTab;
    for (const tabButton of styleConfigTabs.querySelectorAll('.style-config-tab-btn')) {
        tabButton.classList.toggle('active', tabButton === button);
    }
    for (const pane of styleConfigTabs.querySelectorAll('.style-config-tab-pane')) {
        pane.classList.toggle('active', pane.dataset.styleConfigPane === target);
    }

    if (target === 'json' && styleJsonEditor) {
        requestAnimationFrame(() => styleJsonEditor.refresh());
    }
}

function createStyleControl(control) {
    const wrapper = document.createElement('label');
    wrapper.className = control.type === 'checkbox' ? 'style-gui-field style-gui-checkbox' : 'style-gui-field';
    wrapper.dataset.styleKey = control.key;

    const labelText = document.createElement('span');
    labelText.textContent = control.label;
    wrapper.appendChild(labelText);

    let input;
    if (control.type === 'select') {
        input = document.createElement('select');
        for (const optionValue of control.options) {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            input.appendChild(option);
        }
    } else {
        input = document.createElement('input');
        input.type = control.type;
        if (control.type === 'number') {
            input.min = String(control.min ?? 0);
            input.max = String(control.max ?? 99);
            input.step = String(control.step ?? 1);
        }
    }

    input.dataset.styleKey = control.key;
    input.dataset.valueType = control.type;
    input.addEventListener('change', handleStyleGuiInputChange);
    if (control.type === 'number') {
        input.addEventListener('input', handleStyleGuiInputChange);
    }
    wrapper.appendChild(input);

    return wrapper;
}

function scheduleStyleGuiSyncFromJson() {
    if (isSyncingStyleGui) return;
    if (syncGuiTimer) {
        clearTimeout(syncGuiTimer);
    }
    syncGuiTimer = setTimeout(() => {
        const isValid = syncStyleGuiFromEditor();
        if (isValid) {
            schedulePreviewFormat();
        }
    }, 150);
}

function syncStyleGuiFromEditor() {
    if (!styleGuiContainer || !styleJsonEditor) return false;
    let style;
    try {
        style = JSON.parse(styleJsonEditor.getValue());
    } catch {
        styleGuiContainer.classList.add('style-gui-invalid');
        return false;
    }

    styleGuiContainer.classList.remove('style-gui-invalid');
    isSyncingStyleGui = true;
    try {
        for (const input of styleGuiContainer.querySelectorAll('[data-style-key] input, [data-style-key] select')) {
            const key = input.dataset.styleKey;
            const value = style[key];
            if (input.type === 'checkbox') {
                input.checked = Boolean(value);
                input.indeterminate = typeof value === 'undefined';
            } else if (typeof value === 'undefined') {
                input.value = '';
            } else {
                input.value = String(value);
            }
        }
    } finally {
        isSyncingStyleGui = false;
    }
    return true;
}

function schedulePreviewFormat() {
    if (previewFormatTimer) {
        clearTimeout(previewFormatTimer);
    }
    previewFormatTimer = setTimeout(applyPreviewFormat, 80);
}

function applyPreviewFormat() {
    previewFormatTimer = null;
    if (!getPreviewStyleFromEditor()) return;
    if (typeof formatSqlFunction === 'function') {
        formatSqlFunction();
    }
}

function handleStyleGuiInputChange(event) {
    if (isSyncingStyleGui || !styleJsonEditor) return;
    const input = event.currentTarget;
    const key = input.dataset.styleKey;
    if (!key) return;

    let style;
    try {
        style = JSON.parse(styleJsonEditor.getValue() || '{}');
    } catch (error) {
        alert("Invalid JSON in style configuration. Please correct it before using the visual controls.\nError: " + error.message);
        syncStyleGuiFromEditor();
        return;
    }

    if (input.type === 'checkbox') {
        style[key] = input.checked;
    } else if (input.type === 'number') {
        const value = Number(input.value);
        if (!Number.isFinite(value)) return;
        style[key] = value;
    } else if (input.value === 'true') {
        style[key] = true;
    } else if (input.value === 'false') {
        style[key] = false;
    } else {
        style[key] = input.value;
    }

    isSyncingStyleGui = true;
    try {
        styleJsonEditor.setValue(JSON.stringify(style, null, 4));
    } finally {
        isSyncingStyleGui = false;
    }
    syncStyleGuiFromEditor();
    applyPreviewFormat();
    if (typeof updateStatusBarFunction === 'function') {
        updateStatusBarFunction('Preview updated. Save to keep this style.', false);
    }
}

function displayStyle(styleName) {
    if (!currentStyles[styleName]) return;
    const style = currentStyles[styleName];
    if (styleNameInput) styleNameInput.value = styleName;
    if (styleJsonEditor) {
        styleJsonEditor.setValue(JSON.stringify(style, null, 4));
    }
    syncStyleGuiFromEditor();
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
