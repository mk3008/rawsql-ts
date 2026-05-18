import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { checkDocs, runCheckDocs } from '../src/commands/check';
import { updateConceptDisplayName } from '../src/commands/conceptDisplayName';
import { buildReviewPlan } from '../src/commands/reviewPlan';
import { runStructuredConceptBuild } from '../src/commands/structuredConcept';

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

test('concept-display-name updates concept registry displayName and reports relationships', () => {
  const work = createTempDir('ddl-docs-concept-display-name');
  const conceptRelationshipPath = path.join(work, 'concept-relationship.json');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [
      {
        id: 'duplicate-control',
        displayName: 'Duplicate Control',
        status: 'candidate',
        path: null,
      },
      {
        id: 'work-item',
        displayName: 'Work Item',
        status: 'defined',
        path: 'work-item/concept.json',
      },
    ],
    relationships: [
      {
        from: 'work-item',
        to: 'duplicate-control',
        kind: 'uses',
        reason: 'Work Item uses duplicate control.',
      },
    ],
  }, null, 2));

  const report = updateConceptDisplayName({
    conceptRelationshipPath,
    id: 'duplicate-control',
    displayName: '重複制御',
    dryRun: false,
  });

  const updated = JSON.parse(readFileSync(conceptRelationshipPath, 'utf8')) as {
    concepts: Array<{ id: string; displayName: string }>;
  };
  expect(updated.concepts.find((concept) => concept.id === 'duplicate-control')?.displayName).toBe('重複制御');
  expect(report.concept.oldDisplayName).toBe('Duplicate Control');
  expect(report.concept.newDisplayName).toBe('重複制御');
  expect(report.relationships.incoming).toHaveLength(1);
  expect(report.relationships.outgoing).toHaveLength(0);
  expect(report.written).toBe(true);
});

