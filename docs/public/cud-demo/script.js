// Default formatting options matching the main demo
const defaultFormatOptions = {
    "identifierEscape": "none",
    "parameterSymbol": ":",
    "parameterStyle": "named",
    "indentSize": 4,
    "keywordCase": "lower",
    "identifierCase": "preserve",
    "expressionWidth": 50,
    "lineWrapping": false
};

// Initialize CodeMirror editors immediately
const sqlInputEditor = CodeMirror.fromTextArea(document.getElementById('sql-input'), {
    mode: 'text/x-pgsql',
    lineNumbers: true,
    theme: 'dracula',
    lineWrapping: false
});

const formattedSqlEditor = CodeMirror.fromTextArea(document.getElementById('formatted-sql'), {
    mode: 'text/x-pgsql',
    lineNumbers: true,
    theme: 'dracula',
    readOnly: true,
    lineWrapping: false
});

const fixtureEditor = CodeMirror.fromTextArea(document.getElementById('fixture-input'), {
    mode: 'application/json',
    lineNumbers: true,
    theme: 'dracula',
    lineWrapping: false
});

const styleJsonEditor = CodeMirror.fromTextArea(document.getElementById('style-json-editor'), {
    mode: 'application/json',
    lineNumbers: true,
    theme: 'dracula',
    lineWrapping: false
});

// Expose editors to window for testing
window.sqlInputEditor = sqlInputEditor;
window.formattedSqlEditor = formattedSqlEditor;
window.fixtureEditor = fixtureEditor;
window.styleJsonEditor = styleJsonEditor;

// Tab switching logic
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');

        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        tabContents.forEach(c => {
            if (c.getAttribute('data-tab') === target) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });

        // Refresh CodeMirror instances when tab becomes visible
        if (target === 'sql') {
            sqlInputEditor.refresh();
        } else if (target === 'fixture') {
            fixtureEditor.refresh();
        } else if (target === 'style') {
            styleJsonEditor.refresh();
        }
    });
});

function updateStatusBar(message, isError = false) {
    const statusBar = document.getElementById('status-bar');
    statusBar.textContent = message;
    statusBar.className = isError ? 'error' : '';
}

// Global variable to hold the loaded module
let rawSqlModule = null;
let styleConfigModule = null;

// Load rawsql-ts module dynamically
async function loadModule() {
    try {
        updateStatusBar('Loading modules...');

        // Load rawsql-ts
        rawSqlModule = await import('../demo/vendor/rawsql.browser.js');

        // Load style-config
        styleConfigModule = await import('../demo/style-config.js');

        // Initialize style config
        initStyleConfig();

        updateStatusBar('Ready');
        // Trigger initial conversion
        convertAndFormat();
    } catch (e) {
        console.error("Failed to load modules:", e);
        updateStatusBar('Error: Failed to load modules. Check console for details.', true);
    }
}

function initStyleConfig() {
    if (!styleConfigModule) return;

    const elements = {
        styleSelect: document.getElementById('style-select'),
        styleNameInput: document.getElementById('style-name-input'),
        addNewStyleBtn: document.getElementById('add-new-style-btn'),
        deleteStyleBtn: document.getElementById('delete-style-btn'),
        saveStyleBtn: document.getElementById('save-style-btn'),
        resetAllSettingsBtn: document.getElementById('reset-all-settings-btn'),
        revertStyleBtn: document.getElementById('revert-style-btn')
    };

    // We don't have a quick style select in the header for this demo, pass a dummy element
    const quickStyleSelectElem = document.createElement('select');

    styleConfigModule.initStyleConfig(
        elements,
        styleJsonEditor,
        convertAndFormat, // formatterFunc
        updateStatusBar, // statusBarUpdaterFunc
        quickStyleSelectElem
    );

    styleConfigModule.loadStyles();
}

// Sample data
const samples = {
    single: {
        sql: `INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com') RETURNING *;
UPDATE users SET name = 'Bob' WHERE id = 1 RETURNING *;
SELECT * FROM users WHERE id = 1;`,
        fixture: `{
  "users": {
    "columns": [
      { "name": "id", "type": "integer", "primaryKey": true },
      { "name": "name", "type": "text" },
      { "name": "email", "type": "text" },
      { "name": "created_at", "type": "timestamp" }
    ]
  }
}`
    },
    multi: {
        sql: `INSERT INTO users (name, email) VALUES ('Charlie', 'charlie@example.com') RETURNING id;
INSERT INTO posts (user_id, title, content) VALUES (1, 'Hello World', 'This is my first post') RETURNING *;
SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id;`,
        fixture: `{
  "users": {
    "columns": [
      { "name": "id", "type": "integer", "primaryKey": true },
      { "name": "name", "type": "text" },
      { "name": "email", "type": "text" }
    ]
  },
  "posts": {
    "columns": [
      { "name": "id", "type": "integer", "primaryKey": true },
      { "name": "user_id", "type": "integer" },
      { "name": "title", "type": "text" },
      { "name": "content", "type": "text" }
    ]
  },
  "comments": {
    "columns": [
      { "name": "id", "type": "integer", "primaryKey": true },
      { "name": "post_id", "type": "integer" },
      { "name": "content", "type": "text" }
    ]
  }
}`
    }
};

