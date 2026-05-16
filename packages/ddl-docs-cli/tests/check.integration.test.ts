import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { checkDocs, runCheckDocs } from '../src/commands/check';
import { buildReviewPlan } from '../src/commands/reviewPlan';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

test('check passes when relationship, order, table-docs, and concept registry references are consistent', () => {
  const work = createTempDir('ddl-docs-check-pass');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const dfdDir = path.join(work, 'docs', 'dfd');
  const processesDir = path.join(work, 'docs', 'processes');
  const tableDocsPath = path.join(ddlDir, 'table-docs.json');
  const relationshipPath = path.join(ddlDir, 'relationship.json');
  const orderPath = path.join(ddlDir, 'order.json');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');
  const dfdRelationshipPath = path.join(dfdDir, 'relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), `
    CREATE TABLE public.accounts (
      account_id bigint PRIMARY KEY,
      source_key_json jsonb NOT NULL,
      source_key_hash text NOT NULL,
      CONSTRAINT uq_accounts_source UNIQUE (source_key_json)
    );
    CREATE INDEX idx_accounts_source_lookup ON public.accounts (source_key_hash);
  `);
  writeText(path.join(conceptsDir, 'account/SPEC.md'), '# Account Concept\n');
  writeText(path.join(dfdDir, 'account-flow.md'), [
    '# Account Flow',
    '',
    '## Account Registration Detail Flow',
    '',
    '```mermaid',
    'flowchart LR',
    '  Event{{"When: account changes"}}',
    '  User[/"Who: User"/]',
    '  Register(("Account Registration"))',
    '  Event -. "trigger" .-> Register',
    '  User -. "manual run" .-> Register',
    '```',
  ].join('\n'));
  writeText(
    path.join(processesDir, 'account-process.md'),
    '# Account Process\n\n## Process Map Rule Reference\n\nThis document follows the shared [Process Map Rules](../../../docs/guide/concept-spec-overview.md#process-map-rules).\n'
  );
  writeText(path.join(processesDir, 'process-map.json'), JSON.stringify({
    schemaVersion: 1,
    processMaps: [
      {
        id: 'account-process',
        path: 'account-process.md',
        summary: 'Account process.',
      },
    ],
    views: [
      {
        id: 'account-process-view',
        name: 'Account Process View',
        processMap: 'account-process',
        concepts: ['account'],
      },
    ],
  }, null, 2));
  writeText(tableDocsPath, JSON.stringify({
    schemaVersion: 1,
    schemas: {
      public: {
        summary: 'Application tables.',
      },
    },
    tables: {
      'public.accounts': {
        columns: {
          source_key_json: { sample: { account_id: 1 } },
          source_key_hash: { sample: 'sha256:account', designNotes: ['Lookup aid, not identity.'] },
        },
        constraints: {
          uq_accounts_source: { designNotes: ['Prevents duplicate current source rows.'] },
          idx_accounts_source_lookup: { designNotes: ['Supports source hash lookup before JSON equality.'] },
        },
      },
    },
  }, null, 2));
  writeText(relationshipPath, JSON.stringify({
    schemaVersion: 1,
    relationships: [
      {
        path: 'accounts.sql',
        kind: 'table-ddl',
        concepts: [{ path: '../docs/concepts/account/SPEC.md', reason: 'Account concept.' }],
        processes: [{ path: '../docs/processes/account-process.md', reason: 'Account process.' }],
      },
    ],
  }, null, 2));
  writeText(orderPath, JSON.stringify({ schemaVersion: 1, order: ['accounts.sql'] }, null, 2));
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [{
      id: 'account',
      displayName: 'Account',
      path: 'account/SPEC.md',
      status: 'defined',
      summary: 'Account concept.',
    }],
    relationships: [],
    views: [{ id: 'account-view', concepts: ['account'] }],
    glossaryTerms: [
      {
        id: 'account-key',
        displayTerm: 'account key',
        definedIn: ['account/SPEC.md'],
        meaning: 'Logical account identity.',
      },
    ],
    relatedProcessMaps: [
      {
        id: 'account-process',
        displayName: 'Account Process',
        path: '../processes/account-process.md',
        reason: 'Account process map.',
      },
    ],
  }, null, 2));
  writeText(dfdRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    externalStores: [{ id: 'external-account-source', displayName: 'External Account Source' }],
    conceptGroups: [
      {
        id: 'account-configuration',
        displayName: 'Account Configuration',
        scope: 'dfd-only',
        members: [{ type: 'concept', id: 'account' }],
      },
    ],
    dfds: [
      {
        id: 'account-flow',
        path: 'account-flow.md',
        businessOperations: [
          {
            id: 'account-registration',
            displayName: 'Account Registration',
            inputs: [{ type: 'external-store', id: 'external-account-source' }],
            outputs: [{ type: 'concept-group', id: 'account-configuration' }],
          },
        ],
      },
    ],
  }, null, 2));

  const result = runCheckDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    tableDocsPath,
    relationshipPath,
    orderPath,
    conceptRelationshipPath,
    dfdRelationshipPath,
  });

  expect(result.errors).toHaveLength(0);
});