test('structured-concept build renders review page and generated indexes from concept json', () => {
  const work = createTempDir('ddl-docs-structured-concept');
  const conceptDir = path.join(work, 'concepts');
  const activeBlackDir = path.join(conceptDir, 'active-black');
  const duplicateDir = path.join(conceptDir, 'duplicate-control');
  const transferRunDir = path.join(conceptDir, 'transfer-run');
  const outDir = path.join(work, 'docs', 'concepts');
  const relationshipOut = path.join(work, 'tmp', 'concept-relationship.json');
  const reverseOut = path.join(work, 'tmp', 'concept-reverse-relationships.json');
  const aiContextOut = path.join(work, 'tmp', 'ai-context', 'concepts.json');
  const summaryOut = path.join(work, 'tmp', 'structured-concept-review-summary.json');
  writeText(path.join(activeBlackDir, 'concept.json'), '# Active Black\n');
  writeText(path.join(activeBlackDir, 'concept.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'active-black',
    displayName: 'Active Black',
    lifecycle: { status: 'defined' },
    summary: '現在有効な黒伝。',
    sources: [
      { id: 'spec:active-black', type: 'spec', path: 'concept.json' },
    ],
    sections: {
      definition: {
        coverage: 'complete',
        items: [
          { id: 'definition', text: 'Active Black は現在有効な黒伝である。', sources: ['spec:active-black'] },
        ],
      },
      goals: {
        coverage: 'complete',
        items: [
          { id: 'identify-current-black', text: '現在有効な黒伝を特定する。', sources: ['spec:active-black'] },
        ],
      },
      nonResponsibilities: {
        coverage: 'none',
        reason: 'This fixture does not need non-responsibilities.',
        items: [],
      },
      invariants: {
        coverage: 'complete',
        items: [
          { id: 'current-only', text: '取り消し済みの黒伝は Active Black ではない。', sources: ['spec:active-black'] },
        ],
      },
      openIssues: {
        coverage: 'none',
        reason: 'This fixture has no open questions.',
        items: [],
      },
    },
    links: [],
    relationships: [],
  }, null, 2));
  writeText(path.join(duplicateDir, 'DRAFT.md'), '# 重複制御 Draft\n');
  writeText(path.join(duplicateDir, 'concept.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'duplicate-control',
    displayName: '重複制御',
    lifecycle: { status: 'draft', sourceDraft: 'DRAFT.md' },
    summary: 'Dirty Key を転送作業対象にするか、転送不要として扱うかを分ける判断境界。',
    sources: [
      { id: 'draft:duplicate-control', type: 'draft', path: 'DRAFT.md' },
    ],
    sections: {
      definition: {
        coverage: 'partial',
        reason: 'Definition is still a PoC review result.',
        resolutionCriteria: [
          { id: 'confirm-definition', text: 'Confirm the definition boundary.', sources: ['draft:duplicate-control'] },
        ],
        items: [
          { id: 'definition', text: '重複制御は転送要否を分ける判断境界である。', sources: ['draft:duplicate-control'] },
        ],
      },
      goals: {
        coverage: 'partial',
        reason: 'Goals are still a PoC review result.',
        resolutionCriteria: [
          { id: 'confirm-goals', text: 'Confirm whether all draft responsibilities are goals.', sources: ['draft:duplicate-control'] },
        ],
        items: [
          { id: 'avoid-duplicate-transfer', text: '同じ転送判断を二重転送しない。', sources: ['draft:duplicate-control'] },
        ],
      },
      nonResponsibilities: {
        coverage: 'none',
        reason: 'PoC keeps non-responsibilities empty intentionally.',
        items: [],
      },
      invariants: {
        coverage: 'partial',
        reason: 'Invariants are still a PoC review result.',
        resolutionCriteria: [
          { id: 'confirm-invariants', text: 'Confirm remaining invariant candidates.', sources: ['draft:duplicate-control'] },
        ],
        items: [
          { id: 'dirty-key-not-mutated', text: 'Dirty Key 自体には処理済み状態を書き込まない。', sources: ['draft:duplicate-control'] },
        ],
      },
      openIssues: {
        coverage: 'partial',
        reason: 'Open issues are still a PoC review result.',
        resolutionCriteria: [
          { id: 'confirm-open-issues', text: 'Confirm remaining draft open questions.', sources: ['draft:duplicate-control'] },
        ],
        items: [
          { id: 'ownership-boundary', question: '独立Conceptにするか。', status: 'open', sources: ['draft:duplicate-control'] },
        ],
      },
    },
    links: [
      {
        from: 'goals.avoid-duplicate-transfer',
        to: 'definition.definition',
        kind: 'supports',
        reason: 'The goal depends on the duplicate-control boundary.',
        sources: ['draft:duplicate-control'],
      },
    ],
    relationships: [
      { to: 'active-black', kind: 'uses', reason: '現在有効な黒伝があるかを判断するため。', sources: ['draft:duplicate-control'] },
    ],
  }, null, 2));
  writeText(path.join(transferRunDir, 'concept.json'), '# Transfer Run\n');
  writeText(path.join(transferRunDir, 'concept.json'), JSON.stringify({
    schemaVersion: 2,
    id: 'transfer-run',
    displayName: '転送実行記録',
    lifecycle: { status: 'defined' },
    definition: {
      summary: 'Transfer Execution が生成する実行引数記録兼プロセスヘッダー。',
      statements: [
        {
          id: 'run-header',
          displayName: '実行ヘッダー',
          polarity: 'positive',
          type: 'essence',
          text: 'Transfer Run は実行引数記録兼プロセスヘッダーである。',
          evidence: ['spec:transfer-run'],
        },
        {
          id: 'current-black-reference',
          displayName: '有効黒伝を参照',
          polarity: 'positive',
          type: 'responsibility',
          text: 'Transfer Run は有効黒伝を参照できる。',
          evidence: ['spec:transfer-run'],
        },
        {
          id: 'duplicate-control-distinct',
          displayName: '重複制御を再定義しない',
          polarity: 'negative',
          type: 'boundary',
          text: 'Transfer Run は重複制御を再定義しない。',
          evidence: ['spec:transfer-run'],
          negatesSimilarityWith: ['duplicate-control'],
        },
      ],
    },
    evidence: [
      { id: 'spec:transfer-run', type: 'spec', path: 'concept.json' },
    ],
    internalLinks: [],
    externalRelationships: [
      {
        to: 'active-black',
        kind: 'uses',
        reason: 'Transfer Run は有効黒伝を参照する。',
        supportedBy: ['current-black-reference'],
        evidence: ['spec:transfer-run'],
      },
      {
        to: 'duplicate-control',
        kind: 'must-not-redefine',
        reason: 'Transfer Run は重複制御の判断境界を再定義しない。',
        supportedBy: ['duplicate-control-distinct'],
        evidence: ['spec:transfer-run'],
      },
    ],
    reviewState: {
      coverage: {
        definition: { status: 'complete', reason: 'Fixture definition is complete.' },
        relationships: { status: 'complete', reason: 'Fixture relationships are complete.' },
      },
      openIssues: [],
    },
  }, null, 2));
  writeText(path.join(conceptDir, 'concept-relationship.json'), JSON.stringify({
    schemaVersion: 1,
    concepts: [
      { id: 'active-black', displayName: 'Active Black', status: 'defined', path: 'active-black/concept.json' },
      { id: 'duplicate-control', displayName: '重複制御', status: 'draft', path: 'duplicate-control/concept.json', draftPath: 'duplicate-control/DRAFT.md' },
      { id: 'transfer-run', displayName: '転送実行記録', status: 'defined', path: 'transfer-run/concept.json' },
    ],
    relationships: [],
  }, null, 2));

  runStructuredConceptBuild({
    conceptDirectories: [conceptDir],
    conceptRelationshipPath: path.join(conceptDir, 'concept-relationship.json'),
    outDir,
    relationshipOutPath: relationshipOut,
    reverseRelationshipOutPath: reverseOut,
    aiContextOutPath: aiContextOut,
    reviewSummaryOutPath: summaryOut,
  });

  const conceptPage = readFileSync(path.join(outDir, 'duplicate-control.md'), 'utf8');
  expect(conceptPage).toContain('# 重複制御');
  expect(conceptPage).toContain('- Schema version: `1`');
  expect(conceptPage).toContain('- Open questions: present');
  expect(conceptPage).toContain('## Open Questions');
  expect(conceptPage).toContain('## Definition Statements');
  expect(conceptPage).toContain('## Coverage');
  expect(conceptPage).toContain('## Internal Links');
  expect(conceptPage).toContain('## External Relationships');
  expect(conceptPage).toContain('<a href="./active-black">Active Black</a><br><small><code>active-black</code></small>');
  const transferRunPage = readFileSync(path.join(outDir, 'transfer-run.md'), 'utf8');
  expect(transferRunPage).toContain('<div class="concept-review-summary dense">');
  expect(transferRunPage).toContain('<span class="concept-status ok">defined</span>');
  expect(transferRunPage).toContain('<span class="concept-status ok">open questions none</span>');
  expect(transferRunPage).toContain('<span>format schema <code>v2</code></span>');
  expect(transferRunPage).toContain('<span class="concept-status ok">meaning: present</span>');
  expect(transferRunPage).toContain('<span class="concept-status ok">responsibilities: present</span>');
  expect(transferRunPage).toContain('<span class="concept-status ok">boundaries: present</span>');
  expect(transferRunPage).toContain('<span class="concept-status warn">invariants: missing</span>');
  expect(transferRunPage).toContain('<span class="concept-status neutral">rationale: not set</span>');
  expect(transferRunPage).toContain('<span class="concept-status ok">evidence: present</span>');
  expect(transferRunPage).toContain('<span class="concept-status ok">linked concepts: present</span>');
  expect(transferRunPage).not.toContain('relationships <strong>');
  expect(transferRunPage).not.toContain('statements <strong>');
  expect(transferRunPage).toContain('<div class="concept-related-concepts">');
  expect(transferRunPage).not.toContain('<span>Related concepts</span>');
  expect(transferRunPage).toContain('<div class="concept-definition-summary">Transfer Execution が生成する実行引数記録兼プロセスヘッダー。</div>');
  expect(transferRunPage).toContain('<a href="./active-black">Active Black</a>');
  expect(transferRunPage).toContain('<a href="./duplicate-control">重複制御</a>');
  expect(transferRunPage).toContain('<p class="concept-section-count">1 statements</p>');
  expect(transferRunPage).toContain('| Active Black<br><small><code>active-black</code></small> | `uses` |');
  expect(transferRunPage).not.toContain('| <a href="./active-black">Active Black</a>');
  const relationshipJson = JSON.parse(readFileSync(relationshipOut, 'utf8')) as { relationships: unknown[] };
  expect(relationshipJson.relationships).toHaveLength(3);
  const summaryJson = JSON.parse(readFileSync(summaryOut, 'utf8')) as {
    coverage: Array<{ id: string; openIssueCount: number; internalLinkCount: number }>;
    validation: { errors: number; warnings: number };
  };
  expect(summaryJson.validation.errors).toBe(0);
  expect(summaryJson.validation.warnings).toBe(0);
  expect(summaryJson.coverage).toContainEqual(expect.objectContaining({ id: 'duplicate-control', openIssueCount: 1, internalLinkCount: 1 }));
});

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
  writeText(path.join(conceptsDir, 'account/concept.json'), '# Account Concept\n');
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
        concepts: [{ path: '../docs/concepts/account/concept.json', reason: 'Account concept.' }],
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
      path: 'account/concept.json',
      status: 'defined',
      summary: 'Account concept.',
    }],
    relationships: [],
    views: [{ id: 'account-view', concepts: ['account'] }],
    glossaryTerms: [
      {
        id: 'account-key',
        displayTerm: 'account key',
        definedIn: ['account/concept.json'],
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
    concepts: [{ id: 'account', path: 'account/concept.json', status: 'defined' }],
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

test('check fails when DFD related process does not exist in process-map metadata', () => {
  const work = createTempDir('ddl-docs-check-dfd-related-process');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const dfdDir = path.join(work, 'docs', 'dfd');
  const processesDir = path.join(work, 'docs', 'processes');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');
  const dfdRelationshipPath = path.join(dfdDir, 'relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'account/concept.json'), '# Account Concept\n');
  writeText(path.join(dfdDir, 'account-flow.md'), [
    '# Account Flow',
    '',
    '## Account Registration',
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
    processMaps: [{ id: 'account-process', path: 'account-process.md' }],
  }, null, 2));
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [{ id: 'account', path: 'account/concept.json', status: 'defined' }],
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
            relatedProcesses: [
              { id: 'missing-process', path: '../processes/missing-process.md' },
            ],
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
    processDirectories: [processesDir],
  });

  const codes = result.errors.map((issue) => issue.code);
  expect(codes).toContain('DFD_RELATED_PROCESS_MISSING_PATH');
  expect(codes).toContain('DFD_RELATED_PROCESS_UNKNOWN_PROCESS');
});

