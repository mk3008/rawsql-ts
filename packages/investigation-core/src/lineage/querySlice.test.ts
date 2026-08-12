import {
  CTEQueryDecomposer,
  SelectQueryParser,
  SimpleSelectQuery,
  SqlFormatter,
  type QueryScopeSelectorV1,
} from 'rawsql-ts';
import { describe, expect, it } from 'vitest';
import { analyzeQueryStructure } from './queryStructureAnalysis';
import { QuerySliceInputError, sliceQueryScope } from './querySlice';

describe('sliceQueryScope', () => {
  it('returns reparsable SQL for root, derived, scalar, EXISTS, IN, and set-branch scopes', () => {
    const cases: Array<{ selector: QueryScopeSelectorV1; sql: string }> = [
      { sql: 'select id from orders', selector: rootSelector() },
      {
        sql: 'select * from (select o.id from orders o) picked',
        selector: selector({ index: 0, kind: 'source_subquery', source: 'from' }),
      },
      {
        sql: 'select (select max(p.amount) from payments p) from orders o',
        selector: selector({ clause: 'select', index: 0, kind: 'expression_subquery', subqueryKind: 'scalar_subquery' }),
      },
      {
        sql: 'select * from orders o where exists (select 1 from payments p where p.amount > 0)',
        selector: selector({ clause: 'where', index: 0, kind: 'expression_subquery', subqueryKind: 'exists' }),
      },
      {
        sql: 'select * from orders o where o.id in (select p.order_id from payments p)',
        selector: selector({ clause: 'where', index: 0, kind: 'expression_subquery', subqueryKind: 'in_subquery' }),
      },
      {
        sql: 'select o.id from orders o union all select a.id from archived_orders a',
        selector: selector({ kind: 'set_branch', side: 'right' }),
      },
    ];

    for (const input of cases) {
      const result = sliceQueryScope(input);
      expect(result.status).toBe('ready');
      expect(result.outerReferenceStatus).toBe('none');
      expect(result.diagnostics).toEqual([]);
      if (result.status === 'ready') expect(() => SelectQueryParser.parse(result.sql)).not.toThrow();
    }
  });

  it('rejects invalid source SQL and selectors that do not belong to the supplied SQL', () => {
    expect(() => sliceQueryScope({ sql: 'select * from', selector: rootSelector() }))
      .toThrowError(expect.objectContaining({ code: 'SOURCE_SQL_INVALID' }));
    expect(() => sliceQueryScope({
      sql: 'select id from orders',
      selector: selector({ index: 0, kind: 'source_subquery', source: 'from' }),
    })).toThrowError(expect.objectContaining({ code: 'SCOPE_SELECTOR_NOT_FOUND' }));
    expect(() => sliceQueryScope({
      sql: 'select * from (select id from orders) changed',
      selector: selector({ clause: 'select', index: 0, kind: 'expression_subquery', subqueryKind: 'scalar_subquery' }),
    })).toThrow(QuerySliceInputError);
  });

  it.each([
    {
      kind: 'exists',
      sql: 'select * from orders o where exists (select 1 from payments p where p.order_id = o.order_id)',
      selector: selector({ clause: 'where', index: 0, kind: 'expression_subquery', subqueryKind: 'exists' }),
    },
    {
      kind: 'scalar_subquery',
      sql: 'select (select max(p.amount) from payments p where p.order_id = o.order_id) from orders o',
      selector: selector({ clause: 'select', index: 0, kind: 'expression_subquery', subqueryKind: 'scalar_subquery' }),
    },
  ])('blocks correlated $kind scopes without SQL', ({ sql, selector: target }) => {
    const result = sliceQueryScope({ sql, selector: target });

    expect(result).toMatchObject({
      diagnostics: [{ code: 'SCOPE_CORRELATED' }],
      outerReferenceStatus: 'correlated',
      status: 'blocked',
    });
    expect(result).not.toHaveProperty('sql');
  });

  it('blocks unresolved ownership and allows existing DDL facts to prove the same scope standalone', () => {
    const sql = 'select (select amount from payments p) from orders o';
    const target = selector({ clause: 'select', index: 0, kind: 'expression_subquery', subqueryKind: 'scalar_subquery' });
    const withoutDdl = sliceQueryScope({ sql, selector: target });
    const withDdl = sliceQueryScope({
      sql,
      selector: target,
      ddl: [{ sql: 'create table orders (order_id bigint); create table payments (amount numeric);' }],
    });

    expect(withoutDdl).toMatchObject({
      diagnostics: [{ code: 'SCOPE_REFERENCE_UNRESOLVED' }],
      status: 'blocked',
    });
    expect(withoutDdl).not.toHaveProperty('sql');
    expect(withDdl).toMatchObject({ outerReferenceStatus: 'none', status: 'ready' });
  });

  it('treats an empty DDL array exactly like omitted DDL', () => {
    const input = {
      sql: 'select (select amount from payments p) from orders o',
      selector: selector({ clause: 'select', index: 0, kind: 'expression_subquery', subqueryKind: 'scalar_subquery' }),
    } as const;

    expect(sliceQueryScope({ ...input, ddl: [] })).toEqual(sliceQueryScope(input));
  });

  it.each([
    {
      kind: 'scalar',
      sql: `select * from orders o join lateral (
        select (select max(p.amount) from payments p where p.order_id = o.id) as amount
      ) x on true`,
    },
    {
      kind: 'exists',
      sql: `select * from orders o join lateral (
        select p.id from payments p where exists (
          select 1 from refunds r where r.order_id = o.id
        )
      ) x on true`,
    },
  ])('blocks a selected derived scope whose nested $kind escapes the selected boundary', ({ sql }) => {
    const result = sliceQueryScope({
      sql,
      selector: derivedSelector(sql),
    });

    expect(result).toMatchObject({
      diagnostics: [{ code: 'SCOPE_REFERENCE_UNRESOLVED' }],
      status: 'blocked',
    });
    expect(result).not.toHaveProperty('sql');
  });

  it.each([
    {
      kind: 'scalar',
      sql: `select * from (
        select p.id, (
          select max(x.amount) from payments x where x.order_id = p.id
        ) as max_amount from purchases p
      ) picked`,
    },
    {
      kind: 'exists',
      sql: `select * from (
        select p.id from purchases p where exists (
          select 1 from payments x where x.order_id = p.id
        )
      ) picked`,
    },
  ])('allows a selected derived scope whose nested $kind correlation stays inside the boundary', ({ sql }) => {
    const result = sliceQueryScope({
      sql,
      selector: selector({ index: 0, kind: 'source_subquery', source: 'from' }),
    });

    expect(result).toMatchObject({ status: 'ready' });
    if (result.status === 'ready') expect(() => SelectQueryParser.parse(result.sql)).not.toThrow();
  });

  it('blocks a selected scope with an unresolved descendant', () => {
    const result = sliceQueryScope({
      sql: 'select * from (select (select missing.id) as id) picked',
      selector: selector({ index: 0, kind: 'source_subquery', source: 'from' }),
    });

    expect(result).toMatchObject({
      diagnostics: [{ code: 'SCOPE_REFERENCE_UNRESOLVED' }],
      status: 'blocked',
    });
    expect(result).not.toHaveProperty('sql');
  });

  it('restores a CTE dependency chain in analyzer order and excludes unused CTEs', () => {
    const sql = `with base as (select o.id from orders o),
      filtered as (select b.id from base b where b.id > 0),
      selected as (select f.id from filtered f),
      unused as (select a.id from audit_log a)
      select * from selected`;
    const result = sliceQueryScope({
      sql,
      selector: selector({ index: 2, kind: 'cte', name: 'selected' }),
    });

    expect(result).toMatchObject({
      directCteNames: ['filtered'],
      includedCteNames: ['base', 'filtered'],
      scopeKind: 'cte',
      status: 'ready',
    });
    if (result.status === 'ready') {
      expect(result.sql).toContain('base');
      expect(result.sql).toContain('filtered');
      expect(result.sql).not.toContain('unused');
    }
  });

  it('includes one directly required CTE without inventing transitive dependencies', () => {
    const result = sliceQueryScope({
      sql: 'with base as (select o.id from orders o), filtered as (select b.id from base b) select * from filtered',
      selector: selector({ index: 1, kind: 'cte', name: 'filtered' }),
    });

    expect(result).toMatchObject({
      directCteNames: ['base'],
      includedCteNames: ['base'],
      scopeKind: 'cte',
      status: 'ready',
    });
  });

  it('keeps CTE-scope extraction semantically aligned with extract_cte_query', () => {
    const sql = `with base as (select o.id from orders o),
      filtered as (select b.id from base b where b.id > 0)
      select * from filtered`;
    const query = SelectQueryParser.parse(sql);
    expect(query).toBeInstanceOf(SimpleSelectQuery);
    const extracted = new CTEQueryDecomposer().extractCTE(query as SimpleSelectQuery, 'filtered');
    const sliced = sliceQueryScope({ sql, selector: selector({ index: 1, kind: 'cte', name: 'filtered' }) });

    expect(sliced.status).toBe('ready');
    if (sliced.status === 'ready') {
      expect(normalizeSql(sliced.sql)).toBe(normalizeSql(extracted.executableSql));
    }
  });

  it('uses the decomposer for a set-operation CTE whose dependency is visible only in a branch scope', () => {
    const sql = `with base as (select id from orders),
      target as (
        select id from base
        union all
        select id from archived_orders
      )
      select * from target`;
    const result = sliceQueryScope({ sql, selector: selector({ index: 1, kind: 'cte', name: 'target' }) });

    expect(result).toMatchObject({ includedCteNames: ['base'], status: 'ready' });
    if (result.status === 'ready') {
      expect(result.sql).toMatch(/\bwith\s+"?base"?\s+as\b/i);
      expect(() => SelectQueryParser.parse(result.sql)).not.toThrow();
    }
  });

  it.each([
    {
      kind: 'scalar subquery',
      target: 'select (select max(id) from base) as max_id',
    },
    {
      kind: 'EXISTS subquery',
      target: `select o.id from orders o where exists (
        select 1 from base b where b.id = o.id
      )`,
    },
  ])('restores a CTE referenced only by a nested $kind', ({ target }) => {
    const sql = `with base as (select id from orders),
      target as (${target})
      select * from target`;
    const result = sliceQueryScope({ sql, selector: selector({ index: 1, kind: 'cte', name: 'target' }) });

    expect(result).toMatchObject({ includedCteNames: ['base'], status: 'ready' });
    if (result.status === 'ready') expect(result.sql).toMatch(/\bwith\s+"?base"?\s+as\b/i);
  });

  it('composes external CTE closure for an arbitrary derived scope', () => {
    const sql = `with base as (select o.id from orders o),
      filtered as (select b.id from base b where b.id > 0),
      unused as (select a.id from audit_log a)
      select * from (select f.id from filtered f) picked`;
    const result = sliceQueryScope({
      sql,
      selector: selector({ index: 0, kind: 'source_subquery', source: 'from' }),
    });

    expect(result).toMatchObject({
      directCteNames: ['filtered'],
      includedCteNames: ['base', 'filtered'],
      status: 'ready',
    });
    if (result.status === 'ready') expect(result.sql).not.toContain('unused');
  });

  it('composes an external CTE referenced only by a nested subquery in an arbitrary scope', () => {
    const sql = `with base as (select id from orders)
      select * from (
        select (select max(id) from base) as max_id
      ) picked`;
    const result = sliceQueryScope({
      sql,
      selector: selector({ index: 0, kind: 'source_subquery', source: 'from' }),
    });

    expect(result).toMatchObject({ includedCteNames: ['base'], status: 'ready' });
    if (result.status === 'ready') expect(result.sql).toMatch(/\bwith\s+"?base"?\s+as\b/i);
  });

  it('keeps a scope-owned WITH clause intact without injecting its CTEs again', () => {
    const sql = `select * from (
      with local as (select o.id from orders o)
      select l.id from local l
    ) picked`;
    const result = sliceQueryScope({
      sql,
      selector: selector({ index: 0, kind: 'source_subquery', source: 'from' }),
    });

    expect(result).toMatchObject({ directCteNames: ['local'], includedCteNames: [], status: 'ready' });
    if (result.status === 'ready') expect((result.sql.match(/\bwith\b/gi) ?? [])).toHaveLength(1);
  });

  it('resolves a shadowed nested WITH context by selector ancestry', () => {
    const sql = `with records as (select o.id from outer_records o)
      select * from (
        with records as (select i.id from inner_records i),
        filtered as (select r.id from records r)
        select (select f.id from filtered f) as id
      ) nested`;
    const result = sliceQueryScope({
      sql,
      selector: selector(
        { index: 0, kind: 'source_subquery', source: 'from' },
        { clause: 'select', index: 0, kind: 'expression_subquery', subqueryKind: 'scalar_subquery' },
      ),
    });

    expect(result).toMatchObject({ includedCteNames: ['records', 'filtered'], status: 'ready' });
    if (result.status === 'ready') {
      expect(result.sql).toContain('inner_records');
      expect(result.sql).not.toContain('outer_records');
    }
  });

  it('blocks nested WITH plus outer CTE and multiple lexical contexts', () => {
    const nestedWith = sliceQueryScope({
      sql: `with outer_cte as (select o.id from orders o)
        select * from (
          with inner_cte as (select i.id from inner_records i)
          select o.id from outer_cte o
        ) nested`,
      selector: selector({ index: 0, kind: 'source_subquery', source: 'from' }),
    });
    const multipleContexts = sliceQueryScope({
      sql: `with outer_cte as (select o.id from orders o)
        select * from (
          with inner_cte as (select i.id from inner_records i)
          select (select i.id from inner_cte i join outer_cte o on o.id = i.id) as id
        ) nested`,
      selector: selector(
        { index: 0, kind: 'source_subquery', source: 'from' },
        { clause: 'select', index: 0, kind: 'expression_subquery', subqueryKind: 'scalar_subquery' },
      ),
    });

    expect(nestedWith).toMatchObject({ diagnostics: [{ code: 'MULTIPLE_CTE_CONTEXTS_UNSUPPORTED' }], status: 'blocked' });
    expect(multipleContexts).toMatchObject({ diagnostics: [{ code: 'MULTIPLE_CTE_CONTEXTS_UNSUPPORTED' }], status: 'blocked' });
    expect(nestedWith).not.toHaveProperty('sql');
    expect(multipleContexts).not.toHaveProperty('sql');
  });

  it('blocks an own WITH whose nested CTE depends on a CTE outside the selected boundary', () => {
    const result = sliceQueryScope({
      sql: `with outer_cte as (select id from orders)
        select * from (
          with local as (select * from outer_cte)
          select * from local
        ) picked`,
      selector: selector({ index: 0, kind: 'source_subquery', source: 'from' }),
    });

    expect(result).toMatchObject({
      diagnostics: [{ code: 'MULTIPLE_CTE_CONTEXTS_UNSUPPORTED' }],
      status: 'blocked',
    });
    expect(result).not.toHaveProperty('sql');
  });

  it('blocks an external CTE closure whose own outer-reference status is unresolved', () => {
    const result = sliceQueryScope({
      sql: `with bad as (select missing.id),
        selected as (select * from bad)
        select * from (select * from selected) picked`,
      selector: selector({ index: 0, kind: 'source_subquery', source: 'from' }),
    });

    expect(result).toMatchObject({
      diagnostics: [{ code: 'SCOPE_REFERENCE_UNRESOLVED' }],
      status: 'blocked',
    });
    expect(result).not.toHaveProperty('sql');
  });

  it('blocks recursive CTE slicing without returning the decomposer full-context fallback', () => {
    const result = sliceQueryScope({
      sql: `with recursive tree as (
        select 1 as id
        union all
        select t.id + 1 from tree t where t.id < 3
      ) select * from tree`,
      selector: selector({ index: 0, kind: 'cte', name: 'tree' }),
    });

    expect(result).toMatchObject({ diagnostics: [{ code: 'RECURSIVE_CTE_SLICE_UNSUPPORTED' }], status: 'blocked' });
    expect(result).not.toHaveProperty('sql');
  });

  it.each([
    ['select', 'select * from (select id from orders) picked'],
    ['create table as', 'create table picked_orders as select * from (select id from orders) picked'],
    ['create view as', 'create view picked_orders as select * from (select id from orders) picked'],
    ['insert select', 'insert into picked_orders (id) select * from (select id from orders) picked'],
  ])('reuses the query-structure source extraction contract for %s', (_kind, sql) => {
    const analysis = analyzeQueryStructure({ sql });
    const derived = analysis.scopes.find((scope) => scope.scopeKind === 'derived');
    expect(derived).toBeDefined();

    const result = sliceQueryScope({ sql, selector: derived!.selector });

    expect(result).toMatchObject({ scopeKind: 'derived', status: 'ready' });
    if (result.status === 'ready') expect(() => SelectQueryParser.parse(result.sql)).not.toThrow();
  });
});

function rootSelector(): QueryScopeSelectorV1 {
  return { path: [{ kind: 'root' }], version: 1 };
}

function selector(...path: QueryScopeSelectorV1['path'] extends Array<infer Segment> ? Segment[] : never): QueryScopeSelectorV1 {
  return { path: [{ kind: 'root' }, ...path], version: 1 };
}

function derivedSelector(sql: string): QueryScopeSelectorV1 {
  const scope = analyzeQueryStructure({ sql }).scopes.find((candidate) => candidate.scopeKind === 'derived');
  if (!scope) throw new Error('Expected one derived scope in the test SQL.');
  return scope.selector;
}

function normalizeSql(sql: string): string {
  return new SqlFormatter().format(SelectQueryParser.parse(sql)).formattedSql;
}
