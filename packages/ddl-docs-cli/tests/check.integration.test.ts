import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { checkDocs, runCheckDocs } from '../src/commands/check';

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
  const processesDir = path.join(work, 'docs', 'processes');
  const tableDocsPath = path.join(ddlDir, 'table-docs.json');
  const relationshipPath = path.join(ddlDir, 'relationship.json');
  const orderPath = path.join(ddlDir, 'order.json');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');

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
  writeText(path.join(processesDir, 'account-process.md'), '# Account Process\n');
  writeText(tableDocsPath, JSON.stringify({
    schemaVersion: 1,
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
    concepts: [{ id: 'account', path: 'account/SPEC.md', status: 'defined' }],
    relationships: [],
    views: [{ id: 'account-view', concepts: ['account'] }],
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
  });

  expect(result.errors).toHaveLength(0);
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
