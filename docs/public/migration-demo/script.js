// Default formatting options
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

// Initialize Editors
const sql1Editor = CodeMirror.fromTextArea(document.getElementById('sql1-input'), {
    mode: 'text/x-pgsql',
    lineNumbers: true,
    theme: 'dracula',
    lineWrapping: false
});

const sql2Editor = CodeMirror.fromTextArea(document.getElementById('sql2-input'), {
    mode: 'text/x-pgsql',
    lineNumbers: true,
    theme: 'dracula',
    lineWrapping: false
});

const migrationOutputEditor = CodeMirror.fromTextArea(document.getElementById('migration-output'), {
    mode: 'text/x-pgsql',
    lineNumbers: true,
    theme: 'dracula',
    readOnly: true,
    lineWrapping: false
});

// Global module
let rawSqlModule = null;

// Load Module
async function loadModule() {
    try {
        updateStatusBar('Loading modules...');
        rawSqlModule = await import('../demo/vendor/rawsql.browser.js');
        updateStatusBar('Ready');
        // Set initial sample data
        sql1Editor.setValue(samples.users.v1);
        sql2Editor.setValue(samples.users.v2);
        generateMigration();
    } catch (e) {
        console.error("Failed to load modules:", e);
        updateStatusBar('Error: Failed to load modules.', true);
    }
}

function updateStatusBar(message, isError = false) {
    const statusBar = document.getElementById('status-bar');
    statusBar.textContent = message;
    statusBar.style.color = isError ? '#ef4444' : '#4ade80';
}

// Generate Migration
function generateMigration() {
    if (!rawSqlModule) return;

    const { DDLDiffGenerator } = rawSqlModule;

    const sql1 = sql1Editor.getValue();
    const sql2 = sql2Editor.getValue();
    const direction = document.getElementById('migration-direction').value;

    let currentDDL = '';
    let expectedDDL = '';

    if (direction === '1to2') {
        currentDDL = sql1;
        expectedDDL = sql2;
    } else {
        currentDDL = sql2;
        expectedDDL = sql1;
    }

    const options = {
        dropColumns: document.getElementById('opt-drop-columns').checked,
        dropTables: document.getElementById('opt-drop-columns').checked,
        dropConstraints: document.getElementById('opt-drop-constraints').checked,
        checkConstraintNames: document.getElementById('opt-check-names').checked
    };

    try {
        const diff = DDLDiffGenerator.generateDiff(currentDDL, expectedDDL, options);

        let output = '';
        if (diff.length === 0) {
            output = '-- No changes detected';
        } else {
            output = diff.join('\n\n');
        }

        migrationOutputEditor.setValue(output);
        updateStatusBar('Migration script generated');
    } catch (e) {
        console.error("Error generating migration:", e);
        migrationOutputEditor.setValue(`/* Error: ${e.message} */`);
        updateStatusBar('Error generating migration', true);
    }
}

// Event Listeners
let debounceTimer = null;
const triggerGeneration = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(generateMigration, 500);
};

sql1Editor.on('changes', triggerGeneration);
sql2Editor.on('changes', triggerGeneration);
document.getElementById('migration-direction').addEventListener('change', generateMigration);
document.getElementById('opt-drop-columns').addEventListener('change', generateMigration);
document.getElementById('opt-drop-constraints').addEventListener('change', generateMigration);
document.getElementById('opt-check-names').addEventListener('change', generateMigration);

document.getElementById('clear-sql1-btn').addEventListener('click', () => {
    sql1Editor.setValue('');
    sql1Editor.focus();
});

document.getElementById('clear-sql2-btn').addEventListener('click', () => {
    sql2Editor.setValue('');
    sql2Editor.focus();
});

document.getElementById('copy-output-btn').addEventListener('click', () => {
    const text = migrationOutputEditor.getValue();
    if (text) {
        navigator.clipboard.writeText(text).then(() => updateStatusBar('Copied to clipboard'));
    }
});

// Sample Data
// Sample Data
const samples = {
    users: {
        v1: `CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);`,
        v2: `CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT now()
);`
    },
    normalization: {
        v1: `CREATE TABLE items (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE,
    quantity INTEGER CHECK (quantity >= 0)
);`,
        v2: `CREATE TABLE items (
    id INTEGER,
    code TEXT,
    quantity INTEGER
);

ALTER TABLE items ADD PRIMARY KEY (id);
ALTER TABLE items ADD UNIQUE (code);
ALTER TABLE items ADD CHECK (quantity >= 0);`
    },
    multi: {
        v1: `CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    age INTEGER CHECK (age >= 0)
);

CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    title TEXT
);
CREATE INDEX idx_posts_user_id ON posts(user_id);

CREATE TABLE comments (
    id INTEGER PRIMARY KEY,
    post_id INTEGER,
    content TEXT
);

CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    price INTEGER CONSTRAINT chk_price_positive CHECK (price > 0)
);`,
        v2: `CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    email TEXT,
    age INTEGER CHECK (age >= 0)
);

CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    title TEXT
);
CREATE INDEX idx_posts_user_id ON posts(user_id);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    name TEXT
);

CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    price INTEGER CONSTRAINT chk_price_gt_zero CHECK (price > 0)
);`
    }
};

document.getElementById('sample-loader').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val && samples[val]) {
        sql1Editor.setValue(samples[val].v1);
        sql2Editor.setValue(samples[val].v2);
        e.target.value = ''; // Reset selection
    }
});

// Initial Load
loadModule();