test('check fails when concept related process map does not exist in process-map metadata', () => {
  const work = createTempDir('ddl-docs-check-concept-related-process-map');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const processesDir = path.join(work, 'docs', 'processes');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'account/concept.json'), '# Account Concept\n');
  writeText(
    path.join(processesDir, 'account-process.md'),
    '# Account Process\n\n## Process Map Rule Reference\n\nThis document follows the shared [Process Map Rules](../../../docs/guide/concept-spec-overview.md#process-map-rules).\n'
  );
  writeText(path.join(processesDir, 'process-map.json'), JSON.stringify({
    schemaVersion: 1,
    processMaps: [{ id: 'account-process', path: 'account-process.md' }],
  }, null, 2));
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [{ id: 'account', path: 'account/concept.json', status: 'defined' }],
    relatedProcessMaps: [
      {
        id: 'missing-process',
        displayName: 'Missing Process',
        path: '../processes/account-process.md',
      },
    ],
  }, null, 2));

  const result = checkDocs({
    ddlDirectories: [{ path: ddlDir, instance: '' }],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    conceptRelationshipPath,
    processDirectories: [processesDir],
  });

  expect(result.errors.map((issue) => issue.code)).toContain('CONCEPT_RELATED_PROCESS_MAP_UNKNOWN_PROCESS');
});

