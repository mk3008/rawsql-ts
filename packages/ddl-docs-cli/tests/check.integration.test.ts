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
    metadataLanguagePolicy: {
      humanFacingLanguage: 'ja',
      generatedViewLanguage: 'en',
      policy: 'Human-authored review metadata follows the package documentation language.',
    },
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

test('check rejects invalid scope rule metadata language policy', () => {
  const work = createTempDir('ddl-docs-check-invalid-scope-language-policy');
  const ddlDir = path.join(work, 'ddl');
  const scopeRulesPath = path.join(work, 'docs', 'scope', 'scope-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(scopeRulesPath, JSON.stringify({
    schemaVersion: 1,
    metadataLanguagePolicy: {
      humanFacingLanguage: '',
      policy: 'Human-authored review metadata follows the package documentation language.',
    },
    scopeRules: [
      { id: 'db-centered-transfer', kind: 'global-invariant', statement: 'DB centered.' },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    scopeRulesPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('SCOPE_RULES_SCHEMA_ERROR');
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

test('check validates package test policy metadata', () => {
  const work = createTempDir('ddl-docs-check-test-rules');
  const ddlDir = path.join(work, 'ddl');
  const testRulesPath = path.join(work, 'docs', 'testing', 'test-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(testRulesPath, JSON.stringify({
    schemaVersion: 1,
    metadataLanguagePolicy: {
      humanFacingLanguage: 'ja',
      generatedViewLanguage: 'en',
      policy: 'Human-authored test review metadata follows the package documentation language.',
    },
    testPolicies: [
      {
        id: 'db-backed-contract-verification',
        kind: 'verification-policy',
        statement: 'Use DB-backed contract tests.',
        appliesTo: ['ddl'],
      },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    testRulesPath,
  });

  expect(result.errors).toHaveLength(0);
});

test('check reports invalid package test policy metadata', () => {
  const work = createTempDir('ddl-docs-check-invalid-test-rules');
  const ddlDir = path.join(work, 'ddl');
  const testRulesPath = path.join(work, 'docs', 'testing', 'test-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(testRulesPath, JSON.stringify({
    schemaVersion: 1,
    testPolicies: [
      { id: 'duplicate', kind: 'verification-policy', statement: 'A.' },
      { id: 'duplicate', kind: 'verification-policy', statement: 'B.' },
      { id: 'unknown-kind', kind: 'not-a-kind', statement: 'C.' },
      { id: 'empty-statement', kind: 'verification-policy', statement: '' },
      { id: 'unknown-artifact', kind: 'verification-policy', statement: 'D.', appliesTo: ['not-an-artifact'] },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    testRulesPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('TEST_POLICY_DUPLICATE_ID');
  expect(result.errors.map((issue) => issue.code)).toContain('TEST_POLICY_UNKNOWN_KIND');
  expect(result.errors.map((issue) => issue.code)).toContain('TEST_POLICY_EMPTY_STATEMENT');
  expect(result.errors.map((issue) => issue.code)).toContain('TEST_POLICY_UNKNOWN_ARTIFACT_KIND');
});

test('check rejects invalid package test metadata language policy', () => {
  const work = createTempDir('ddl-docs-check-invalid-test-language-policy');
  const ddlDir = path.join(work, 'ddl');
  const testRulesPath = path.join(work, 'docs', 'testing', 'test-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(testRulesPath, JSON.stringify({
    schemaVersion: 1,
    metadataLanguagePolicy: {
      humanFacingLanguage: 'ja',
      generatedViewLanguage: '',
      policy: 'Human-authored test review metadata follows the package documentation language.',
    },
    testPolicies: [
      {
        id: 'db-backed-contract-verification',
        kind: 'verification-policy',
        statement: 'Use DB-backed contract tests.',
        appliesTo: ['ddl'],
      },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    testRulesPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('TEST_RULES_SCHEMA_ERROR');
});

test('check validates package authority rule metadata', () => {
  const work = createTempDir('ddl-docs-check-authority-rules');
  const ddlDir = path.join(work, 'ddl');
  const authorityRulesPath = path.join(work, 'docs', 'review', 'authority-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(authorityRulesPath, JSON.stringify({
    schemaVersion: 1,
    metadataLanguagePolicy: {
      humanFacingLanguage: 'ja',
      generatedViewLanguage: 'en',
      policy: 'Human-authored authority review metadata follows the package documentation language.',
    },
    authorityRules: [
      {
        id: 'human-owned-requirements',
        kind: 'requirements-authority',
        statement: 'Humans own requirement-like sources.',
        probes: ['Is this AI proposal treated as pending approval?'],
      },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    authorityRulesPath,
  });

  expect(result.errors).toHaveLength(0);
});

test('check reports invalid package authority rule metadata', () => {
  const work = createTempDir('ddl-docs-check-invalid-authority-rules');
  const ddlDir = path.join(work, 'ddl');
  const authorityRulesPath = path.join(work, 'docs', 'review', 'authority-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(authorityRulesPath, JSON.stringify({
    schemaVersion: 1,
    authorityRules: [
      { id: 'duplicate', kind: 'requirements-authority', statement: 'A.' },
      { id: 'duplicate', kind: 'requirements-authority', statement: 'B.' },
      { id: 'unknown-kind', kind: 'not-a-kind', statement: 'C.' },
      { id: 'empty-statement', kind: 'requirements-authority', statement: '' },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    authorityRulesPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('AUTHORITY_RULE_DUPLICATE_ID');
  expect(result.errors.map((issue) => issue.code)).toContain('AUTHORITY_RULE_UNKNOWN_KIND');
  expect(result.errors.map((issue) => issue.code)).toContain('AUTHORITY_RULE_EMPTY_STATEMENT');
});

test('check rejects invalid package authority metadata language policy', () => {
  const work = createTempDir('ddl-docs-check-invalid-authority-language-policy');
  const ddlDir = path.join(work, 'ddl');
  const authorityRulesPath = path.join(work, 'docs', 'review', 'authority-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(authorityRulesPath, JSON.stringify({
    schemaVersion: 1,
    metadataLanguagePolicy: {
      humanFacingLanguage: '',
      policy: 'Human-authored authority review metadata follows the package documentation language.',
    },
    authorityRules: [
      { id: 'human-owned-requirements', kind: 'requirements-authority', statement: 'Humans own requirements.' },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    authorityRulesPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('AUTHORITY_RULES_SCHEMA_ERROR');
});

test('check validates package technology rule metadata', () => {
  const work = createTempDir('ddl-docs-check-technology-rules');
  const ddlDir = path.join(work, 'ddl');
  const technologyRulesPath = path.join(work, 'docs', 'technology', 'tech-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(technologyRulesPath, JSON.stringify({
    schemaVersion: 1,
    metadataLanguagePolicy: {
      humanFacingLanguage: 'ja',
      generatedViewLanguage: 'en',
      policy: 'Human-authored technology metadata follows the package documentation language.',
    },
    technologyRules: [
      {
        id: 'postgres-primary-db',
        kind: 'database-platform',
        statement: 'Use PostgreSQL as the primary database.',
        probes: ['Does this change assume a non-PostgreSQL primary database?'],
      },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    technologyRulesPath,
  });

  expect(result.errors).toHaveLength(0);
});

test('check reports invalid package technology rule metadata', () => {
  const work = createTempDir('ddl-docs-check-invalid-technology-rules');
  const ddlDir = path.join(work, 'ddl');
  const technologyRulesPath = path.join(work, 'docs', 'technology', 'tech-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(technologyRulesPath, JSON.stringify({
    schemaVersion: 1,
    technologyRules: [
      { id: 'duplicate', kind: 'database-platform', statement: 'A.' },
      { id: 'duplicate', kind: 'database-platform', statement: 'B.' },
      { id: 'unknown-kind', kind: 'not-a-kind', statement: 'C.' },
      { id: 'empty-statement', kind: 'database-platform', statement: '' },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    technologyRulesPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('TECHNOLOGY_RULE_DUPLICATE_ID');
  expect(result.errors.map((issue) => issue.code)).toContain('TECHNOLOGY_RULE_UNKNOWN_KIND');
  expect(result.errors.map((issue) => issue.code)).toContain('TECHNOLOGY_RULE_EMPTY_STATEMENT');
});

test('check rejects invalid package technology metadata language policy', () => {
  const work = createTempDir('ddl-docs-check-invalid-technology-language-policy');
  const ddlDir = path.join(work, 'ddl');
  const technologyRulesPath = path.join(work, 'docs', 'technology', 'tech-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(technologyRulesPath, JSON.stringify({
    schemaVersion: 1,
    metadataLanguagePolicy: {
      humanFacingLanguage: 'ja',
      generatedViewLanguage: '',
      policy: 'Human-authored technology metadata follows the package documentation language.',
    },
    technologyRules: [
      { id: 'postgres-primary-db', kind: 'database-platform', statement: 'Use PostgreSQL.' },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    technologyRulesPath,
  });

  expect(result.errors.map((issue) => issue.code)).toContain('TECHNOLOGY_RULES_SCHEMA_ERROR');
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
  const testingDir = path.join(work, 'docs', 'testing');
  const testRulesPath = path.join(testingDir, 'test-rules.json');
  const testPolicyPath = path.join(testingDir, 'TEST_POLICY.md');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'account/SPEC.md'), '# Account Concept\n');
  writeText(path.join(processesDir, 'account-process.md'), '# Account Process\n');
  writeText(scopeDocPath, '# Scope\n');
  writeText(testPolicyPath, '# Test Policy\n');
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
  writeText(testRulesPath, JSON.stringify({
    schemaVersion: 1,
    testPolicies: [
      {
        id: 'db-backed-contract-verification',
        kind: 'verification-policy',
        statement: 'Use DB-backed contract tests.',
        appliesTo: ['ddl'],
      },
      {
        id: 'no-hot-path-runtime-validation',
        kind: 'mapping-policy',
        statement: 'Shift mapper verification left.',
        appliesTo: ['ddl'],
      },
    ],
  }, null, 2));

  const plan = buildReviewPlan({
    changedFilesPath,
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    relationshipPath,
    conceptRelationshipPath,
    processDirectories: [processesDir],
    scopeRulesPath,
    scopeDocPath,
    testRulesPath,
    testPolicyPath,
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
  expect(plan.changedFiles[0]?.requiredReads.testPolicies).toEqual([
    'db-backed-contract-verification',
    'no-hot-path-runtime-validation',
  ]);
  expect(plan.changedFiles[0]?.reviewRisks).toEqual(['ownership-boundary']);
  expect(plan.mandatoryVerification?.files).toEqual([testPolicyPath, testRulesPath]);
  expect(plan.mandatoryVerification?.policies.map((policy) => policy.id)).toEqual([
    'db-backed-contract-verification',
    'no-hot-path-runtime-validation',
  ]);
});

test('review-plan rejects unknown test policy artifact kinds', () => {
  const work = createTempDir('ddl-docs-review-plan-invalid-test-rules');
  const ddlDir = path.join(work, 'ddl');
  const testingDir = path.join(work, 'docs', 'testing');
  const changedFilesPath = path.join(work, 'changed-files.txt');
  const testRulesPath = path.join(testingDir, 'test-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(changedFilesPath, `${path.join(ddlDir, 'accounts.sql')}\n`);
  writeText(testRulesPath, JSON.stringify({
    schemaVersion: 1,
    testPolicies: [
      {
        id: 'bad-applies-to',
        kind: 'verification-policy',
        statement: 'This policy should not load.',
        appliesTo: ['not-an-artifact'],
      },
    ],
  }, null, 2));

  expect(() => buildReviewPlan({
    changedFilesPath,
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    testRulesPath,
  })).toThrow(/test-rules metadata must have schemaVersion: 1 and testPolicies\[\]/u);
});

test('review-plan treats DDL control files as technical support when explicitly mapped', () => {
  const work = createTempDir('ddl-docs-review-plan-ddl-control');
  const ddlDir = path.join(work, 'ddl');
  const changedFilesPath = path.join(work, 'changed-files.txt');
  const relationshipPath = path.join(ddlDir, 'relationship.json');
  const schemaPath = path.join(ddlDir, 'schema.sql');

  writeText(schemaPath, 'CREATE SCHEMA app;');
  writeText(changedFilesPath, `${schemaPath}\n`);
  writeText(relationshipPath, JSON.stringify({
    schemaVersion: 1,
    relationships: [
      {
        path: 'schema.sql',
        kind: 'ddl-control',
        reason: 'Creates the package schema.',
      },
    ],
  }, null, 2));

  const plan = buildReviewPlan({
    changedFilesPath,
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    relationshipPath,
  });

  expect(plan.unmappedArtifacts).toHaveLength(0);
  expect(plan.changedFiles[0]?.diagnostics).toHaveLength(0);
  expect(plan.changedFiles[0]?.requiredReads.scopeRules).toEqual([]);
  expect(plan.changedFiles[0]?.requiredReads.concepts).toEqual([]);
  expect(plan.changedFiles[0]?.requiredReads.processes).toEqual([]);
  expect(plan.changedFiles[0]?.reviewRisks).toEqual([]);
});

test('review-plan includes package technology policy as mandatory review input', () => {
  const work = createTempDir('ddl-docs-review-plan-technology-policy');
  const ddlDir = path.join(work, 'ddl');
  const technologyDir = path.join(work, 'docs', 'technology');
  const changedFilesPath = path.join(work, 'changed-files.txt');
  const technologyPolicyPath = path.join(technologyDir, 'TECHNOLOGY_POLICY.md');
  const technologyRulesPath = path.join(technologyDir, 'tech-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(technologyPolicyPath, '# Technology Policy\n');
  writeText(technologyRulesPath, JSON.stringify({
    schemaVersion: 1,
    metadataLanguagePolicy: {
      humanFacingLanguage: 'ja',
      generatedViewLanguage: 'en',
      policy: 'Human-authored technology metadata follows the package documentation language.',
    },
    technologyRules: [
      { id: 'postgres-primary-db', kind: 'database-platform', statement: 'Use PostgreSQL.' },
      { id: 'sql-first-ztd-cli', kind: 'data-access', statement: 'Use SQL-first ztd-cli.' },
      { id: 'no-standard-orm-path', kind: 'data-access-boundary', statement: 'Do not introduce an ORM standard path.' },
      { id: 'cli-front-facing-surface', kind: 'front-facing-surface', statement: 'Use CLI as the package front-facing surface.' },
    ],
  }, null, 2));
  writeText(changedFilesPath, `${technologyPolicyPath}\n${technologyRulesPath}\n`);

  const plan = buildReviewPlan({
    changedFilesPath,
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    technologyPolicyPath,
    technologyRulesPath,
  });

  expect(plan.mandatoryTechnology?.files).toEqual([technologyPolicyPath, technologyRulesPath]);
  expect(plan.mandatoryTechnology?.rules.map((entry) => entry.id)).toEqual([
    'postgres-primary-db',
    'sql-first-ztd-cli',
    'no-standard-orm-path',
    'cli-front-facing-surface',
  ]);
  expect(plan.changedFiles.map((entry) => entry.artifactKind)).toEqual(['technology-policy', 'technology-rules']);
  expect(plan.changedFiles[0]?.packageWideImpact).toBe(true);
  expect(plan.changedFiles[0]?.requiredReads.technologyRules).toEqual([
    'postgres-primary-db',
    'sql-first-ztd-cli',
    'no-standard-orm-path',
    'cli-front-facing-surface',
  ]);
});

test('review-plan flags transfer technology policy exceptions from changed implementation files', () => {
  const work = createTempDir('ddl-docs-review-plan-technology-exception-signals');
  const ddlDir = path.join(work, 'ddl');
  const transferDir = path.join(work, 'packages', 'transfer');
  const srcDir = path.join(transferDir, 'src');
  const changedFilesPath = path.join(work, 'changed-files.txt');
  const technologyDir = path.join(transferDir, 'docs', 'technology');
  const technologyRulesPath = path.join(technologyDir, 'tech-rules.json');
  const manifestPath = path.join(transferDir, 'package.json');
  const uiPath = path.join(srcDir, 'admin.tsx');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(technologyRulesPath, JSON.stringify({
    schemaVersion: 1,
    technologyRules: [
      { id: 'postgres-primary-db', kind: 'database-platform', statement: 'Use PostgreSQL.' },
      { id: 'no-standard-orm-path', kind: 'data-access-boundary', statement: 'Do not introduce an ORM standard path.' },
      { id: 'cli-front-facing-surface', kind: 'front-facing-surface', statement: 'Use CLI as the package front-facing surface.' },
    ],
  }, null, 2));
  writeText(manifestPath, JSON.stringify({
    dependencies: {
      'drizzle-orm': '^0.1.0',
      mysql2: '^3.0.0',
    },
  }, null, 2));
  writeText(uiPath, "import React from 'react';\nexport const Admin = () => <main />;\n");
  writeText(changedFilesPath, `${manifestPath}\n${uiPath}\n`);

  const plan = buildReviewPlan({
    changedFilesPath,
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    technologyRulesPath,
  });

  const manifestPlan = plan.changedFiles.find((entry) => entry.path === manifestPath.replace(/\\/g, '/'));
  const uiPlan = plan.changedFiles.find((entry) => entry.path === uiPath.replace(/\\/g, '/'));

  expect(manifestPlan?.reviewRisks).toContain('technology-policy-exception');
  expect(manifestPlan?.requiredReads.technologyRules).toEqual([
    'no-standard-orm-path',
    'postgres-primary-db',
  ]);
  expect(manifestPlan?.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
    'Technology policy review required: transfer change references an ORM or ORM-like data access dependency.',
    'Technology policy review required: transfer change references a non-PostgreSQL database dependency or adapter.',
  ]);
  expect(uiPlan?.reviewRisks).toContain('technology-policy-exception');
  expect(uiPlan?.requiredReads.technologyRules).toEqual(['cli-front-facing-surface']);
  expect(uiPlan?.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
    'Technology policy review required: transfer change appears to introduce a Web/UI surface; transfer package front-facing surface is CLI.',
  ]);
});

test('review-plan includes package review authority model as mandatory review input', () => {
  const work = createTempDir('ddl-docs-review-plan-authority-model');
  const ddlDir = path.join(work, 'ddl');
  const reviewDir = path.join(work, 'docs', 'review');
  const changedFilesPath = path.join(work, 'changed-files.txt');
  const authorityModelPath = path.join(reviewDir, 'AUTHORITY_MODEL.md');
  const authorityRulesPath = path.join(reviewDir, 'authority-rules.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(authorityModelPath, '# Authority Model\n');
  writeText(authorityRulesPath, JSON.stringify({
    schemaVersion: 1,
    metadataLanguagePolicy: {
      humanFacingLanguage: 'ja',
      generatedViewLanguage: 'en',
      policy: 'Human-authored authority metadata follows the package documentation language.',
    },
    authorityRules: [
      { id: 'human-owned-requirements', kind: 'requirements-authority', statement: 'Humans own requirements.' },
      { id: 'ai-owned-review-management', kind: 'review-workflow-authority', statement: 'AI manages review workflows.' },
      { id: 'cli-owned-review-views', kind: 'generated-review-authority', statement: 'CLI owns generated review views.' },
    ],
  }, null, 2));
  writeText(changedFilesPath, `${authorityModelPath}\n${authorityRulesPath}\n`);

  const plan = buildReviewPlan({
    changedFilesPath,
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    authorityModelPath,
    authorityRulesPath,
  });

  expect(plan.mandatoryAuthority?.files).toEqual([authorityModelPath, authorityRulesPath]);
  expect(plan.mandatoryAuthority?.rules.map((entry) => entry.id)).toEqual([
    'human-owned-requirements',
    'ai-owned-review-management',
    'cli-owned-review-views',
  ]);
  expect(plan.changedFiles.map((entry) => entry.artifactKind)).toEqual(['authority-model', 'authority-rules']);
  expect(plan.changedFiles[0]?.packageWideImpact).toBe(true);
  expect(plan.changedFiles[0]?.requiredReads.authorityRules).toEqual([
    'human-owned-requirements',
    'ai-owned-review-management',
    'cli-owned-review-views',
  ]);
  expect(plan.changedFiles[0]?.reviewRisks).toEqual(['package-review-authority-impact']);
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