test('check fails when DFD relationship references an unknown concept', () => {
  const work = createTempDir('ddl-docs-check-dfd-unknown-concept');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const dfdDir = path.join(work, 'docs', 'dfd');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');
  const dfdRelationshipPath = path.join(dfdDir, 'relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(dfdDir, 'account-flow.md'), '# Account Flow\n');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [{ id: 'account', path: 'account/SPEC.md', status: 'defined' }],
  }, null, 2));
  writeText(dfdRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    conceptGroups: [
      {
        id: 'account-configuration',
        displayName: 'Account Configuration',
        scope: 'dfd-only',
        members: [{ type: 'concept', id: 'missing-account' }],
      },
    ],
    dfds: [{ id: 'account-flow', path: 'account-flow.md' }],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    conceptRelationshipPath,
    dfdRelationshipPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('DFD_REF_UNKNOWN_CONCEPT');
});

test('check warns when DFD operation has no Mermaid Who labels', () => {
  const work = createTempDir('ddl-docs-check-dfd-who-missing');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const dfdDir = path.join(work, 'docs', 'dfd');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');
  const dfdRelationshipPath = path.join(dfdDir, 'relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'account/SPEC.md'), '# Account Concept\n');
  writeText(path.join(dfdDir, 'account-flow.md'), [
    '# Account Flow',
    '',
    '## Account Registration Detail Flow',
    '',
    '```mermaid',
    'flowchart LR',
    '  Event{{"When: account changes"}}',
    '  Register(("Account Registration"))',
    '  Event -. "trigger" .-> Register',
    '```',
  ].join('\n'));
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [{ id: 'account', path: 'account/SPEC.md', status: 'defined' }],
  }, null, 2));
  writeText(dfdRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    dfds: [
      {
        id: 'account-flow',
        path: 'account-flow.md',
        businessOperations: [
          {
            id: 'account-registration',
            displayName: 'Account Registration',
            inputs: [{ type: 'concept', id: 'account' }],
            outputs: [{ type: 'concept', id: 'account' }],
          },
        ],
      },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    conceptRelationshipPath,
    dfdRelationshipPath,
  });

  expect(result.errors).toHaveLength(0);
  expect(result.warnings.map((issue) => issue.code)).toContain('DFD_MARKDOWN_WHO_LABEL_MISSING');
});

test('check warns when defined concept summary metadata is missing or too long', () => {
  const work = createTempDir('ddl-docs-check-concept-summary');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'account/SPEC.md'), '# Account Concept\n');
  writeText(path.join(conceptsDir, 'customer/SPEC.md'), '# Customer Concept\n');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [
      {
        id: 'account',
        displayName: 'Account',
        path: 'account/SPEC.md',
        status: 'defined',
      },
      {
        id: 'customer',
        displayName: 'Customer',
        path: 'customer/SPEC.md',
        status: 'defined',
        summary: 'A'.repeat(161),
      },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    conceptRelationshipPath,
  });

  expect(result.errors).toHaveLength(0);
  expect(result.warnings.map((warning) => warning.code)).toContain('CONCEPT_SUMMARY_MISSING');
  expect(result.warnings.map((warning) => warning.code)).toContain('CONCEPT_SUMMARY_TOO_LONG');
});

