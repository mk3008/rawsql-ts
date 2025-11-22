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
// Tab switching logic
const tabs = document.querySelectorAll('.tab-btn');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        const container = tab.closest('.editor-container');

        if (!container) return;

        // Find tabs and contents within the same container
        const containerTabs = container.querySelectorAll('.tab-btn');
        const containerContents = container.querySelectorAll('.tab-content');

        containerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        containerContents.forEach(c => {
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
        initQuickStyleSelect();

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
        sql: `CREATE TABLE users (
  id INTEGER PRIMARY KEY DEFAULT nextval('users_id_seq'),
  name TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT now()
);

INSERT INTO users (name, email) 
VALUES ('Alice', 'alice@example.com') 
RETURNING *;

UPDATE users 
SET name = 'Bob' 
WHERE id = 1 
RETURNING *;

DELETE FROM users 
WHERE id = 1 
RETURNING *;

MERGE INTO users t 
USING (SELECT 1 as id, 'Charlie' as name, 'charlie@example.com' as email) s ON t.id = s.id
WHEN MATCHED THEN UPDATE 
SET name = s.name
WHEN NOT MATCHED THEN INSERT (id, name, email) 
VALUES (s.id, s.name, s.email);

SELECT * FROM users WHERE id = 1;`,
        fixture: `{
  "users": {
    "columns": [
      { "name": "id", "type": "integer", "primaryKey": true, "default": "nextval('users_id_seq')" },
      { "name": "name", "type": "text" },
      { "name": "email", "type": "text" },
      { "name": "created_at", "type": "timestamp", "default": "now()" }
    ],
    "rows": [
      { "id": 1, "name": "Alice", "email": "alice@example.com", "created_at": "2023-01-01 10:00:00" },
      { "id": 2, "name": "Bob", "email": "bob@example.com", "created_at": "2023-01-02 11:00:00" }
    ]
  }
}`
    },
    multi: {
        sql: `CREATE TABLE users (
  id INTEGER PRIMARY KEY DEFAULT nextval('users_id_seq'),
  name TEXT,
  email TEXT
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY DEFAULT nextval('posts_id_seq'),
  user_id INTEGER,
  title TEXT,
  content TEXT
);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY DEFAULT nextval('comments_id_seq'),
  post_id INTEGER,
  content TEXT
);

INSERT INTO users (name, email) 
VALUES ('Charlie', 'charlie@example.com') 
RETURNING id;

INSERT INTO posts (user_id, title, content) 
VALUES (1, 'Hello World', 'This is my first post') 
RETURNING *;

UPDATE posts 
SET title = 'Updated Title' 
WHERE id = 1 
RETURNING *;

DELETE FROM posts 
WHERE id = 1 
RETURNING *;

MERGE INTO users t 
USING (SELECT 2 as id, 'Dave' as name, 'dave@example.com' as email) s ON t.id = s.id
WHEN MATCHED THEN UPDATE 
SET name = s.name
WHEN NOT MATCHED THEN INSERT (id, name, email) 
VALUES (s.id, s.name, s.email);

SELECT u.name, p.title 
FROM users u 
JOIN posts p ON u.id = p.user_id;`,
        fixture: `{
  "users": {
    "columns": [
      { "name": "id", "type": "integer", "primaryKey": true, "default": "nextval('users_id_seq')" },
      { "name": "name", "type": "text" },
      { "name": "email", "type": "text" }
    ],
    "rows": [
      { "id": 1, "name": "Alice", "email": "alice@example.com" },
      { "id": 2, "name": "Bob", "email": "bob@example.com" }
    ]
  },
  "posts": {
    "columns": [
      { "name": "id", "type": "integer", "primaryKey": true, "default": "nextval('posts_id_seq')" },
      { "name": "user_id", "type": "integer" },
      { "name": "title", "type": "text" },
      { "name": "content", "type": "text" }
    ],
    "rows": [
      { "id": 1, "user_id": 1, "title": "Hello World", "content": "This is my first post" },
      { "id": 2, "user_id": 1, "title": "Second Post", "content": "Another post" },
      { "id": 3, "user_id": 2, "title": "Bob's Post", "content": "Bob's first post" }
    ]
  },
  "comments": {
    "columns": [
      { "name": "id", "type": "integer", "primaryKey": true, "default": "nextval('comments_id_seq')" },
      { "name": "post_id", "type": "integer" },
      { "name": "content", "type": "text" }
    ],
    "rows": [
      { "id": 1, "post_id": 1, "content": "Great post!" },
      { "id": 2, "post_id": 1, "content": "Thanks for sharing" },
      { "id": 3, "post_id": 2, "content": "Interesting" }
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

function updateResourceTab(sqlText, SqlParser, MultiQuerySplitter, TableSourceCollector, CTECollector) {
    const tableListElement = document.getElementById('table-list');
    const cteListElement = document.getElementById('cte-list');
    const tableActionsElement = document.getElementById('table-actions');
    const cteActionsElement = document.getElementById('cte-actions');

    if (!tableListElement || !cteListElement) return;

    tableListElement.innerHTML = '';
    cteListElement.innerHTML = '';
    if (tableActionsElement) tableActionsElement.innerHTML = '';
    if (cteActionsElement) cteActionsElement.innerHTML = '';

    const createListItem = (name) => {
        const li = document.createElement('li');
        li.style.padding = '5px 0';
        li.style.borderBottom = '1px solid #3f3f46';
        li.textContent = name;
        return li;
    };

    const createButton = (text, onClick, color = '#3f3f46', textColor = '#e4e4e7') => {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.padding = '2px 8px';
        btn.style.fontSize = '0.8rem';
        btn.style.background = color;
        btn.style.border = 'none';
        btn.style.borderRadius = '3px';
        btn.style.color = textColor;
        btn.style.cursor = 'pointer';
        btn.onclick = onClick;
        return btn;
    };

    if (!sqlText || !sqlText.trim()) {
        const li = document.createElement('li');
        li.textContent = '(SQL input is empty)';
        li.style.color = '#888';
        tableListElement.appendChild(li);
        cteListElement.appendChild(li.cloneNode(true));
        return;
    }

    try {
        const splitResult = MultiQuerySplitter.split(sqlText);
        const tableNames = new Set();
        const cteNames = new Set();

        for (const query of splitResult.queries) {
            if (query.isEmpty) continue;
            try {
                const ast = SqlParser.parse(query.sql);

                // Collect Tables
                const tableCollector = new TableSourceCollector(false); // false = don't include CTEs in table list
                const tables = tableCollector.collect(ast);
                tables.forEach(t => {
                    if (t && t.table && t.table.name) {
                        tableNames.add(t.table.name);
                    }
                });

                // Collect CTEs
                const cteCollector = new CTECollector();
                const ctes = cteCollector.collect(ast);
                ctes.forEach(cte => {
                    const name = cte.getSourceAliasName();
                    if (name) {
                        cteNames.add(name);
                    }
                });

            } catch (e) {
                // Ignore parse errors for resource collection
            }
        }

        if (tableNames.size === 0) {
            const li = document.createElement('li');
            li.textContent = '(No tables found)';
            li.style.color = '#888';
            tableListElement.appendChild(li);
        } else {
            const sortedTables = Array.from(tableNames).sort();
            sortedTables.forEach(name => {
                tableListElement.appendChild(createListItem(name));
            });

            if (tableActionsElement) {
                // Copy List Button
                const copyListBtn = createButton('Copy List', () => {
                    const text = sortedTables.join('\n');
                    navigator.clipboard.writeText(text).then(() => updateStatusBar('Copied table list'));
                });
                tableActionsElement.appendChild(copyListBtn);

                // Copy Analyze Button
                const copyAnalyzeBtn = createButton('Copy Analyze', () => {
                    const text = sortedTables.map(t => `ANALYZE ${t};`).join('\n');
                    navigator.clipboard.writeText(text).then(() => updateStatusBar('Copied analyze statements'));
                }, '#2563eb', '#ffffff');
                tableActionsElement.appendChild(copyAnalyzeBtn);
            }
        }

        if (cteNames.size === 0) {
            const li = document.createElement('li');
            li.textContent = '(No CTEs found)';
            li.style.color = '#888';
            cteListElement.appendChild(li);
        } else {
            const sortedCtes = Array.from(cteNames).sort();
            sortedCtes.forEach(name => {
                cteListElement.appendChild(createListItem(name));
            });

            if (cteActionsElement) {
                // Copy List Button
                const copyListBtn = createButton('Copy List', () => {
                    const text = sortedCtes.join('\n');
                    navigator.clipboard.writeText(text).then(() => updateStatusBar('Copied CTE list'));
                });
                cteActionsElement.appendChild(copyListBtn);
            }
        }

    } catch (e) {
        console.error("Error updating resource tab:", e);
    }
}

function initQuickStyleSelect() {
    const quickStyleSelect = document.getElementById('quick-style-select');
    const styleSelect = document.getElementById('style-select');

    if (!quickStyleSelect || !styleConfigModule) return;

    const updateOptions = () => {
        const styles = styleConfigModule.getCurrentStyles();
        quickStyleSelect.innerHTML = '';

        Object.keys(styles).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            quickStyleSelect.appendChild(opt);
        });

        // Restore from localStorage if available
        const savedStyle = localStorage.getItem('cud-demo-style');
        if (savedStyle && styles[savedStyle]) {
            quickStyleSelect.value = savedStyle;
        } else if (styleSelect) {
            // Fallback to main style select if no saved style
            quickStyleSelect.value = styleSelect.value;
        }

        // Sync with main style select
        if (styleSelect) {
            styleSelect.value = quickStyleSelect.value;
        }
    };

    // Initial population
    updateOptions();

    // Listen for changes
    quickStyleSelect.addEventListener('change', () => {
        localStorage.setItem('cud-demo-style', quickStyleSelect.value);

        // Also update the main style select to keep them in sync
        if (styleSelect) {
            styleSelect.value = quickStyleSelect.value;
            // Trigger change event on main select to update editor
            styleSelect.dispatchEvent(new Event('change'));
        } else {
            convertAndFormat();
        }
    });

    // Listen for style updates (this is a bit hacky, ideally we'd have an event)
    // For now, we can hook into the save/delete buttons or just refresh on mouseover of the header
    document.getElementById('save-style-btn').addEventListener('click', () => setTimeout(updateOptions, 100));
    document.getElementById('delete-style-btn').addEventListener('click', () => setTimeout(updateOptions, 100));
}

function buildFixtureTables(tableDefinitions) {
    const fixtures = [];
    if (!tableDefinitions || typeof tableDefinitions !== 'object') return fixtures;

    for (const [tableName, def] of Object.entries(tableDefinitions)) {
        if (def && Array.isArray(def.columns)) {
            const columns = def.columns.map(c => ({ name: c.name, typeName: c.type, defaultValue: c.default }));
            let rows = [];

            if (Array.isArray(def.rows)) {
                // Convert array of objects to array of arrays based on column order
                rows = def.rows.map(rowObj => {
                    return columns.map(col => {
                        return rowObj[col.name] !== undefined ? rowObj[col.name] : null;
                    });
                });
            }

            fixtures.push({
                tableName: tableName,
                columns: columns,
                rows: rows
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
        MergeQuery,
        TableSourceCollector,
        CTECollector
    } = rawSqlModule;

    const sqlText = sqlInputEditor.getValue();
    if (!sqlText.trim()) {
        formattedSqlEditor.setValue('');
        updateStatusBar('Ready');
        updateResourceTab(''); // Clear resources
        return;
    }

    // Determine format options
    let formatOptions = defaultFormatOptions;
    if (styleConfigModule) {
        const currentStyles = styleConfigModule.getCurrentStyles();
        const styleSelect = document.getElementById('style-select');
        // Check quick style select first if available
        const quickStyleSelect = document.getElementById('quick-style-select');

        if (quickStyleSelect && quickStyleSelect.value && currentStyles[quickStyleSelect.value]) {
            formatOptions = currentStyles[quickStyleSelect.value];
        } else if (styleSelect && styleSelect.value && currentStyles[styleSelect.value]) {
            formatOptions = currentStyles[styleSelect.value];
        }
    }

    // Update Resource Tab
    updateResourceTab(sqlText, SqlParser, MultiQuerySplitter, TableSourceCollector, CTECollector);

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

        // Output mode check
        const outputModeSelector = document.getElementById('output-mode-selector');
        const outputMode = outputModeSelector ? outputModeSelector.value : 'convert';

        for (const query of splitResult.queries) {
            if (query.isEmpty) continue;

            try {
                const ast = SqlParser.parse(query.sql);
                let convertedAst = ast;

                if (outputMode === 'convert') {
                    const options = {
                        missingFixtureStrategy: 'passthrough',
                        tableDefinitions: null, // Rely on fixtureTables for metadata to ensure correct type mapping
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
                }

                // If convertedAst is a SelectQuery object (not AST yet), convert it
                if (convertedAst && typeof convertedAst.toAst === 'function') {
                    convertedAst = convertedAst.toAst();
                }

                const { formattedSql } = formatter.format(convertedAst);
                segments.push(formattedSql + '\n;');
            } catch (e) {
                console.error("Error processing statement:", e);
                segments.push(`/* Error processing statement: ${e.message} */\n${query.sql}\n;`);
            }
        }

        formattedSqlEditor.setValue(segments.join('\n\n'));
        updateStatusBar('Conversion successful');
    } catch (e) {
        console.error("Global error:", e);
        updateStatusBar('Error: ' + e.message, true);
    }
}

// Output mode selector event listener
const outputModeSelector = document.getElementById('output-mode-selector');
if (outputModeSelector) {
    // Initialize from localStorage or default to 'format'
    const savedOutputMode = localStorage.getItem('cud-demo-output-mode');
    outputModeSelector.value = savedOutputMode || 'format';

    outputModeSelector.addEventListener('change', (e) => {
        localStorage.setItem('cud-demo-output-mode', e.target.value);
        convertAndFormat();
    });
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