// Sample loader
const sampleLoader = document.getElementById('sample-loader');
sampleLoader.addEventListener('change', (e) => {
    const value = e.target.value;
    if (value && samples[value]) {
        sqlInputEditor.setValue(samples[value].sql);
        fixtureEditor.setValue(samples[value].fixture);
        // Trigger conversion
        convertAndFormat();
    }
});

function buildFixtureTables(tableDefinitions) {
    const fixtures = [];
    if (!tableDefinitions || typeof tableDefinitions !== 'object') return fixtures;

    for (const [tableName, def] of Object.entries(tableDefinitions)) {
        if (def && Array.isArray(def.columns)) {
            fixtures.push({
                tableName: tableName,
                columns: def.columns.map(c => ({ name: c.name, typeName: c.type })),
                rows: [] // Empty rows to create empty result set
            });
        }
    }
    return fixtures;
}

function convertAndFormat() {
    if (!rawSqlModule) {
        return;
    }

    const {
        SqlParser,
        SqlFormatter,
        MultiQuerySplitter,
        InsertResultSelectConverter,
        UpdateResultSelectConverter,
        DeleteResultSelectConverter,
        MergeResultSelectConverter,
        SelectResultSelectConverter,
        InsertQuery,
        UpdateQuery,
        DeleteQuery,
        MergeQuery
    } = rawSqlModule;

    const sqlText = sqlInputEditor.getValue();
    if (!sqlText.trim()) {
        formattedSqlEditor.setValue('');
        updateStatusBar('Ready');
        return;
    }

    // Determine format options
    let formatOptions = defaultFormatOptions;
    if (styleConfigModule) {
        const currentStyles = styleConfigModule.getCurrentStyles();
        const styleSelect = document.getElementById('style-select');
        if (styleSelect && styleSelect.value && currentStyles[styleSelect.value]) {
            formatOptions = currentStyles[styleSelect.value];
        }
    }

    // Parse fixture JSON
    let tableDefinitions = null;
    let fixtureTables = [];
    if (fixtureEditor) {
        const fixtureText = fixtureEditor.getValue().trim();
        if (fixtureText) {
            try {
                tableDefinitions = JSON.parse(fixtureText);
                if (tableDefinitions && typeof tableDefinitions === 'object') {
                    for (const [tableName, def] of Object.entries(tableDefinitions)) {
                        if (def && typeof def === 'object' && !def.name) {
                            def.name = tableName;
                        }
                    }
                }
                fixtureTables = buildFixtureTables(tableDefinitions);
            } catch (e) {
                console.warn('Invalid fixture JSON:', e);
                updateStatusBar('Warning: Invalid fixture JSON', true);
            }
        }
    }

    try {
        const splitResult = MultiQuerySplitter.split(sqlText);
        const segments = [];
        const formatter = new SqlFormatter(formatOptions);

        for (const query of splitResult.queries) {
            if (query.isEmpty) continue;

            try {
                const ast = SqlParser.parse(query.sql);
                let convertedAst = ast;

                const options = {
                    missingFixtureStrategy: 'passthrough',
                    tableDefinitions: tableDefinitions,
                    fixtureTables: fixtureTables
                };

                if (ast instanceof InsertQuery) {
                    convertedAst = InsertResultSelectConverter.toSelectQuery(ast, options);
                } else if (ast instanceof UpdateQuery) {
                    convertedAst = UpdateResultSelectConverter.toSelectQuery(ast, options);
                } else if (ast instanceof DeleteQuery) {
                    convertedAst = DeleteResultSelectConverter.toSelectQuery(ast, options);
                } else if (ast instanceof MergeQuery) {
                    convertedAst = MergeResultSelectConverter.toSelectQuery(ast, options);
                } else if (ast.__selectQueryType === 'SelectQuery') {
                    if (SelectResultSelectConverter) {
                        convertedAst = SelectResultSelectConverter.toSelectQuery(ast, options);
                    }
                }

                const { formattedSql } = formatter.format(convertedAst);
                segments.push(formattedSql + '\n;');
            } catch (e) {
                console.error("Error processing statement:", e);
                segments.push(`/* Error processing statement: ${e.message} */\n${query.sql}`);
            }
        }

        formattedSqlEditor.setValue(segments.join('\n\n'));
        updateStatusBar('Conversion successful');
    } catch (e) {
        console.error("Global error:", e);
        updateStatusBar('Error: ' + e.message, true);
    }
}

let debounceTimer = null;
sqlInputEditor.on('changes', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(convertAndFormat, 500);
});

fixtureEditor.on('changes', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(convertAndFormat, 500);
});

document.getElementById('clear-input-btn').addEventListener('click', () => {
    sqlInputEditor.setValue('');
    fixtureEditor.setValue('');
    formattedSqlEditor.setValue('');
    sqlInputEditor.focus();
});

document.getElementById('copy-output-btn').addEventListener('click', () => {
    const text = formattedSqlEditor.getValue();
    if (text) {
        navigator.clipboard.writeText(text).then(() => {
            updateStatusBar('Copied to clipboard');
        });
    }
});

const initialSql = `INSERT INTO users (id, name, email, created_at) 
VALUES (1, 'Alice', 'alice@example.com', '2023-01-01') 
RETURNING id, name, created_at;

UPDATE users 
SET email = 'alice.new@example.com' 
WHERE id = 1 
RETURNING *;

SELECT * FROM users WHERE id = 1;`;

const initialFixture = samples.single.fixture;

sqlInputEditor.setValue(initialSql);
fixtureEditor.setValue(initialFixture);

loadModule();