test('check warns when concept relationship helper metadata is too long', () => {
  const work = createTempDir('ddl-docs-check-concept-helper-metadata');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');
  const longText = 'A'.repeat(241);

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'account/SPEC.md'), '# Account Concept\n');
  writeText(path.join(conceptsDir, 'customer/SPEC.md'), '# Customer Concept\n');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [
      {
        id: 'account',
        displayName: 'Account',
        path: 'account/SPEC.md',
        status: 'defined',
        summary: 'Account concept.',
        note: longText,
      },
      {
        id: 'customer',
        displayName: 'Customer',
        path: 'customer/SPEC.md',
        status: 'defined',
        summary: 'Customer concept.',
      },
    ],
    relationships: [
      {
        from: 'account',
        to: 'customer',
        kind: 'uses',
        reason: longText,
      },
    ],
    glossaryTerms: [
      {
        id: 'account-key',
        displayTerm: 'account key',
        definedIn: ['account/SPEC.md'],
        meaning: longText,
        note: longText,
      },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    conceptRelationshipPath,
  });

  expect(result.errors).toHaveLength(0);
  expect(result.warnings.filter((warning) => warning.code === 'CONCEPT_METADATA_NOTE_TOO_LONG')).toHaveLength(4);
});

test('check fails when concept lifecycle metadata drifts from SPEC and DRAFT files', () => {
  const work = createTempDir('ddl-docs-check-concept-lifecycle');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'defined-with-draft/SPEC.md'), '# Defined With Draft\n');
  writeText(path.join(conceptsDir, 'defined-with-draft/DRAFT.md'), '# Stale Draft\n');
  writeText(path.join(conceptsDir, 'draft-with-spec/DRAFT.md'), '# Draft With Spec\n');
  writeText(path.join(conceptsDir, 'draft-with-spec/SPEC.md'), '# Premature Spec\n');
  writeText(path.join(conceptsDir, 'unregistered/SPEC.md'), '# Unregistered\n');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [
      { id: 'defined-with-draft', path: 'defined-with-draft/SPEC.md', status: 'defined' },
      { id: 'draft-with-spec', draftPath: 'draft-with-spec/DRAFT.md', status: 'draft' },
      { id: 'defined-without-path', status: 'defined' },
      { id: 'draft-without-draft-path', status: 'draft' },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    conceptRelationshipPath,
  });

  const codes = result.errors.map((issue) => issue.code);
  expect(codes).toContain('CONCEPT_DEFINED_HAS_DRAFT');
  expect(codes).toContain('CONCEPT_DRAFT_HAS_SPEC');
  expect(codes).toContain('CONCEPT_DEFINED_MISSING_PATH');
  expect(codes).toContain('CONCEPT_DRAFT_MISSING_DRAFT_PATH');
  expect(codes).toContain('CONCEPT_DIRECTORY_HAS_SPEC_AND_DRAFT');
  expect(codes).toContain('CONCEPT_DIRECTORY_NOT_REGISTERED');
});

test('check reports concept relationship schema errors instead of throwing on invalid entry fields', () => {
  const work = createTempDir('ddl-docs-check-concept-schema');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [
      { id: 'invalid-path', path: 123, status: 'defined' },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    conceptRelationshipPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('CONCEPT_RELATIONSHIP_SCHEMA_ERROR');
});

test('check fails when concept review index references missing glossary or process map paths', () => {
  const work = createTempDir('ddl-docs-check-concept-review-index');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'account/SPEC.md'), '# Account Concept\n');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [{ id: 'account', path: 'account/SPEC.md', status: 'defined' }],
    glossaryTerms: [
      {
        id: 'account-key',
        displayTerm: 'account key',
        definedIn: ['missing/SPEC.md'],
      },
    ],
    relatedProcessMaps: [
      {
        id: 'missing-process',
        path: '../processes/missing-process.md',
      },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    conceptRelationshipPath,
  });

  const codes = result.errors.map((issue) => issue.code);
  expect(codes).toContain('CONCEPT_GLOSSARY_MISSING_DEFINED_IN_PATH');
  expect(codes).toContain('CONCEPT_RELATED_PROCESS_MAP_MISSING_PATH');
});

