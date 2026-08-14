import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const seed = 'rawsql-mcp-integration-holdout-v1';
const pick = (label, values) => {
  const digest = createHash('sha256').update(`${seed}:${label}`).digest();
  return values[digest.readUInt32BE(0) % values.length];
};

const impactColumn = pick('impact-column', ['account_id', 'tenant_id', 'owner_id']);
const impactTable = pick('impact-table', ['invoices', 'shipments', 'events']);
const transformCte = pick('transform-cte', ['eligible_rows', 'ranked_rows', 'recent_rows']);
const rootParameter = pick('fixture-parameter', ['account_id', 'tenant_id', 'customer_id']);

const scenarios = [
  {
    id: 'holdout-impact', category: 'semantic-impact',
    prompt: `A migration will change public.${impactTable}.${impactColumn}. Inspect project SQL and identify the exact affected files and clause types without including same-named columns from other tables.`,
    files: [
      { path: `queries/${impactTable}_filter.sql`, content: `select id from public.${impactTable} where ${impactColumn} = :${impactColumn};\n` },
      { path: `queries/${impactTable}_join.sql`, content: `select x.id from public.${impactTable} x join public.accounts a on a.id = x.${impactColumn};\n` },
      { path: 'queries/decoy.sql', content: `select ${impactColumn} from public.audit_log where ${impactColumn} is not null;\n` }
    ],
    toolPolicy: { requiredAnyOf: [['find_query_usage']], allowed: ['find_query_usage'], maxCalls: 2 },
    answerEvidence: [`${impactTable}_filter.sql`, `${impactTable}_join.sql`, 'decoy.sql']
  },
  {
    id: 'holdout-transform', category: 'safe-transform',
    prompt: `Extract the CTE ${transformCte} from queries/report.sql as standalone executable SQL if its dependencies and lexical boundary are statically safe. Otherwise stop and explain the blocker.`,
    files: [{ path: 'queries/report.sql', content: `with base as (select id, status from public.jobs),\n${transformCte} as (select id from base where status = 'ready')\nselect * from ${transformCte};\n` }],
    toolPolicy: { requiredAnyOf: [['extract_cte_query']], allowed: ['extract_cte_query', 'analyze_query_structure', 'slice_query'], maxCalls: 2 },
    answerEvidence: ['with base as', `select * from ${transformCte}`]
  },
  {
    id: 'holdout-fixture', category: 'fixture-plan',
    prompt: `Using query.sql and schema/, create a static bounded fixture extraction plan for :${rootParameter}. Do not execute SQL and fail closed if the root predicate cannot be proven.`,
    files: [
      { path: 'schema/root.sql', content: `create table public.roots (id bigint primary key, ${rootParameter} bigint not null);\n` },
      { path: 'schema/child.sql', content: 'create table public.children (id bigint primary key, root_id bigint not null references public.roots(id));\n' },
      { path: 'query.sql', content: `select r.id, c.id as child_id from public.roots r join public.children c on c.root_id = r.id where r.${rootParameter} = :${rootParameter};\n` }
    ],
    toolPolicy: { requiredAnyOf: [['create_fixture_extraction_plan']], allowed: ['create_fixture_extraction_plan'], maxCalls: 1 },
    answerEvidence: [rootParameter, 'roots', 'children']
  },
  {
    id: 'holdout-negative', category: 'simple-negative',
    prompt: 'Explain the ordering in queries/labels.sql in one sentence.',
    files: [{ path: 'queries/labels.sql', content: 'select code, label from public.labels order by label, code;\n' }],
    toolPolicy: { requiredAnyOf: [], allowed: [], maxCalls: 0 },
    answerEvidence: ['label', 'code']
  }
];

const packet = JSON.stringify({ schemaVersion: 1, set: 'holdout', seed, scenarios }, null, 2) + '\n';
const outDir = resolve('tmp/mcp-integration-eval/holdout');
await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, 'scenarios.json'), packet, 'utf8');
await writeFile(resolve(outDir, 'sha256.txt'), `${createHash('sha256').update(packet).digest('hex')}  scenarios.json\n`, 'utf8');