test('check warns when DFD operation has no Mermaid Who labels', () => {
  const work = createTempDir('ddl-docs-check-dfd-who-missing');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const dfdDir = path.join(work, 'docs', 'dfd');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');
  const dfdRelationshipPath = path.join(dfdDir, 'relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'account/concept.json'), '# Account Concept\n');
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
    concepts: [{ id: 'account', path: 'account/concept.json', status: 'defined' }],
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
  writeText(path.join(conceptsDir, 'account/concept.json'), '# Account Concept\n');
  writeText(path.join(conceptsDir, 'customer/concept.json'), '# Customer Concept\n');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [
      {
        id: 'account',
        displayName: 'Account',
        path: 'account/concept.json',
        status: 'defined',
      },
      {
        id: 'customer',
        displayName: 'Customer',
        path: 'customer/concept.json',
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
  writeText(path.join(conceptsDir, 'account/concept.json'), '# Account Concept\n');
  writeText(path.join(conceptsDir, 'customer/concept.json'), '# Customer Concept\n');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [
      {
        id: 'account',
        displayName: 'Account',
        path: 'account/concept.json',
        status: 'defined',
        summary: 'Account concept.',
        note: longText,
      },
      {
        id: 'customer',
        displayName: 'Customer',
        path: 'customer/concept.json',
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
        definedIn: ['account/concept.json'],
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

test('check fails when concept lifecycle metadata drifts from concept.json and draft notes', () => {
  const work = createTempDir('ddl-docs-check-concept-lifecycle');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'defined-with-draft/concept.json'), '# Defined With Draft\n');
  writeText(path.join(conceptsDir, 'defined-with-draft/DRAFT.md'), '# Stale Draft\n');
  writeText(path.join(conceptsDir, 'draft-without-concept/DRAFT.md'), '# Draft Without Concept\n');
  writeText(path.join(conceptsDir, 'path-not-concept-json/README.md'), '# Wrong Path\n');
  writeText(path.join(conceptsDir, 'unregistered/concept.json'), '# Unregistered\n');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [
      { id: 'defined-with-draft', path: 'defined-with-draft/concept.json', status: 'defined' },
      { id: 'path-not-concept-json', path: 'path-not-concept-json/README.md', status: 'defined' },
      { id: 'defined-without-path', status: 'defined' },
      { id: 'draft-without-path', status: 'draft' },
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
  expect(codes).toContain('CONCEPT_DEFINED_MISSING_PATH');
  expect(codes).toContain('CONCEPT_DRAFT_MISSING_PATH');
  expect(codes).toContain('CONCEPT_DEFINED_PATH_NOT_CONCEPT_JSON');
  expect(codes).toContain('CONCEPT_DRAFT_WITHOUT_CONCEPT_JSON');
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
  writeText(path.join(conceptsDir, 'account/concept.json'), '# Account Concept\n');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [{ id: 'account', path: 'account/concept.json', status: 'defined' }],
    glossaryTerms: [
      {
        id: 'account-key',
        displayTerm: 'account key',
        definedIn: ['missing/concept.json'],
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

test('check fails when non-authoritative concepts have concept files or authoritative paths', () => {
  const work = createTempDir('ddl-docs-check-non-authoritative-concepts');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');

  writeText(path.join(ddlDir, 'accounts.sql'), 'CREATE TABLE public.accounts (account_id bigint PRIMARY KEY);');
  writeText(path.join(conceptsDir, 'candidate-with-spec/concept.json'), '# Candidate With Spec\n');
  writeText(path.join(conceptsDir, 'alias-with-draft-path/DRAFT.md'), '# Alias Draft\n');
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [
      { id: 'candidate-with-spec', status: 'candidate' },
      { id: 'alias-with-path', path: 'alias-with-path/concept.json', status: 'alias' },
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
  expect(codes).toContain('CONCEPT_NON_AUTHORITATIVE_HAS_CONCEPT_OR_DRAFT');
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
    concepts: [{ id: 'account', path: 'account/concept.json', status: 'defined' }],
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
  writeText(path.join(conceptsDir, 'account/concept.json'), '# Account Concept\n');
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
    concepts: [{ id: 'account', path: 'account/concept.json', status: 'defined' }],
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
  writeText(path.join(conceptsDir, 'account/concept.json'), '# Account Concept\n');
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
    concepts: [{ id: 'account', path: 'account/concept.json', status: 'defined' }],
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
  writeText(path.join(conceptsDir, 'account/concept.json'), '# Account Concept\n');
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
        concepts: [{ path: '../docs/concepts/account/concept.json' }],
        processes: [{ path: '../docs/processes/account-process.md' }],
      },
    ],
  }, null, 2));
  writeText(conceptRelationshipPath, JSON.stringify({
    schemaVersion: 1,
    concepts: [{ id: 'account', path: 'account/concept.json', status: 'defined' }],
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