test('check fails when non-authoritative concepts have spec files or authoritative paths', () => {
  const work = createTempDir('ddl-docs-check-non-authoritative-concepts');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'candidate-with-spec/SPEC.md'), '# Candidate With Spec\n');
  writeText(path.join(conceptsDir, 'alias-with-draft-path/DRAFT.md'), '# Alias Draft\n');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [
      { id: 'candidate-with-spec', status: 'candidate' },
      { id: 'alias-with-path', path: 'alias-with-path/SPEC.md', status: 'alias' },
      { id: 'alias-with-draft-path', draftPath: 'alias-with-draft-path/DRAFT.md', status: 'alias' },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    conceptRelationshipPath,
  });

  const codes = result.errors.map((issue) => issue.code);
  expect(codes).toContain('CONCEPT_NON_AUTHORITATIVE_HAS_SPEC_OR_DRAFT');
  expect(codes).toContain('CONCEPT_NON_AUTHORITATIVE_HAS_PATH');
  expect(codes).toContain('CONCEPT_NON_AUTHORITATIVE_HAS_DRAFT_PATH');
});

test('check fails when a process map uses a DFD-only concept group', () => {
  const work = createTempDir('ddl-docs-check-dfd-group-in-process');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const dfdDir = path.join(work, 'docs', 'dfd');
  const processesDir = path.join(work, 'docs', 'processes');
  const relationshipPath = path.join(ddlDir, 'relationship.json');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');
  const dfdRelationshipPath = path.join(dfdDir, 'relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(processesDir, 'account-process.md'), '# Account Process\n\nUses Account Configuration.\n');
  writeText(path.join(dfdDir, 'account-flow.md'), '# Account Flow\n');
  writeText(relationshipPath, JSON.stringify({
    schemaVersion: 1,
    relationships: [
      {
        path: 'accounts.sql',
        kind: 'table-ddl',
        processes: [{ path: '../docs/processes/account-process.md' }],
      },
    ],
  }, null, 2));
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [{ id: 'account', path: 'account/SPEC.md', status: 'defined' }],
  }, null, 2));
  writeText(dfdRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    conceptGroups: [
      {
        id: 'account-configuration',
        displayName: 'Account Configuration',
        scope: 'dfd-only',
        members: [{ type: 'concept', id: 'account' }],
      },
    ],
    dfds: [{ id: 'account-flow', path: 'account-flow.md' }],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    relationshipPath,
    conceptRelationshipPath,
    dfdRelationshipPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('PROCESS_USES_DFD_CONCEPT_GROUP');
});

test('check fails when process-map metadata references missing paths or unknown concepts', () => {
  const work = createTempDir('ddl-docs-check-process-map');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const processesDir = path.join(work, 'docs', 'processes');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'account/SPEC.md'), '# Account Concept\n');
  writeText(path.join(processesDir, 'orphan-process.md'), '# Orphan Process\n');
  writeText(path.join(processesDir, 'process-map.json'), JSON.stringify({
    schemaVersion: 1,
    processMaps: [
      {
        id: 'account-process',
        path: 'missing-process.md',
      },
    ],
    views: [
      {
        id: 'account-view',
        processMap: 'missing-process-map',
        relatedConcepts: ['missing-concept'],
        inputs: [{ type: 'concept', id: 'missing-input-concept' }],
        outputs: [{ type: 'external-store', id: 'missing-external-store' }],
        uses: [{ type: 'concept-group', id: 'dfd-only-group' }],
      },
      {
        id: 'duplicate-view',
        processMap: 'account-process',
        concepts: ['account'],
      },
      {
        id: 'duplicate-view',
        processMap: 'account-process',
        concepts: ['account'],
      },
    ],
  }, null, 2));
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [{ id: 'account', path: 'account/SPEC.md', status: 'defined' }],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    conceptRelationshipPath,
    processDirectories: [processesDir],
  });

  const codes = result.errors.map((issue) => issue.code);
  expect(codes).toContain('PROCESS_MAP_MISSING_PATH');
  expect(codes).toContain('PROCESS_MAP_MARKDOWN_NOT_REGISTERED');
  expect(codes).toContain('PROCESS_MAP_VIEW_UNKNOWN_PROCESS_MAP');
  expect(codes).toContain('PROCESS_MAP_VIEW_UNKNOWN_CONCEPT');
  expect(codes).toContain('PROCESS_MAP_REF_UNKNOWN_CONCEPT');
  expect(codes).toContain('PROCESS_MAP_REF_UNKNOWN_EXTERNAL_STORE');
  expect(codes).toContain('PROCESS_MAP_REF_CONCEPT_GROUP_NOT_ALLOWED');
  expect(codes).toContain('PROCESS_MAP_VIEW_DUPLICATE_ID');
});

