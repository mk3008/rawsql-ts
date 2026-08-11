import { SqlParser, SimpleSelectQuery } from 'rawsql-ts';
import { describe, expect, it } from 'vitest';
import { parseSchemaFactsFromDdl } from '../schemaFacts';
import {
  canonicalFixtureExtractionPlanJson,
  FIXTURE_EXTRACTION_PLAN_SCHEMA_VERSION,
  FixtureExtractionInputError,
  type FixtureExtractionInput,
} from './fixtureExtractionPlan';
import { generateFixtureExtractionPlan } from './generateFixtureExtractionPlan';

function input(sql: string, ddl: string | undefined, rootRelation: string, rootColumn: string, parameterName = rootColumn): FixtureExtractionInput {
  return {
    sql,
    ...(ddl ? { ddl: [{ sql: ddl }] } : {}),
    reproductionKey: { parameterNames: [parameterName], rootRelation, rootColumns: [rootColumn] },
  };
}

function expectReadySql(plan: ReturnType<typeof generateFixtureExtractionPlan>): void {
  expect(plan.status).toBe('ready');
  expect(plan.blockedReasons).toEqual([]);
  for (const step of plan.steps) {
    expect(step.sql).not.toBeNull();
    expect(step.blockedReasonCodes).toEqual([]);
    expect(SqlParser.parse(step.sql!)).toBeInstanceOf(SimpleSelectQuery);
    expect(step.sql).not.toMatch(/\blimit\b/i);
    expect(step.parameterNames.every((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name))).toBe(true);
  }
}