test('check warns when process map markdown does not link to shared process map rules', () => {
  const work = createTempDir('ddl-docs-check-process-map-rule-reference');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const processesDir = path.join(work, 'docs', 'processes');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'account/SPEC.md'), '# Account Concept\n');
  writeText(path.join(processesDir, 'account-process.md'), '# Account Process\n');
  writeText(path.join(processesDir, 'process-map.json'), JSON.stringify({
    schemaVersion: 1,
    processMaps: [
      {
        id: 'account-process',
        path: 'account-process.md',
      },
    ],
    views: [
      {
        id: 'account-view',
        processMap: 'account-process',
        concepts: ['account'],
      },
    ],
  }, null, 2));
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [{ id: 'account', path: 'account/SPEC.md', status: 'defined' }],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    conceptRelationshipPath,
    processDirectories: [processesDir],
  });

  expect(result.errors).toHaveLength(0);
  expect(result.warnings.map((issue) => issue.code)).toContain('PROCESS_MAP_RULE_REFERENCE_MISSING');
});

test('check warns instead of failing concept refs when process-map metadata has no concept registry', () => {
  const work = createTempDir('ddl-docs-check-process-map-no-concept-registry');
  const ddlDir = path.join(work, 'ddl');
  const processesDir = path.join(work, 'docs', 'processes');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(
    path.join(processesDir, 'account-process.md'),
    '# Account Process\n\n## Process Map Rule Reference\n\nThis document follows the shared [Process Map Rules](../../../docs/guide/concept-spec-overview.md#process-map-rules).\n'
  );
  writeText(path.join(processesDir, 'process-map.json'), JSON.stringify({
    schemaVersion: 1,
    processMaps: [
      {
        id: 'account-process',
        path: 'account-process.md',
      },
    ],
    views: [
      {
        id: 'account-view',
        processMap: 'account-process',
        concepts: ['account'],
      },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    processDirectories: [processesDir],
  });

  expect(result.errors).toHaveLength(0);
  expect(result.warnings.map((issue) => issue.code)).toContain('PROCESS_MAP_CONCEPT_REGISTRY_NOT_PROVIDED');
});

test('check fails when table-docs references a missing DDL column', () => {
  const work = createTempDir('ddl-docs-check-stale-column');
  const ddlDir = path.join(work, 'ddl');
  const tableDocsPath = path.join(ddlDir, 'table-docs.json');

  writeText(path.join(ddlDir, 'accounts.sql'), `
    CREATE TABLE public.accounts (
      account_id bigint PRIMARY KEY
    );
  `);
  writeText(tableDocsPath, JSON.stringify({
    schemaVersion: 1,
    tables: {
      'public.accounts': {
        columns: {
          missing_column: { sample: 1 },
        },
      },
    },
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    tableDocsPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('TABLE_DOCS_UNKNOWN_COLUMN');
});

test('check fails when order metadata does not cover discovered DDL files', () => {
  const work = createTempDir('ddl-docs-check-order');
  const ddlDir = path.join(work, 'ddl');
  const orderPath = path.join(ddlDir, 'order.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(ddlDir, 'orders.sql'), 'CREATE TABLE public.orders (order_id bigint PRIMARY KEY);');
  writeText(orderPath, JSON.stringify({ schemaVersion: 1, order: ['accounts.sql'] }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    orderPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('ORDER_UNTRACKED_DDL_FILE');
});

test('check validates scope rules and relationship scope references', () => {
  const work = createTempDir('ddl-docs-check-scope-rules');
  const ddlDir = path.join(work, 'ddl');
  const scopeRulesPath = path.join(work, 'docs', 'scope', 'scope-rules.json');
  const relationshipPath = path.join(ddlDir, 'relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(scopeRulesPath, JSON.stringify({
    schemaVersion: 1,
    scopeRules: [
      { id: 'db-centered-transfer', kind: 'global-invariant', statement: 'DB centered.' },
      { id: 'dirty-key-intake-only', kind: 'ownership-boundary', statement: 'Dirty Key intake only.' },
    ],
  }, null, 2));
  writeText(relationshipPath, JSON.stringify({
    schemaVersion: 1,
    relationships: [
      {
        path: 'accounts.sql',
        kind: 'table-ddl',
        scopeRules: [{ id: 'dirty-key-intake-only' }],
      },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    relationshipPath,
    scopeRulesPath,
  });

  expect(result.errors).toHaveLength(0);
});

test('check reports invalid scope rule metadata', () => {
  const work = createTempDir('ddl-docs-check-invalid-scope-rules');
  const ddlDir = path.join(work, 'ddl');
  const scopeRulesPath = path.join(work, 'docs', 'scope', 'scope-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(scopeRulesPath, JSON.stringify({
    schemaVersion: 1,
    scopeRules: [
      { id: 'duplicate', kind: 'global-invariant', statement: 'A.' },
      { id: 'duplicate', kind: 'global-invariant', statement: 'B.' },
      { id: 'unknown-kind', kind: 'not-a-kind', statement: 'C.' },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    scopeRulesPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('SCOPE_RULE_DUPLICATE_ID');
  expect(result.errors.map((issue) => issue.code)).toContain('SCOPE_RULE_UNKNOWN_KIND');
});

test('check fails when relationship metadata references an unknown scope rule', () => {
  const work = createTempDir('ddl-docs-check-unknown-scope-rule');
  const ddlDir = path.join(work, 'ddl');
  const scopeRulesPath = path.join(work, 'docs', 'scope', 'scope-rules.json');
  const relationshipPath = path.join(ddlDir, 'relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(scopeRulesPath, JSON.stringify({
    schemaVersion: 1,
    scopeRules: [
      { id: 'db-centered-transfer', kind: 'global-invariant', statement: 'DB centered.' },
    ],
  }, null, 2));
  writeText(relationshipPath, JSON.stringify({
    schemaVersion: 1,
    relationships: [
      {
        path: 'accounts.sql',
        kind: 'table-ddl',
        scopeRules: [{ id: 'missing-scope-rule' }],
      },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    relationshipPath,
    scopeRulesPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('RELATIONSHIP_UNKNOWN_SCOPE_RULE');
});

test('review-plan resolves DDL required reads from relationship metadata', () => {
  const work = createTempDir('ddl-docs-review-plan');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const processesDir = path.join(work, 'docs', 'processes');
  const scopeDir = path.join(work, 'docs', 'scope');
  const changedFilesPath = path.join(work, 'changed-files.txt');
  const relationshipPath = path.join(ddlDir, 'relationship.json');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');
  const scopeRulesPath = path.join(scopeDir, 'scope-rules.json');
  const scopeDocPath = path.join(scopeDir, 'SYSTEM_SCOPE.md');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'account/SPEC.md'), '# Account Concept\n');
  writeText(path.join(processesDir, 'account-process.md'), '# Account Process\n');
  writeText(scopeDocPath, '# Scope\n');
  writeText(changedFilesPath, `${path.join(ddlDir, 'accounts.sql')}\n`);
  writeText(scopeRulesPath, JSON.stringify({
    schemaVersion: 1,
    scopeRules: [
      { id: 'db-centered-transfer', kind: 'global-invariant', statement: 'DB centered.', reviewRisk: 'architecture-boundary' },
      { id: 'human-owned-logical-model', kind: 'review-policy', statement: 'Human-owned.' },
      { id: 'generated-docs-not-source', kind: 'global-invariant', statement: 'Generated docs are views.' },
      { id: 'account-scope', kind: 'ownership-boundary', statement: 'Account scope.', reviewRisk: 'ownership-boundary' },
    ],
  }, null, 2));
  writeText(relationshipPath, JSON.stringify({
    schemaVersion: 1,
    relationships: [
      {
        path: 'accounts.sql',
        kind: 'table-ddl',
        scopeRules: [{ id: 'account-scope' }],
        concepts: [{ path: '../docs/concepts/account/SPEC.md' }],
        processes: [{ path: '../docs/processes/account-process.md' }],
      },
    ],
  }, null, 2));
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [{ id: 'account', path: 'account/SPEC.md', status: 'defined' }],
  }, null, 2));
  writeText(path.join(processesDir, 'process-map.json'), JSON.stringify({
    schemaVersion: 1,
    processMaps: [{ id: 'account-process', path: 'account-process.md' }],
  }, null, 2));

  const plan = buildReviewPlan({
    changedFilesPath,
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    relationshipPath,
    conceptRelationshipPath,
    processDirectories: [processesDir],
    scopeRulesPath,
    scopeDocPath,
  });

  expect(plan.mandatoryScope.files).toContain(scopeDocPath);
  expect(plan.mandatoryScope.rules.map((rule) => rule.id)).toEqual([
    'db-centered-transfer',
    'human-owned-logical-model',
    'generated-docs-not-source',
  ]);
  expect(plan.changedFiles[0]?.requiredReads.scopeRules).toEqual(['account-scope']);
  expect(plan.changedFiles[0]?.requiredReads.concepts).toEqual(['account']);
  expect(plan.changedFiles[0]?.requiredReads.processes).toEqual(['account-process']);
  expect(plan.changedFiles[0]?.reviewRisks).toEqual(['ownership-boundary']);
});

test('review-plan reports unmapped DDL and classifies generated docs as review views', () => {
  const work = createTempDir('ddl-docs-review-plan-unmapped');
  const ddlDir = path.join(work, 'ddl');
  const scopeDir = path.join(work, 'docs', 'scope');
  const changedFilesPath = path.join(work, 'changed-files.txt');
  const scopeRulesPath = path.join(scopeDir, 'scope-rules.json');
  const scopeDocPath = path.join(scopeDir, 'SYSTEM_SCOPE.md');

  writeText(path.join(ddlDir, 'unmapped.sql'), 'CREATE TABLE public.unmapped (id bigint PRIMARY KEY);');
  writeText(scopeDocPath, '# Scope\n');
  const unmappedDdlPath = path.join(ddlDir, 'unmapped.sql');
  writeText(changedFilesPath, [
    unmappedDdlPath,
    'docs/concepts/account.md',
  ].join('\n'));
  writeText(scopeRulesPath, JSON.stringify({
    schemaVersion: 1,
    scopeRules: [
      { id: 'db-centered-transfer', kind: 'global-invariant', statement: 'DB centered.' },
      { id: 'human-owned-logical-model', kind: 'review-policy', statement: 'Human-owned.' },
      { id: 'generated-docs-not-source', kind: 'global-invariant', statement: 'Generated docs are views.' },
    ],
  }, null, 2));

  const plan = buildReviewPlan({
    changedFilesPath,
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    scopeRulesPath,
    scopeDocPath,
  });

  expect(plan.unmappedArtifacts.map((entry) => entry.path)).toContain(unmappedDdlPath.replace(/\\/g, '/'));
  expect(plan.changedFiles.find((entry) => entry.path === 'docs/concepts/account.md')?.reviewClass).toBe('generated-review-view');
});