describe('generateFixtureExtractionPlan', () => {
  it('generates the contract-aligned single-table root plan', () => {
    const plan = generateFixtureExtractionPlan({
      sql: 'select t.ticket_id, t.subject, t.priority\nfrom support_ticket as t\nwhere t.ticket_id = :ticket_id;',
      ddl: [{ sql: 'create table support_ticket (ticket_id integer primary key, subject text not null, priority integer not null);' }],
    });

    expectReadySql(plan);
    expect(plan).toMatchObject({
      kind: 'fixture-extraction-plan',
      schemaVersion: FIXTURE_EXTRACTION_PLAN_SCHEMA_VERSION,
    });
    expect(plan.source.sqlHash).toBe('sha256:ff6a4c5e65999765edfd34f5524930361c1bd518ac5528dbcc8d3290b70d961e');
    expect(plan.reproductionKey).toMatchObject({
      parameterNames: ['ticket_id'],
      rootRelation: 'support_ticket',
      rootRelationOccurrenceId: 'relation-occurrence:0001',
      rootColumns: ['ticket_id'],
      columnParameterMappings: [{ parameterName: 'ticket_id', rootColumn: 'ticket_id' }],
      status: 'resolved',
    });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({
      id: 'fixture-step:001',
      relationName: 'support_ticket',
      artifactKind: 'fixture_extraction_query',
      captureColumns: { mode: 'ddl_columns', columnNames: ['priority', 'subject', 'ticket_id'] },
      sql: 'select priority, subject, ticket_id from support_ticket where ticket_id = :ticket_id;',
      parameterNames: ['ticket_id'],
      boundary: { status: 'bounded', reason: 'root_key_parameter_equality', hopCount: 0 },
    });
    expect(plan.suggestedCaptureOrder).toEqual(['fixture-step:001']);
    expect(plan.suggestedLoadOrder).toEqual(['fixture-step:001']);
  });

  it('propagates a root key across a LEFT JOIN with FK proof', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select a.account_id, a.display_label, n.note_id, n.note_body from account as a left join account_note as n on n.account_id = a.account_id where a.account_id = :account_id order by n.note_id;',
      'create table account (account_id integer primary key, display_label text not null); create table account_note (note_id integer primary key, account_id integer not null references account(account_id), note_body text null);',
      'account',
      'account_id',
    ));

    expectReadySql(plan);
    expect(plan.steps.map((step) => ({ relation: step.relationName, sql: step.sql }))).toEqual([
      { relation: 'account', sql: 'select account_id, display_label from account where account_id = :account_id;' },
      { relation: 'account_note', sql: 'select account_id, note_body, note_id from account_note where account_id = :account_id;' },
    ]);
    expect(plan.steps[1]).toMatchObject({
      dependsOnStepIds: ['fixture-step:001'],
      loadAfterStepIds: ['fixture-step:001'],
      predicateDerivation: 'join_key_propagation',
      boundary: { status: 'bounded', reason: 'direct_key_equality_propagation', hopCount: 1 },
    });
  });

  it('uses a bounded nested key subquery for the second hop', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id, o.order_id, i.item_id, i.sku, i.quantity from customer as c join purchase_order as o on o.customer_id = c.customer_id join order_item as i on i.order_id = o.order_id and i.sku = :sku where c.customer_id = :customer_id order by o.order_id, i.item_id;',
      'create table customer (customer_id integer primary key, display_label text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id), sku text not null, quantity integer not null);',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    expect(plan.steps.map((step) => step.relationName)).toEqual(['customer', 'purchase_order', 'order_item']);
    expect(plan.steps[2]).toMatchObject({
      dependsOnStepIds: ['fixture-step:002'],
      loadAfterStepIds: ['fixture-step:002'],
      predicateDerivation: 'foreign_key_dependency',
      parameterNames: ['customer_id', 'sku'],
      boundary: { status: 'bounded', reason: 'nested_foreign_key_subquery', hopCount: 2, relationColumns: ['order_id', 'sku'] },
    });
    expect(plan.steps[2].sql).toBe('select item_id, order_id, quantity, sku\nfrom order_item\nwhere order_id in (\n  select order_id\n  from purchase_order\n  where customer_id = :customer_id\n) and sku = :sku;');
  });

  it('returns a condition-bounded root SELECT when a parameterized search column is not unique', () => {
    const plan = generateFixtureExtractionPlan({
      sql: 'select sum(amount) as total_amount from public.orders where customer_id = :customer_id;',
      ddl: [{ sql: 'create table public.orders (order_id bigint primary key, customer_id bigint not null, amount numeric not null);' }],
    });

    expectReadySql(plan);
    expect(plan.reproductionKey).toMatchObject({
      boundaryKind: 'parameter_predicate',
      parameterNames: ['customer_id'],
      rootColumns: ['customer_id'],
      rootRelation: 'public.orders',
    });
    expect(plan.steps).toMatchObject([{
      sql: 'select amount, customer_id, order_id from public.orders where customer_id = :customer_id;',
      boundary: { reason: 'root_parameter_predicate' },
    }]);
    expect(plan.limitations.map((item) => item.code)).toContain('ROOT_PREDICATE_MAY_CAPTURE_MULTIPLE_ROWS');
  });

  it('returns a partial plan instead of stopping when parameterized search conditions start from multiple relations', () => {
    const plan = generateFixtureExtractionPlan({
      sql: 'select o.order_id, c.customer_id from orders o cross join customers c where o.customer_id = :customer_id and c.region_id = :region_id;',
      ddl: [{ sql: 'create table orders (order_id bigint primary key, customer_id bigint not null); create table customers (customer_id bigint primary key, region_id bigint not null);' }],
    });

    expect(plan.status).toBe('partial');
    expect(plan.steps[0]?.sql).toBe('select customer_id, order_id from orders where customer_id = :customer_id;');
    expect(plan.blockedReasons.map((item) => item.code)).toContain('REPRODUCTION_KEY_AMBIGUOUS');
    expect(plan.limitations.map((item) => item.code)).toContain('PARTIAL_PLAN_INCOMPLETE');
  });

  it('expands every proven physical-FK edge without a hop control input', () => {
    const sql = 'select r.root_id, a.a_id, b.b_id, c.c_id from root_record r join level_a a on a.root_id = r.root_id join level_b b on b.a_id = a.a_id join level_c c on c.b_id = b.b_id where r.root_id = :root_id;';
    const ddl = 'create table root_record (root_id integer primary key); create table level_a (a_id integer primary key, root_id integer not null references root_record(root_id)); create table level_b (b_id integer primary key, a_id integer not null references level_a(a_id)); create table level_c (c_id integer primary key, b_id integer not null references level_b(b_id));';
    const plan = generateFixtureExtractionPlan(input(sql, ddl, 'root_record', 'root_id'));

    expectReadySql(plan);
    expect(plan.steps.map((step) => step.relationName)).toEqual(['root_record', 'level_a', 'level_b', 'level_c']);
    expect(plan.steps.at(-1)?.boundary).toMatchObject({ hopCount: 3 });
  });

  it('expands a five-hop physical-FK chain without a product hop cap', () => {
    const sql = 'select r.root_id, a.a_id, b.b_id, c.c_id, d.d_id, e.e_id from root_record r join level_a a on a.root_id = r.root_id join level_b b on b.a_id = a.a_id join level_c c on c.b_id = b.b_id join level_d d on d.c_id = c.c_id join level_e e on e.d_id = d.d_id where r.root_id = :root_id;';
    const ddl = 'create table root_record (root_id integer primary key); create table level_a (a_id integer primary key, root_id integer not null references root_record(root_id)); create table level_b (b_id integer primary key, a_id integer not null references level_a(a_id)); create table level_c (c_id integer primary key, b_id integer not null references level_b(b_id)); create table level_d (d_id integer primary key, c_id integer not null references level_c(c_id)); create table level_e (e_id integer primary key, d_id integer not null references level_d(d_id));';
    const plan = generateFixtureExtractionPlan(input(sql, ddl, 'root_record', 'root_id'));

    expectReadySql(plan);
    expect(plan.steps.map((step) => step.relationName)).toEqual(['root_record', 'level_a', 'level_b', 'level_c', 'level_d', 'level_e']);
    expect(plan.steps.at(-1)?.boundary).toMatchObject({ status: 'bounded', hopCount: 5 });
  });

  it('uses explicitly reviewed logical foreign keys, never SQL join inference, for a deep chain', () => {
    const sql = 'select r.root_id, a.a_id, b.b_id, c.c_id from root_record r join level_a a on a.root_id = r.root_id join level_b b on b.a_id = a.a_id join level_c c on c.b_id = b.b_id where r.root_id = :root_id;';
    const facts = parseSchemaFactsFromDdl([{ sql: 'create table root_record (root_id integer primary key); create table level_a (a_id integer primary key, root_id integer not null); create table level_b (b_id integer primary key, a_id integer not null); create table level_c (c_id integer primary key, b_id integer not null);' }]);
    const withoutDeclarations = generateFixtureExtractionPlan({
      sql,
      schemaFacts: facts,
      reproductionKey: { parameterNames: ['root_id'], rootColumns: ['root_id'], rootRelation: 'root_record' },
    });
    expect(withoutDeclarations.status).toBe('partial');
    expect(withoutDeclarations.steps.find((step) => step.relationName === 'level_a')?.sql).toBeNull();

    facts.tables.level_a.declaredLogicalForeignKeys = [{ columns: ['root_id'], refColumns: ['root_id'], refTable: 'root_record', reviewed: true }];
    facts.tables.level_b.declaredLogicalForeignKeys = [{ columns: ['a_id'], refColumns: ['a_id'], refTable: 'level_a', reviewed: true }];
    facts.tables.level_c.declaredLogicalForeignKeys = [{ columns: ['b_id'], refColumns: ['b_id'], refTable: 'level_b', reviewed: true }];
    const plan = generateFixtureExtractionPlan({
      sql,
      schemaFacts: facts,
      reproductionKey: { parameterNames: ['root_id'], rootColumns: ['root_id'], rootRelation: 'root_record' },
    });

    expectReadySql(plan);
    expect(plan.steps.at(-1)?.boundary).toMatchObject({ hopCount: 3 });
    expect(plan.sourceEvidence.some((item) => item.kind === 'schema_declared_logical_foreign_key')).toBe(true);
  });

  it('rejects a repeated relation path without emitting guessed SQL', () => {
    const cycle = generateFixtureExtractionPlan(input(
      'select e.employee_id, manager.employee_id from employee e join employee manager on e.manager_id = manager.employee_id where e.employee_id = :employee_id;',
      'create table employee (employee_id integer primary key, manager_id integer references employee(employee_id));',
      'employee',
      'employee_id',
    ));
    expect(cycle.status).toBe('partial');
    expect(cycle.steps.find((step) => step.relationOccurrenceId !== cycle.reproductionKey.rootRelationOccurrenceId)).toMatchObject({
      sql: null,
      blockedReasonCodes: ['RELATIONSHIP_CYCLE_UNSUPPORTED'],
    });
    const joins = Array.from({ length: 256 }, (_, index) => `join t${index + 1} on t${index}.id = t${index + 1}.id`).join(' ');
    const resourceLimited = generateFixtureExtractionPlan({
      sql: `select t0.id from t0 ${joins} where t0.id = :root_id;`,
      reproductionKey: { parameterNames: ['root_id'], rootColumns: ['id'], rootRelation: 't0' },
    });
    expect(resourceLimited.status).toBe('blocked');
    expect(resourceLimited.blockedReasons.map((reason) => reason.code)).toEqual(['ANALYSIS_RESOURCE_LIMIT']);
  });

  it('preserves every intermediate-key constraint in a two-hop NOT EXISTS boundary', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id, o.order_id from customer c join purchase_order o on o.customer_id = c.customer_id and o.order_id = :order_a and o.order_id = :order_b where c.customer_id = :customer_id and not exists (select 1 from order_item i where i.order_id = o.order_id);',
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id)); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    expect(plan.steps.map((step) => step.relationName)).toEqual(['customer', 'purchase_order', 'order_item']);
    expect(plan.steps[2]).toMatchObject({
      dependsOnStepIds: ['fixture-step:002'],
      loadAfterStepIds: ['fixture-step:002'],
      parameterNames: ['customer_id', 'order_a', 'order_b'],
      resultExpectation: { kind: 'empty_result_required' },
      boundary: { status: 'bounded', reason: 'nested_foreign_key_subquery', hopCount: 2, relationColumns: ['order_id'] },
    });
    expect(plan.steps[2].sql).toBe('select item_id, order_id\nfrom order_item\nwhere order_id in (\n  select order_id\n  from purchase_order\n  where customer_id = :customer_id and order_id = :order_a and order_id = :order_b\n);');
    expect(new Set(plan.steps.flatMap((step) => step.dependsOnStepIds)).has('fixture-step:002')).toBe(true);
  });

  it('preserves every intermediate-key constraint across a two-hop JOIN boundary', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id, o.order_id, i.item_id from customer c join purchase_order o on o.customer_id = c.customer_id and o.order_id = :order_a and o.order_id = :order_b join order_item i on i.order_id = o.order_id where c.customer_id = :customer_id;',
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id)); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    expect(plan.steps[2]).toMatchObject({
      dependsOnStepIds: ['fixture-step:002'],
      loadAfterStepIds: ['fixture-step:002'],
      parameterNames: ['customer_id', 'order_a', 'order_b'],
      resultExpectation: { kind: 'rows_may_be_present' },
      boundary: { status: 'bounded', reason: 'nested_foreign_key_subquery', hopCount: 2 },
    });
    expect(plan.steps[2].sql).toContain('where customer_id = :customer_id and order_id = :order_a and order_id = :order_b');
  });

  it('fails closed instead of dropping mixed parameter and literal intermediate-key constraints', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id, o.order_id from customer c join purchase_order o on o.customer_id = c.customer_id and o.order_id = :order_id and o.order_id = 42 where c.customer_id = :customer_id and not exists (select 1 from order_item i where i.order_id = o.order_id);',
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id)); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expect(plan.status).toBe('partial');
    expect(plan.steps.filter((step) => step.relationName !== 'customer')).toHaveLength(2);
    expect(plan.steps.filter((step) => step.relationName !== 'customer').every((step) => (
      step.sql === null && step.resultExpectation.kind === 'rows_may_be_present'
    ))).toBe(true);
    expect(plan.blockedReasons.map((reason) => reason.code))
      .toEqual(['PARAMETER_PROPAGATION_UNPROVEN', 'PARAMETER_PROPAGATION_UNPROVEN', 'CAPTURE_BOUNDARY_UNBOUNDED', 'CAPTURE_BOUNDARY_UNBOUNDED']);
  });

  it('keeps direct two-hop propagation for semantically identical intermediate constraints', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id, o.order_id from customer c join purchase_order o on o.customer_id = c.customer_id and o.order_id = :order_id and o.order_id = :order_id where c.customer_id = :customer_id and not exists (select 1 from order_item i where i.order_id = o.order_id);',
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id)); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    expect(plan.steps[2]).toMatchObject({
      sql: 'select item_id, order_id from order_item where order_id = :order_id;',
      parameterNames: ['order_id'],
      resultExpectation: { kind: 'empty_result_required' },
      boundary: { status: 'bounded', reason: 'correlated_exists_key_equality', hopCount: 2 },
    });
  });

  it('preserves an outer-WHERE parameter through a two-hop NOT EXISTS boundary', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id, o.order_id from customer c join purchase_order o on o.customer_id = c.customer_id where c.customer_id = :customer_id and o.order_state = :order_state and not exists (select 1 from order_item i where i.order_id = o.order_id);',
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    expect(plan.steps[1].sql).toBe('select customer_id, order_id, order_state from purchase_order where customer_id = :customer_id and order_state = :order_state;');
    expect(plan.steps[2]).toMatchObject({
      dependsOnStepIds: ['fixture-step:002'],
      loadAfterStepIds: ['fixture-step:002'],
      parameterNames: ['customer_id', 'order_state'],
      resultExpectation: { kind: 'empty_result_required' },
      boundary: { status: 'bounded', reason: 'nested_foreign_key_subquery', hopCount: 2 },
    });
    expect(plan.steps[2].sql).toContain('where customer_id = :customer_id and order_state = :order_state');

    const reordered = generateFixtureExtractionPlan(input(
      'select c.customer_id, o.order_id from customer c join purchase_order o on o.customer_id = c.customer_id where c.customer_id = :customer_id and not exists (select 1 from order_item i where i.order_id = o.order_id) and o.order_state = :order_state;',
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));
    expect(reordered.status).toBe('blocked');
    expect(reordered.steps).toEqual([]);
    expect(reordered.blockedReasons.map((reason) => reason.code)).toEqual(['PARAMETER_PROPAGATION_UNPROVEN']);
  });

  it('preserves an outer-WHERE literal through a two-hop NOT EXISTS boundary', () => {
    const plan = generateFixtureExtractionPlan(input(
      "select c.customer_id, o.order_id from customer c join purchase_order o on o.customer_id = c.customer_id where c.customer_id = :customer_id and o.order_state = 'open' and not exists (select 1 from order_item i where i.order_id = o.order_id);",
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    expect(plan.steps[1].sql).toContain("order_state = 'open'");
    expect(plan.steps[2]).toMatchObject({
      parameterNames: ['customer_id'],
      resultExpectation: { kind: 'empty_result_required' },
      boundary: { status: 'bounded', reason: 'nested_foreign_key_subquery', hopCount: 2 },
    });
    expect(plan.steps[2].sql).toContain("where customer_id = :customer_id and order_state = 'open'");
  });

  it('fails closed for an outer-WHERE non-equality on an intermediate occurrence', () => {
    const plan = generateFixtureExtractionPlan(input(
      "select c.customer_id, o.order_id from customer c join purchase_order o on o.customer_id = c.customer_id where c.customer_id = :customer_id and o.order_state <> 'closed' and not exists (select 1 from order_item i where i.order_id = o.order_id);",
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expect(plan.status).toBe('partial');
    const relatedSteps = plan.steps.filter((step) => step.relationName !== 'customer');
    expect(relatedSteps).toHaveLength(2);
    expect(relatedSteps.every((step) => (
      step.sql === null && step.resultExpectation.kind === 'rows_may_be_present'
    ))).toBe(true);
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('preserves a root-WHERE parameter through a dependent NOT EXISTS boundary', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id from customer c where c.customer_id = :customer_id and c.customer_state = :customer_state and not exists (select 1 from purchase_order o where o.customer_id = c.customer_id);',
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    expect(plan.steps[0]).toMatchObject({
      sql: 'select customer_id, customer_state from customer where customer_id = :customer_id and customer_state = :customer_state;',
      parameterNames: ['customer_id', 'customer_state'],
    });
    expect(plan.steps[1]).toMatchObject({
      parameterNames: ['customer_id', 'customer_state'],
      resultExpectation: { kind: 'empty_result_required' },
      boundary: { status: 'bounded', reason: 'nested_foreign_key_subquery', hopCount: 1 },
    });
    expect(plan.steps[1].sql).toContain('select customer_id\n  from customer');
    expect(plan.steps[1].sql).toContain('where customer_id = :customer_id and customer_state = :customer_state');
  });

  it('preserves a root-WHERE literal through a dependent NOT EXISTS boundary', () => {
    const plan = generateFixtureExtractionPlan(input(
      "select c.customer_id from customer c where c.customer_id = :customer_id and c.customer_state = 'active' and not exists (select 1 from purchase_order o where o.customer_id = c.customer_id);",
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    expect(plan.steps[0].sql).toContain("customer_state = 'active'");
    expect(plan.steps[1].sql).toContain("customer_state = 'active'");
    expect(plan.steps[1]).toMatchObject({
      parameterNames: ['customer_id'],
      resultExpectation: { kind: 'empty_result_required' },
    });
  });

  it('fails closed for a root-WHERE non-equality on a dependent NOT EXISTS boundary', () => {
    const plan = generateFixtureExtractionPlan(input(
      "select c.customer_id from customer c where c.customer_id = :customer_id and c.customer_state <> 'closed' and not exists (select 1 from purchase_order o where o.customer_id = c.customer_id);",
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    expect(plan.status).toBe('partial');
    expect(plan.steps[0].sql).toBe('select customer_id, customer_state from customer where customer_id = :customer_id;');
    expect(plan.steps[1]).toMatchObject({
      sql: null,
      resultExpectation: { kind: 'rows_may_be_present' },
      boundary: { status: 'unknown' },
    });
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('preserves an anchor-side JOIN parameter through both propagation hops', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id, o.order_id from customer c join purchase_order o on o.customer_id = c.customer_id and c.customer_state = :customer_state where c.customer_id = :customer_id and not exists (select 1 from order_item i where i.order_id = o.order_id);',
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id)); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    expect(plan.steps[0].sql).toContain('customer_state = :customer_state');
    expect(plan.steps[1].sql).toContain('customer_state = :customer_state');
    expect(plan.steps[2]).toMatchObject({
      dependsOnStepIds: ['fixture-step:002'],
      loadAfterStepIds: ['fixture-step:002'],
      parameterNames: ['customer_id', 'customer_state'],
      resultExpectation: { kind: 'empty_result_required' },
      boundary: { status: 'bounded', reason: 'nested_foreign_key_subquery', hopCount: 2 },
    });
    expect(plan.steps[2].sql).toContain('customer_state = :customer_state');
  });

  it('preserves an anchor-side JOIN literal through a dependent NOT EXISTS boundary', () => {
    const plan = generateFixtureExtractionPlan(input(
      "select c.customer_id, o.order_id from customer c join purchase_order o on o.customer_id = c.customer_id and c.customer_state = 'active' where c.customer_id = :customer_id and not exists (select 1 from order_item i where i.order_id = o.order_id);",
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id)); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    expect(plan.steps[0].sql).toContain("customer_state = 'active'");
    expect(plan.steps[1].sql).toContain("customer_state = 'active'");
    expect(plan.steps[2].sql).toContain("customer_state = 'active'");
    expect(plan.steps[2].resultExpectation.kind).toBe('empty_result_required');
  });

  it('fails anchor-side JOIN non-equality propagation closed', () => {
    const plan = generateFixtureExtractionPlan(input(
      "select c.customer_id, o.order_id from customer c join purchase_order o on o.customer_id = c.customer_id and c.customer_state <> 'closed' where c.customer_id = :customer_id and not exists (select 1 from order_item i where i.order_id = o.order_id);",
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id)); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expect(plan.status).toBe('partial');
    expect(plan.steps[1].sql).toBeNull();
    expect(plan.steps[2].sql).toBeNull();
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('fails an anchor-side outer-JOIN constraint closed instead of filtering the anchor row', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id, o.order_id from customer c left join purchase_order o on o.customer_id = c.customer_id and c.customer_state = :customer_state where c.customer_id = :customer_id and not exists (select 1 from order_item i where i.order_id = o.order_id);',
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id)); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expect(plan.status).toBe('partial');
    expect(plan.steps[0].sql).toBe('select customer_id, customer_state from customer where customer_id = :customer_id;');
    expect(plan.steps[1].sql).toBeNull();
    expect(plan.steps[2].sql).toBeNull();
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('fails a root-correlated NOT EXISTS closed for a plain sibling INNER JOIN prerequisite', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id from customer c join purchase_order o on o.customer_id = c.customer_id where c.customer_id = :customer_id and not exists (select 1 from customer_alert a where a.customer_id = c.customer_id);',
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table customer_alert (alert_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    const orderStep = plan.steps.find((step) => step.relationName === 'purchase_order');
    const alertStep = plan.steps.find((step) => step.relationName === 'customer_alert');
    expect(plan.status).toBe('partial');
    expect(orderStep?.sql).toBe('select customer_id, order_id, order_state from purchase_order where customer_id = :customer_id;');
    expect(alertStep).toMatchObject({
      sql: null,
      resultExpectation: { kind: 'rows_may_be_present' },
      boundary: { status: 'unknown' },
    });
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('fails a root-correlated NOT EXISTS closed for a parameterized sibling INNER JOIN prerequisite', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id from customer c join purchase_order o on o.customer_id = c.customer_id and o.order_state = :order_state where c.customer_id = :customer_id and not exists (select 1 from customer_alert a where a.customer_id = c.customer_id);',
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table customer_alert (alert_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    const orderStep = plan.steps.find((step) => step.relationName === 'purchase_order');
    const alertStep = plan.steps.find((step) => step.relationName === 'customer_alert');
    expect(plan.status).toBe('partial');
    expect(orderStep?.sql).toContain('order_state = :order_state');
    expect(orderStep?.parameterNames).toEqual(['customer_id', 'order_state']);
    expect(alertStep?.sql).toBeNull();
    expect(alertStep?.resultExpectation.kind).toBe('rows_may_be_present');
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('does not retain a false absence claim for a literal sibling INNER JOIN prerequisite', () => {
    const plan = generateFixtureExtractionPlan(input(
      "select c.customer_id from customer c join purchase_order o on o.customer_id = c.customer_id and o.order_state = 'open' where c.customer_id = :customer_id and not exists (select 1 from customer_alert a where a.customer_id = c.customer_id);",
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table customer_alert (alert_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    const alertStep = plan.steps.find((step) => step.relationName === 'customer_alert');
    expect(plan.status).toBe('partial');
    expect(alertStep?.sql).toBeNull();
    expect(alertStep?.resultExpectation.kind).toBe('rows_may_be_present');
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('does not retain a false absence claim for a non-equality sibling INNER JOIN prerequisite', () => {
    const plan = generateFixtureExtractionPlan(input(
      "select c.customer_id from customer c join purchase_order o on o.customer_id = c.customer_id and o.order_state <> 'closed' where c.customer_id = :customer_id and not exists (select 1 from customer_alert a where a.customer_id = c.customer_id);",
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table customer_alert (alert_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    const alertStep = plan.steps.find((step) => step.relationName === 'customer_alert');
    expect(plan.status).toBe('partial');
    expect(alertStep?.sql).toBeNull();
    expect(alertStep?.resultExpectation.kind).toBe('rows_may_be_present');
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('keeps a root-correlated NOT EXISTS independent of a sibling LEFT JOIN', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id from customer c left join purchase_order o on o.customer_id = c.customer_id and o.order_state = :order_state where c.customer_id = :customer_id and not exists (select 1 from customer_alert a where a.customer_id = c.customer_id);',
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table customer_alert (alert_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    const orderStep = plan.steps.find((step) => step.relationName === 'purchase_order');
    const alertStep = plan.steps.find((step) => step.relationName === 'customer_alert');
    expect(orderStep?.sql).toContain('order_state = :order_state');
    expect(alertStep).toMatchObject({
      sql: 'select alert_id, customer_id from customer_alert where customer_id = :customer_id;',
      resultExpectation: { kind: 'empty_result_required' },
      boundary: { status: 'bounded', reason: 'correlated_exists_key_equality', hopCount: 1 },
    });
  });

  it('fails a root-correlated NOT EXISTS closed when an outer-WHERE parameter null-rejects a LEFT relation', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id from customer c left join purchase_order o on o.customer_id = c.customer_id where c.customer_id = :customer_id and o.order_state = :order_state and not exists (select 1 from customer_alert a where a.customer_id = c.customer_id);',
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table customer_alert (alert_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    const orderStep = plan.steps.find((step) => step.relationName === 'purchase_order');
    const alertStep = plan.steps.find((step) => step.relationName === 'customer_alert');
    expect(plan.status).toBe('partial');
    expect(orderStep?.sql).toContain('order_state = :order_state');
    expect(alertStep).toMatchObject({
      sql: null,
      resultExpectation: { kind: 'rows_may_be_present' },
      boundary: { status: 'unknown' },
    });
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('fails a root-correlated NOT EXISTS closed when an outer-WHERE literal null-rejects a LEFT relation', () => {
    const plan = generateFixtureExtractionPlan(input(
      "select c.customer_id from customer c left join purchase_order o on o.customer_id = c.customer_id where c.customer_id = :customer_id and o.order_state = 'open' and not exists (select 1 from customer_alert a where a.customer_id = c.customer_id);",
      'create table customer (customer_id integer primary key, customer_state text not null); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table customer_alert (alert_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    const orderStep = plan.steps.find((step) => step.relationName === 'purchase_order');
    const alertStep = plan.steps.find((step) => step.relationName === 'customer_alert');
    expect(plan.status).toBe('partial');
    expect(orderStep?.sql).toContain("order_state = 'open'");
    expect(alertStep?.sql).toBeNull();
    expect(alertStep?.resultExpectation.kind).toBe('rows_may_be_present');
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('fails a root-correlated NOT EXISTS closed through a LEFT-then-INNER population chain', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id from customer c left join purchase_order o on o.customer_id = c.customer_id join order_item i on i.order_id = o.order_id where c.customer_id = :customer_id and not exists (select 1 from customer_alert a where a.customer_id = c.customer_id);',
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id)); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id)); create table customer_alert (alert_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    const alertStep = plan.steps.find((step) => step.relationName === 'customer_alert');
    expect(plan.status).toBe('partial');
    expect(alertStep).toMatchObject({
      sql: null,
      resultExpectation: { kind: 'rows_may_be_present' },
      boundary: { status: 'unknown' },
    });
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('classifies null-rejected LEFT population closure independently of WHERE term ordering', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id from customer c left join purchase_order o on o.customer_id = c.customer_id where o.order_state = :order_state and c.customer_id = :customer_id and not exists (select 1 from customer_alert a where a.customer_id = c.customer_id);',
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table customer_alert (alert_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    const alertStep = plan.steps.find((step) => step.relationName === 'customer_alert');
    expect(plan.status).toBe('partial');
    expect(alertStep?.sql).toBeNull();
    expect(alertStep?.resultExpectation.kind).toBe('rows_may_be_present');
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('finds a transitive INNER population prerequisite across a longer LEFT chain', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id from customer c left join purchase_order o on o.customer_id = c.customer_id left join order_item i on i.order_id = o.order_id join catalog_item p on p.item_id = i.item_id where c.customer_id = :customer_id and not exists (select 1 from customer_alert a where a.customer_id = c.customer_id);',
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id)); create table catalog_item (item_id integer primary key); create table order_item (order_item_id integer primary key, order_id integer not null references purchase_order(order_id), item_id integer not null references catalog_item(item_id)); create table customer_alert (alert_id integer primary key, customer_id integer not null references customer(customer_id));',
      'customer',
      'customer_id',
    ));

    const alertStep = plan.steps.find((step) => step.relationName === 'customer_alert');
    expect(plan.status).toBe('partial');
    expect(alertStep?.sql).toBeNull();
    expect(alertStep?.resultExpectation.kind).toBe('rows_may_be_present');
    expect(plan.steps.some((step) => step.resultExpectation.kind === 'empty_result_required')).toBe(false);
  });

  it('deduplicates identical JOIN-ON and outer-WHERE parameter constraints', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id, o.order_id from customer c join purchase_order o on o.customer_id = c.customer_id and o.order_state = :order_state where c.customer_id = :customer_id and o.order_state = :order_state and not exists (select 1 from order_item i where i.order_id = o.order_id);',
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id), order_state text not null); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    expect(plan.steps[1].sql).toBe('select customer_id, order_id, order_state from purchase_order where customer_id = :customer_id and order_state = :order_state;');
    expect(plan.steps[2].parameterNames).toEqual(['customer_id', 'order_state']);
  });

  it('preserves multiple outer-WHERE intermediate constraints across a two-hop JOIN boundary', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select c.customer_id, o.order_id, i.item_id from customer c join purchase_order o on o.customer_id = c.customer_id join order_item i on i.order_id = o.order_id where c.customer_id = :customer_id and o.order_id = :order_a and o.order_id = :order_b;',
      'create table customer (customer_id integer primary key); create table purchase_order (order_id integer primary key, customer_id integer not null references customer(customer_id)); create table order_item (item_id integer primary key, order_id integer not null references purchase_order(order_id));',
      'customer',
      'customer_id',
    ));

    expectReadySql(plan);
    expect(plan.steps[2]).toMatchObject({
      dependsOnStepIds: ['fixture-step:002'],
      loadAfterStepIds: ['fixture-step:002'],
      parameterNames: ['customer_id', 'order_a', 'order_b'],
      resultExpectation: { kind: 'rows_may_be_present' },
      boundary: { status: 'bounded', reason: 'nested_foreign_key_subquery', hopCount: 2 },
    });
    expect(plan.steps[2].sql).toContain('where customer_id = :customer_id and order_id = :order_a and order_id = :order_b');
  });

  it.each([
    ['exists', 'rows_may_be_present', false],
    ['not exists', 'empty_result_required', true],
  ] as const)('retains a bounded related step for %s', (operator, expectation, empty) => {
    const plan = generateFixtureExtractionPlan(input(
      `select m.member_id, m.display_label from member as m where m.member_id = :member_id and ${operator} (select 1 from subscription as s where s.member_id = m.member_id);`,
      'create table member (member_id integer primary key, display_label text not null); create table subscription (subscription_id integer primary key, member_id integer not null references member(member_id), subscription_state text not null);',
      'member',
      'member_id',
    ));

    expectReadySql(plan);
    expect(plan.steps[1]).toMatchObject({
      relationName: 'subscription',
      predicateDerivation: 'exists_dependency',
      sql: 'select member_id, subscription_id, subscription_state from subscription where member_id = :member_id;',
      resultExpectation: { kind: expectation },
      boundary: { status: 'bounded', reason: 'correlated_exists_key_equality', hopCount: 1 },
    });
    expect(plan.steps[1].resultExpectation.note).toBe(empty ? 'The required reproduction state may be an empty result for this relation.' : null);
  });

  it('preserves safe EXISTS parameter filters and fails closed on unrepresented filters', () => {
    const filtered = generateFixtureExtractionPlan(input(
      'select m.member_id from member m where m.member_id = :member_id and not exists (select 1 from subscription s where s.member_id = m.member_id and s.subscription_state = :subscription_state);',
      'create table member (member_id integer primary key); create table subscription (subscription_id integer primary key, member_id integer not null references member(member_id), subscription_state text not null);',
      'member',
      'member_id',
    ));
    expectReadySql(filtered);
    expect(filtered.steps[1]).toMatchObject({
      sql: 'select member_id, subscription_id, subscription_state from subscription where member_id = :member_id and subscription_state = :subscription_state;',
      parameterNames: ['member_id', 'subscription_state'],
      resultExpectation: { kind: 'empty_result_required' },
    });

    const literalFiltered = generateFixtureExtractionPlan(input(
      "select m.member_id from member m where m.member_id = :member_id and not exists (select 1 from subscription s where s.member_id = m.member_id and s.subscription_state = 'active');",
      'create table member (member_id integer primary key); create table subscription (subscription_id integer primary key, member_id integer not null references member(member_id), subscription_state text not null);',
      'member',
      'member_id',
    ));
    expectReadySql(literalFiltered);
    expect(literalFiltered.steps[1]).toMatchObject({
      sql: "select member_id, subscription_id, subscription_state from subscription where member_id = :member_id and subscription_state = 'active';",
      parameterNames: ['member_id'],
      resultExpectation: { kind: 'empty_result_required' },
    });

    const nonEqualityFiltered = generateFixtureExtractionPlan(input(
      "select m.member_id from member m where m.member_id = :member_id and not exists (select 1 from subscription s where s.member_id = m.member_id and s.subscription_state <> 'inactive');",
      'create table member (member_id integer primary key); create table subscription (subscription_id integer primary key, member_id integer not null references member(member_id), subscription_state text not null);',
      'member',
      'member_id',
    ));
    expect(nonEqualityFiltered.status).toBe('partial');
    expect(nonEqualityFiltered.steps[1]).toMatchObject({ sql: null, resultExpectation: { kind: 'rows_may_be_present' } });
    expect(nonEqualityFiltered.blockedReasons.map((reason) => reason.code))
      .toEqual(['PARAMETER_PROPAGATION_UNPROVEN', 'CAPTURE_BOUNDARY_UNBOUNDED']);
  });

  it('fails closed for semantically distinct equalities on the correlated foreign-key column', () => {
    const differentParameter = generateFixtureExtractionPlan(input(
      'select m.member_id from member m where m.member_id = :member_id and not exists (select 1 from subscription s where s.member_id = m.member_id and s.member_id = :other_member_id);',
      'create table member (member_id integer primary key); create table subscription (subscription_id integer primary key, member_id integer not null references member(member_id));',
      'member',
      'member_id',
    ));
    expect(differentParameter.status).toBe('partial');
    expect(differentParameter.steps[1]).toMatchObject({
      sql: null,
      resultExpectation: { kind: 'rows_may_be_present' },
    });
    expect(differentParameter.blockedReasons.map((reason) => reason.code))
      .toEqual(['PARAMETER_PROPAGATION_UNPROVEN', 'CAPTURE_BOUNDARY_UNBOUNDED']);

    const numericLiteral = generateFixtureExtractionPlan(input(
      'select m.member_id from member m where m.member_id = :member_id and not exists (select 1 from subscription s where s.member_id = m.member_id and s.member_id = 999);',
      'create table member (member_id integer primary key); create table subscription (subscription_id integer primary key, member_id integer not null references member(member_id));',
      'member',
      'member_id',
    ));
    expect(numericLiteral.status).toBe('partial');
    expect(numericLiteral.steps[1]).toMatchObject({
      sql: null,
      resultExpectation: { kind: 'rows_may_be_present' },
    });
    expect(numericLiteral.blockedReasons.map((reason) => reason.code))
      .toEqual(['PARAMETER_PROPAGATION_UNPROVEN', 'CAPTURE_BOUNDARY_UNBOUNDED']);

    const identicalParameter = generateFixtureExtractionPlan(input(
      'select m.member_id from member m where m.member_id = :member_id and not exists (select 1 from subscription s where s.member_id = m.member_id and s.member_id = :member_id);',
      'create table member (member_id integer primary key); create table subscription (subscription_id integer primary key, member_id integer not null references member(member_id));',
      'member',
      'member_id',
    ));
    expectReadySql(identicalParameter);
    expect(identicalParameter.steps[1]).toMatchObject({
      sql: 'select member_id, subscription_id from subscription where member_id = :member_id;',
      parameterNames: ['member_id'],
      resultExpectation: { kind: 'empty_result_required' },
    });
  });

  it('preserves only parser-round-trip-stable literal equalities', () => {
    const quoted = generateFixtureExtractionPlan(input(
      "select m.member_id from member m where m.member_id = :member_id and not exists (select 1 from subscription s where s.member_id = m.member_id and s.marker = 'O''Reilly');",
      'create table member (member_id integer primary key); create table subscription (subscription_id integer primary key, member_id integer not null references member(member_id), marker text);',
      'member',
      'member_id',
    ));
    expectReadySql(quoted);
    expect(quoted.steps[1].sql).toBe("select marker, member_id, subscription_id from subscription where member_id = :member_id and marker = 'O''Reilly';");

    const unicode = generateFixtureExtractionPlan(input(
      "select m.member_id from member m where m.member_id = :member_id and exists (select 1 from subscription s where s.member_id = m.member_id and s.marker = '東京');",
      'create table member (member_id integer primary key); create table subscription (subscription_id integer primary key, member_id integer not null references member(member_id), marker text);',
      'member',
      'member_id',
    ));
    expectReadySql(unicode);
    expect(unicode.steps[1].sql).toContain("marker = '東京'");

    const numeric = generateFixtureExtractionPlan(input(
      'select m.member_id from member m where m.member_id = :member_id and exists (select 1 from subscription s where s.member_id = m.member_id and s.marker_code = 42);',
      'create table member (member_id integer primary key); create table subscription (subscription_id integer primary key, member_id integer not null references member(member_id), marker_code integer);',
      'member',
      'member_id',
    ));
    expectReadySql(numeric);
    expect(numeric.steps[1].sql).toContain('marker_code = 42');

    const backslash = generateFixtureExtractionPlan(input(
      String.raw`select m.member_id from member m where m.member_id = :member_id and exists (select 1 from subscription s where s.member_id = m.member_id and s.marker = 'C:\temp');`,
      'create table member (member_id integer primary key); create table subscription (subscription_id integer primary key, member_id integer not null references member(member_id), marker text);',
      'member',
      'member_id',
    ));
    expect(backslash.status).toBe('partial');
    expect(backslash.steps[1]).toMatchObject({ sql: null, resultExpectation: { kind: 'rows_may_be_present' } });
    expect(backslash.blockedReasons.map((reason) => reason.code))
      .toEqual(['PARAMETER_PROPAGATION_UNPROVEN', 'CAPTURE_BOUNDARY_UNBOUNDED']);
  });

  it('preserves a related local parameter predicate for the aggregate stretch scenario', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select a.account_id, a.display_label, coalesce(sum(p.amount), 0)::integer as paid_amount, count(p.payment_id)::integer as payment_count from billing_account as a left join synthetic_payment as p on p.account_id = a.account_id and p.payment_state = :payment_state where a.account_id = :account_id group by a.account_id, a.display_label;',
      'create table billing_account (account_id integer primary key, display_label text not null); create table synthetic_payment (payment_id integer primary key, account_id integer not null references billing_account(account_id), payment_state text not null, amount integer not null);',
      'billing_account',
      'account_id',
    ));

    expectReadySql(plan);
    expect(plan.steps[1]).toMatchObject({
      relationName: 'synthetic_payment',
      sql: 'select account_id, amount, payment_id, payment_state from synthetic_payment where account_id = :account_id and payment_state = :payment_state;',
      parameterNames: ['account_id', 'payment_state'],
      boundary: { relationColumns: ['account_id', 'payment_state'], parameterNames: ['account_id', 'payment_state'] },
    });
  });

  it('flattens a referenced SELECT-only CTE and excludes an unused sibling CTE', () => {
    const plan = generateFixtureExtractionPlan(input(
      'with chosen as (select t.ticket_id, t.subject from support_ticket t where t.ticket_id = :ticket_id), unused as (select a.audit_id from audit_log a) select ticket_id, subject from chosen;',
      'create table support_ticket (ticket_id integer primary key, subject text not null); create table audit_log (audit_id integer primary key);',
      'support_ticket',
      'ticket_id',
    ));

    expectReadySql(plan);
    expect(plan.steps.map((step) => step.relationName)).toEqual(['support_ticket']);
    expect(plan.steps[0].sql).toBe('select subject, ticket_id from support_ticket where ticket_id = :ticket_id;');
  });

  it('blocks a DML CTE with RETURNING in catalog order and emits no SQL', () => {
    const plan = generateFixtureExtractionPlan(input(
      "with changed as (update synthetic_document set document_state = 'archived' where document_id = :document_id returning document_id, document_state) select document_id, document_state from changed;",
      'create table synthetic_document (document_id integer primary key, document_state text not null);',
      'synthetic_document',
      'document_id',
    ));

    expect(plan.status).toBe('blocked');
    expect(plan.steps).toEqual([]);
    expect(plan.blockedReasons.map((reason) => reason.code)).toEqual(['RETURNING_UNSUPPORTED', 'DML_CTE_UNSUPPORTED']);
  });

  it('returns the aligned fail-closed outcomes for required negative variants', () => {
    const missingKey = generateFixtureExtractionPlan({
      sql: 'select t.ticket_id from support_ticket t;',
      ddl: [{ sql: 'create table support_ticket (ticket_id integer primary key);' }],
    });
    expect([missingKey.status, missingKey.reproductionKey.status, missingKey.blockedReasons.map((item) => item.code)]).toEqual(['blocked', 'blocked', ['REPRODUCTION_KEY_REQUIRED']]);

    const nonEquality = generateFixtureExtractionPlan(input(
      'select p.parent_id, c.child_id from range_parent as p join range_child as c on c.parent_score > p.minimum_score where p.parent_id = :parent_id;',
      'create table range_parent (parent_id integer primary key, minimum_score integer not null); create table range_child (child_id integer primary key, parent_score integer not null);',
      'range_parent',
      'parent_id',
    ));
    expect(nonEquality.status).toBe('partial');
    expect(nonEquality.steps.map((step) => step.sql)).toEqual(['select minimum_score, parent_id from range_parent where parent_id = :parent_id;', null]);
    expect(nonEquality.blockedReasons.map((item) => item.code)).toEqual(['NON_EQUALITY_JOIN_UNSUPPORTED']);

    const ambiguousSchema = generateFixtureExtractionPlan(input(
      'select p.parent_id from parent as p where p.parent_id = :parent_id;',
      'create table public.parent (parent_id integer primary key); create table audit.parent (parent_id integer primary key);',
      'parent',
      'parent_id',
    ));
    expect([ambiguousSchema.status, ambiguousSchema.reproductionKey.status, ambiguousSchema.blockedReasons.map((item) => item.code)])
      .toEqual(['blocked', 'ambiguous', ['ROOT_RELATION_UNRESOLVED']]);

    const missingFk = generateFixtureExtractionPlan(input(
      'select p.parent_id, c.child_id from fk_parent as p join fk_child as c on c.parent_id = p.parent_id where p.parent_id = :parent_id;',
      'create table fk_parent (parent_id integer primary key); create table fk_child (child_id integer primary key, parent_id integer not null);',
      'fk_parent',
      'parent_id',
    ));
    expect(missingFk.status).toBe('partial');
    expect(missingFk.blockedReasons.map((item) => item.code)).toEqual(['SCHEMA_FACTS_REQUIRED']);

    const wildcard = generateFixtureExtractionPlan(input(
      'select u.* from unknown_projection as u where u.id = :id;',
      undefined,
      'unknown_projection',
      'id',
    ));
    expect([wildcard.status, wildcard.reproductionKey.status, wildcard.blockedReasons.map((item) => item.code)])
      .toEqual(['blocked', 'blocked', ['UNRESOLVED_WILDCARD']]);

    const recursive = generateFixtureExtractionPlan(input(
      'with recursive chain(node_id, parent_id) as (select n.node_id, n.parent_id from hierarchy_node as n where n.node_id = :node_id union all select n.node_id, n.parent_id from hierarchy_node as n join chain as c on n.parent_id = c.node_id) select node_id, parent_id from chain;',
      'create table hierarchy_node (node_id integer primary key, parent_id integer null references hierarchy_node(node_id));',
      'hierarchy_node',
      'node_id',
    ));
    expect([recursive.status, recursive.reproductionKey.status, recursive.blockedReasons.map((item) => item.code)])
      .toEqual(['blocked', 'blocked', ['RECURSIVE_CTE_UNSUPPORTED']]);

    const unbounded = generateFixtureExtractionPlan(input(
      'select e.event_id, e.event_kind from synthetic_event as e where e.event_kind = :event_kind;',
      'create table synthetic_event (event_id integer primary key, event_kind text not null);',
      'synthetic_event',
      'event_kind',
    ));
    expect([unbounded.status, unbounded.reproductionKey.status, unbounded.blockedReasons.map((item) => item.code)])
      .toEqual(['blocked', 'ambiguous', ['REPRODUCTION_KEY_AMBIGUOUS', 'CAPTURE_BOUNDARY_UNBOUNDED']]);
  });

  it('does not first-match an ambiguous related relation across schemas', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select p.parent_id, c.child_id from public.parent p join child c on c.parent_id = p.parent_id where p.parent_id = :parent_id;',
      'create table public.parent (parent_id integer primary key); create table public.child (child_id integer primary key, parent_id integer not null references public.parent(parent_id)); create table audit.child (child_id integer primary key, parent_id integer not null references audit.parent(parent_id)); create table audit.parent (parent_id integer primary key);',
      'public.parent',
      'parent_id',
    ));
    expect(plan.status).toBe('partial');
    expect(plan.steps[1].sql).toBeNull();
    expect(plan.blockedReasons.map((reason) => reason.code)).toEqual(['RELATION_UNRESOLVED']);
  });

  it('fails closed when used schema keys or foreign keys reference nonexistent columns', () => {
    const malformedRoot = generateFixtureExtractionPlan(input(
      'select t.ticket_id from support_ticket t where t.missing_id = :missing_id;',
      'create table support_ticket (ticket_id integer, primary key (missing_id));',
      'support_ticket',
      'missing_id',
    ));
    expect(malformedRoot.status).toBe('blocked');
    expect(malformedRoot.steps).toEqual([]);
    expect(malformedRoot.blockedReasons.map((reason) => reason.code)).toEqual(['SCHEMA_FACTS_REQUIRED']);

    const malformedSource = generateFixtureExtractionPlan(input(
      'select p.parent_id, c.child_id from parent p join child c on c.missing_parent_id = p.parent_id where p.parent_id = :parent_id;',
      'create table parent (parent_id integer primary key); create table child (child_id integer primary key, foreign key (missing_parent_id) references parent(parent_id));',
      'parent',
      'parent_id',
    ));
    expect(malformedSource.status).toBe('blocked');
    expect(malformedSource.steps).toEqual([]);
    expect(malformedSource.blockedReasons.map((reason) => reason.code)).toEqual(['SCHEMA_FACTS_REQUIRED']);

    const malformedReference = generateFixtureExtractionPlan(input(
      'select p.parent_id, c.child_id from parent p join child c on c.parent_id = p.parent_id where p.parent_id = :parent_id;',
      'create table parent (parent_id integer primary key); create table child (child_id integer primary key, parent_id integer, foreign key (parent_id) references parent(missing_parent_id));',
      'parent',
      'parent_id',
    ));
    expect(malformedReference.status).toBe('blocked');
    expect(malformedReference.steps).toEqual([]);
    expect(malformedReference.blockedReasons.map((reason) => reason.code)).toEqual(['SCHEMA_FACTS_REQUIRED']);
  });

  it('rejects related positional parameters before emitting a bounded step', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select p.id, c.id from parent p join child c on c.parent_id = p.id and c.state = $1 where p.id = :id;',
      'create table parent (id integer primary key); create table child (id integer primary key, parent_id integer references parent(id), state text);',
      'parent',
      'id',
    ));
    expect(plan.status).toBe('blocked');
    expect(plan.steps).toEqual([]);
    expect(plan.steps.flatMap((step) => step.parameterNames).every((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name))).toBe(true);
    expect(plan.steps.some((step) => step.sql?.includes(':1'))).toBe(false);
    expect(plan.blockedReasons.map((reason) => reason.code)).toEqual(['PARAMETER_PROPAGATION_UNPROVEN']);
  });

  it('blocks involved or unattributed schema diagnostics conservatively', () => {
    const involved = generateFixtureExtractionPlan({
      sql: 'select t.ticket_id from support_ticket t where t.ticket_id = :ticket_id;',
      ddl: [{
        filePath: 'support_ticket.sql',
        sql: 'create table support_ticket (ticket_id integer primary key); alter table support_ticket bogus action;',
      }],
      reproductionKey: { parameterNames: ['ticket_id'], rootRelation: 'support_ticket', rootColumns: ['ticket_id'] },
    });
    expect(involved.status).toBe('blocked');
    expect(involved.steps).toEqual([]);
    expect(involved.blockedReasons.map((reason) => reason.code)).toEqual(['SCHEMA_FACTS_REQUIRED']);
    expect(involved.sourceEvidence.some((evidence) => evidence.kind === 'schema_diagnostic')).toBe(true);

    const directFacts = generateFixtureExtractionPlan({
      sql: 'select t.ticket_id from support_ticket t where t.ticket_id = :ticket_id;',
      schemaFacts: {
        kind: 'schema-facts',
        version: 1,
        tables: {
          support_ticket: {
            name: 'support_ticket',
            columns: { ticket_id: { name: 'ticket_id', type: 'integer' } },
            primaryKey: ['ticket_id'],
          },
        },
        diagnostics: [{ code: 'ddl_parse_warning', message: 'Skipped DDL.', severity: 'warning' }],
      },
      reproductionKey: { parameterNames: ['ticket_id'], rootRelation: 'support_ticket', rootColumns: ['ticket_id'] },
    });
    expect(directFacts.status).toBe('blocked');
    expect(directFacts.steps).toEqual([]);
    expect(directFacts.blockedReasons.map((reason) => reason.code)).toEqual(['SCHEMA_FACTS_REQUIRED']);

    const unrelated = generateFixtureExtractionPlan({
      sql: 'select t.ticket_id from support_ticket t where t.ticket_id = :ticket_id;',
      ddl: [
        { filePath: 'support_ticket.sql', sql: 'create table support_ticket (ticket_id integer primary key);' },
        { filePath: 'unrelated.sql', sql: 'create table unrelated (id integer primary key); alter table unrelated bogus action;' },
      ],
      reproductionKey: { parameterNames: ['ticket_id'], rootRelation: 'support_ticket', rootColumns: ['ticket_id'] },
    });
    expect(unrelated.status).toBe('blocked');
    expect(unrelated.steps).toEqual([]);
    expect(unrelated.blockedReasons.map((reason) => reason.code)).toEqual(['SCHEMA_FACTS_REQUIRED']);

    const mixedFile = generateFixtureExtractionPlan({
      sql: 'select t.ticket_id from support_ticket t where t.ticket_id = :ticket_id;',
      ddl: [
        { filePath: 'support.sql', sql: 'create table support_ticket (ticket_id integer primary key);' },
        { filePath: 'mixed.sql', sql: 'create table unrelated (id integer primary key); alter table support_ticket bogus action;' },
      ],
      reproductionKey: { parameterNames: ['ticket_id'], rootRelation: 'support_ticket', rootColumns: ['ticket_id'] },
    });
    expect(mixedFile.status).toBe('blocked');
    expect(mixedFile.steps).toEqual([]);
    expect(mixedFile.blockedReasons.map((reason) => reason.code)).toEqual(['SCHEMA_FACTS_REQUIRED']);
  });

  it('blocks a reproduction parameter mapped to multiple normalized root columns', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select t.ticket_id from support_ticket t where t.ticket_id = :ticket_id and t.owner_id = :ticket_id;',
      'create table support_ticket (ticket_id integer primary key, owner_id integer not null);',
      'support_ticket',
      'ticket_id',
    ));
    expect(plan.status).toBe('blocked');
    expect(plan.steps).toEqual([]);
    expect(plan.reproductionKey.columnParameterMappings).toEqual([]);
    expect(plan.blockedReasons.map((reason) => reason.code)).toEqual(['REPRODUCTION_KEY_AMBIGUOUS']);
  });

  it('fails closed when parser facts cannot distinguish quoted from case-variant identifiers', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select p."ID" from "Parent" p where p."ID" = :id;',
      'create table "Parent" ("ID" integer primary key);',
      'Parent',
      'ID',
      'id',
    ));
    expect(plan.status).toBe('blocked');
    expect(plan.steps).toEqual([]);
    expect(plan.blockedReasons.map((reason) => reason.code)).toEqual(['ROOT_RELATION_UNRESOLVED']);
  });

  it('rejects value-bearing input without echoing, hashing, or serializing the sentinel', () => {
    const sentinel = 'fixture-secret-sentinel';
    let error: unknown;
    try {
      generateFixtureExtractionPlan({
        ...input('select t.ticket_id from support_ticket t where t.ticket_id = :ticket_id;', 'create table support_ticket (ticket_id integer primary key);', 'support_ticket', 'ticket_id'),
        bindings: { ticket_id: sentinel },
      } as unknown as FixtureExtractionInput);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(FixtureExtractionInputError);
    expect(error).toMatchObject({ code: 'VALUE_BEARING_INPUT_FORBIDDEN' });
    expect(String(error)).not.toContain(sentinel);
  });

  it.each(['binding', 'bindings', 'bindingValue', 'bindingValues', 'value', 'values', 'providedValues'])
  ('rejects forbidden input field %s at the top-level boundary', (field) => {
    const sentinel = `sentinel-${field}`;
    expect(() => generateFixtureExtractionPlan({
      ...input('select t.ticket_id from support_ticket t where t.ticket_id = :ticket_id;', 'create table support_ticket (ticket_id integer primary key);', 'support_ticket', 'ticket_id'),
      [field]: sentinel,
    } as unknown as FixtureExtractionInput)).toThrow(expect.objectContaining({
      code: 'VALUE_BEARING_INPUT_FORBIDDEN',
      message: 'Value-bearing input is forbidden for fixture extraction.',
    }));
  });

  it('blocks a composite root in minimum  without emitting capture SQL', () => {
    const plan = generateFixtureExtractionPlan({
      sql: 'select t.tenant_id, t.ticket_id from tenant_ticket t where t.tenant_id = :tenant_id and t.ticket_id = :ticket_id;',
      ddl: [{ sql: 'create table tenant_ticket (tenant_id integer not null, ticket_id integer not null, primary key (tenant_id, ticket_id));' }],
      reproductionKey: {
        parameterNames: ['tenant_id', 'ticket_id'],
        rootRelation: 'tenant_ticket',
        rootColumns: ['tenant_id', 'ticket_id'],
      },
    });
    expect(plan.status).toBe('blocked');
    expect(plan.steps).toEqual([]);
    expect(plan.blockedReasons.map((reason) => reason.code)).toEqual(['REPRODUCTION_KEY_AMBIGUOUS']);
  });

  it('rejects malformed SchemaFacts with the fixed input-shape error', () => {
    expect(() => generateFixtureExtractionPlan({
      sql: 'select t.ticket_id from support_ticket t where t.ticket_id = :ticket_id;',
      schemaFacts: {
        kind: 'schema-facts',
        version: 1,
        tables: { support_ticket: null },
      } as unknown as FixtureExtractionInput['schemaFacts'],
      reproductionKey: { parameterNames: ['ticket_id'], rootRelation: 'support_ticket', rootColumns: ['ticket_id'] },
    })).toThrow(expect.objectContaining({
      code: 'INPUT_SHAPE_INVALID',
      message: 'Fixture extraction input has an invalid shape.',
    }));

    expect(() => generateFixtureExtractionPlan({
      sql: 'select t.ticket_id from support_ticket t where t.ticket_id = :ticket_id;',
      schemaFacts: {
        kind: 'schema-facts',
        version: 1,
        tables: {
          support_ticket: {
            name: 'support_ticket',
            columns: { ticket_id: { name: 'ticket_id' } },
            primaryKey: ['missing_id'],
          },
        },
      },
      reproductionKey: { parameterNames: ['ticket_id'], rootRelation: 'support_ticket', rootColumns: ['ticket_id'] },
    })).toThrow(expect.objectContaining({
      code: 'INPUT_SHAPE_INVALID',
      message: 'Fixture extraction input has an invalid shape.',
    }));
  });

  it('fails closed for an unsupported scalar subquery instead of claiming ready closure', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select t.ticket_id, (select max(a.audit_id) from audit_log a) as last_audit from support_ticket t where t.ticket_id = :ticket_id;',
      'create table support_ticket (ticket_id integer primary key); create table audit_log (audit_id integer primary key);',
      'support_ticket',
      'ticket_id',
    ));
    expect(plan.status).toBe('blocked');
    expect(plan.steps).toEqual([]);
    expect(plan.blockedReasons.map((reason) => reason.code)).toEqual(['PARAMETER_PROPAGATION_UNPROVEN']);
  });

  it('fails closed for set operations until complete branch proof exists', () => {
    const plan = generateFixtureExtractionPlan(input(
      'select t.ticket_id from support_ticket t where t.ticket_id = :ticket_id union all select t.ticket_id from support_ticket t where t.ticket_id = :ticket_id;',
      'create table support_ticket (ticket_id integer primary key);',
      'support_ticket',
      'ticket_id',
    ));
    expect(plan.status).toBe('blocked');
    expect(plan.steps).toEqual([]);
    expect(plan.blockedReasons.map((reason) => reason.code)).toEqual(['PARAMETER_PROPAGATION_UNPROVEN']);
  });

  it('is deterministic under reversed DDL table order and closes all references', () => {
    const sql = 'select a.account_id, n.note_id from account a left join account_note n on n.account_id = a.account_id where a.account_id = :account_id;';
    const ddlA = { sql: 'create table account (account_id integer primary key, display_label text not null);' };
    const ddlB = { sql: 'create table account_note (note_id integer primary key, account_id integer not null references account(account_id));' };
    const base = { sql, reproductionKey: { parameterNames: ['account_id'], rootRelation: 'account', rootColumns: ['account_id'] } } as const;
    const left = generateFixtureExtractionPlan({ ...base, ddl: [ddlA, ddlB] });
    const right = generateFixtureExtractionPlan({ ...base, ddl: [ddlB, ddlA] });
    expect(canonicalFixtureExtractionPlanJson(left)).toBe(canonicalFixtureExtractionPlanJson(right));

    const evidenceIds = new Set(left.sourceEvidence.map((item) => item.id));
    const stepIds = new Set(left.steps.map((item) => item.id));
    expect(left.sourceEvidence.every((item) => /^fixture-evidence:[0-9]{4}$/.test(item.id))).toBe(true);
    expect(left.steps.every((step) => /^fixture-step:[0-9]{3}$/.test(step.id) && /^relation-occurrence:[0-9]{4}$/.test(step.relationOccurrenceId))).toBe(true);
    expect(left.steps.flatMap((step) => [...step.sourceEvidenceIds, ...step.boundary.sourceEvidenceIds]).every((id) => evidenceIds.has(id))).toBe(true);
    expect(left.steps.flatMap((step) => [...step.dependsOnStepIds, ...step.loadAfterStepIds]).every((id) => stepIds.has(id))).toBe(true);
  });

  it('canonicalizes schema diagnostic evidence independently of input order', () => {
    const base = {
      sql: 'select t.ticket_id from support_ticket t where t.ticket_id = :ticket_id;',
      reproductionKey: { parameterNames: ['ticket_id'], rootRelation: 'support_ticket', rootColumns: ['ticket_id'] },
    } as const;
    const schemaFacts = {
      kind: 'schema-facts' as const,
      version: 1 as const,
      tables: {
        support_ticket: {
          name: 'support_ticket',
          columns: { ticket_id: { name: 'ticket_id' } },
          primaryKey: ['ticket_id'],
        },
      },
    };
    const alpha = { code: 'alpha', message: 'First warning.', severity: 'warning' as const };
    const beta = { code: 'beta', message: 'Second warning.', severity: 'warning' as const };
    const left = generateFixtureExtractionPlan({ ...base, schemaFacts: { ...schemaFacts, diagnostics: [alpha, beta] } });
    const right = generateFixtureExtractionPlan({ ...base, schemaFacts: { ...schemaFacts, diagnostics: [beta, alpha] } });

    expect(left.status).toBe('blocked');
    expect(right.status).toBe('blocked');
    expect(canonicalFixtureExtractionPlanJson(left)).toBe(canonicalFixtureExtractionPlanJson(right));
    expect(left.sourceEvidence.map((evidence) => evidence.sourceId)).toEqual([
      'schema-diagnostic:0001:alpha',
      'schema-diagnostic:0002:beta',
    ]);
  });

  it('blocks top-level DML and volatile function sources before lineage analysis', () => {
    const dml = generateFixtureExtractionPlan(input(
      "update support_ticket set subject = 'changed' where ticket_id = :ticket_id returning ticket_id;",
      'create table support_ticket (ticket_id integer primary key, subject text not null);',
      'support_ticket',
      'ticket_id',
    ));
    expect(dml.blockedReasons.map((item) => item.code)).toEqual(['DML_STATEMENT_UNSUPPORTED', 'RETURNING_UNSUPPORTED']);

    const volatile = generateFixtureExtractionPlan(input(
      'select r.value from random_rows() as r where r.value = :value;',
      'create table random_rows (value integer primary key);',
      'random_rows',
      'value',
    ));
    expect(volatile.blockedReasons.map((item) => item.code)).toEqual(['VOLATILE_SOURCE_UNSUPPORTED']);
  });

  it('fails closed for scalar functions whose volatility is not proven', () => {
    const unclassified = generateFixtureExtractionPlan(input(
      'select lower(t.subject) from support_ticket as t where t.ticket_id = :ticket_id;',
      'create table support_ticket (ticket_id integer primary key, subject text not null);',
      'support_ticket',
      'ticket_id',
    ));
    expect(unclassified.status).toBe('blocked');
    expect(unclassified.blockedReasons.map((item) => item.code)).toEqual(['VOLATILE_SOURCE_UNSUPPORTED']);
    expect(unclassified.steps).toEqual([]);

    const resultShapeAffecting = generateFixtureExtractionPlan(input(
      'select distinct on (lower(t.subject)) t.ticket_id from support_ticket as t where t.ticket_id = :ticket_id;',
      'create table support_ticket (ticket_id integer primary key, subject text not null);',
      'support_ticket',
      'ticket_id',
    ));
    expect(resultShapeAffecting.status).toBe('blocked');
    expect(resultShapeAffecting.blockedReasons.map((item) => item.code)).toEqual(['VOLATILE_SOURCE_UNSUPPORTED']);
    expect(resultShapeAffecting.steps).toEqual([]);

    const populationAffecting = generateFixtureExtractionPlan(input(
      "select a.account_id from billing_account as a left join synthetic_payment as p on p.account_id = a.account_id and lower(p.payment_state) = 'paid' where a.account_id = :account_id;",
      'create table billing_account (account_id integer primary key); create table synthetic_payment (payment_id integer primary key, account_id integer not null references billing_account(account_id), payment_state text not null);',
      'billing_account',
      'account_id',
    ));
    expect(populationAffecting.status).toBe('blocked');
    expect(populationAffecting.blockedReasons.map((item) => item.code)).toEqual(['VOLATILE_SOURCE_UNSUPPORTED']);
    expect(populationAffecting.steps).toEqual([]);

    const qualifiedLookalike = generateFixtureExtractionPlan(input(
      'select custom.sum(t.ticket_id) from support_ticket as t where t.ticket_id = :ticket_id;',
      'create table support_ticket (ticket_id integer primary key, subject text not null);',
      'support_ticket',
      'ticket_id',
    ));
    expect(qualifiedLookalike.status).toBe('blocked');
    expect(qualifiedLookalike.blockedReasons.map((item) => item.code)).toEqual(['VOLATILE_SOURCE_UNSUPPORTED']);
    expect(qualifiedLookalike.steps).toEqual([]);

    const knownVolatile = generateFixtureExtractionPlan(input(
      'select random(), t.subject from support_ticket as t where t.ticket_id = :ticket_id;',
      'create table support_ticket (ticket_id integer primary key, subject text not null);',
      'support_ticket',
      'ticket_id',
    ));
    expect(knownVolatile.status).toBe('blocked');
    expect(knownVolatile.blockedReasons.map((item) => item.code)).toEqual(['VOLATILE_SOURCE_UNSUPPORTED']);
    expect(knownVolatile.steps).toEqual([]);

    const functionFree = generateFixtureExtractionPlan(input(
      'select t.subject from support_ticket as t where t.ticket_id = :ticket_id;',
      'create table support_ticket (ticket_id integer primary key, subject text not null);',
      'support_ticket',
      'ticket_id',
    ));
    expectReadySql(functionFree);
    expect(functionFree.steps).toHaveLength(1);
  });

  it('blocks parser-classified environment state without matching SQL text', () => {
    for (const expression of ['current_timestamp', 'current_date']) {
      const plan = generateFixtureExtractionPlan(input(
        `select ${expression}, t.subject from support_ticket as t where t.ticket_id = :ticket_id;`,
        'create table support_ticket (ticket_id integer primary key, subject text not null);',
        'support_ticket',
        'ticket_id',
      ));
      expect(plan.status).toBe('blocked');
      expect(plan.blockedReasons.map((item) => item.code)).toEqual(['ENVIRONMENT_STATE_UNSUPPORTED']);
      expect(plan.steps).toEqual([]);
    }

    for (const expression of [
      'current_catalog',
      'current_role',
      'current_schema',
      'current_time',
      'current_user',
      'localtime',
      'localtimestamp',
      'session_user',
      'user',
    ]) {
      const plan = generateFixtureExtractionPlan(input(
        `select ${expression}, t.subject from support_ticket as t where t.ticket_id = :ticket_id;`,
        'create table support_ticket (ticket_id integer primary key, subject text not null);',
        'support_ticket',
        'ticket_id',
      ));
      expect(plan.blockedReasons.map((item) => item.code)).toEqual(['ENVIRONMENT_STATE_UNSUPPORTED']);
      expect(plan.steps).toEqual([]);
    }

    const populationAffecting = generateFixtureExtractionPlan(input(
      'select t.subject from support_ticket as t where t.ticket_id = :ticket_id and t.updated_at <= current_timestamp;',
      'create table support_ticket (ticket_id integer primary key, subject text not null, updated_at timestamp not null);',
      'support_ticket',
      'ticket_id',
    ));
    expect(populationAffecting.blockedReasons.map((item) => item.code)).toEqual(['ENVIRONMENT_STATE_UNSUPPORTED']);
    expect(populationAffecting.steps).toEqual([]);

    const textLiteral = generateFixtureExtractionPlan(input(
      "select 'current_date' as label, t.subject from support_ticket as t where t.ticket_id = :ticket_id;",
      'create table support_ticket (ticket_id integer primary key, subject text not null);',
      'support_ticket',
      'ticket_id',
    ));
    expectReadySql(textLiteral);
    expect(textLiteral.steps).toHaveLength(1);
  });
});
