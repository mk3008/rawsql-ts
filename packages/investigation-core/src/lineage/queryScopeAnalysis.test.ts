import { SelectQueryParser, queryScopeSelectorKey } from 'rawsql-ts';
import { describe, expect, it } from 'vitest';
import { analyzeQueryScopes } from './queryScopeAnalysis';
import { parseSchemaFactsFromDdl } from './schemaFacts';

describe('analyzeQueryScopes', () => {
  it('reports only direct CTE references for each structural scope', () => {
    const scopes = analyzeQueryScopes(SelectQueryParser.parse(`
      with base as (
        select id from orders
      ), filtered as (
        select id from base
      ), unused as (
        select id from audit_log
      )
      select *
      from (select * from filtered) x
    `));
    const byKey = new Map(scopes.map((scope) => [queryScopeSelectorKey(scope.selector), scope]));

    expect(byKey.get('v1/root/cte:0:base')?.directCteNames).toEqual([]);
    expect(byKey.get('v1/root/cte:1:filtered')?.directCteNames).toEqual(['base']);
    expect(byKey.get('v1/root/cte:2:unused')?.directCteNames).toEqual([]);
    expect(byKey.get('v1/root/source:from:0')?.directCteNames).toEqual(['filtered']);
  });

  it('classifies a non-lateral derived scope with one local source as proven none', () => {
    const scopes = analyzeQueryScopes(SelectQueryParser.parse(`
      select * from (select order_id from orders) x
    `));
    expect(scopes.find((scope) => scope.kind === 'derived')?.outerReferenceStatus).toBe('none');
  });

  it('classifies predicate and scalar qualified outer references as correlated', () => {
    const scopes = analyzeQueryScopes(SelectQueryParser.parse(`
      select (
        select max(p.amount)
        from payments p
        where p.order_id = o.order_id
      )
      from orders o
      where exists (
        select 1
        from payments p
        where p.order_id = o.order_id
      )
    `));

    expect(scopes.find((scope) => scope.kind === 'scalar_subquery')?.outerReferenceStatus).toBe('correlated');
    expect(scopes.find((scope) => scope.kind === 'exists')?.outerReferenceStatus).toBe('correlated');
  });

  it('limits a LATERAL derived scope to preceding sources', () => {
    const correlated = analyzeQueryScopes(SelectQueryParser.parse(`
      select *
      from orders o
      join lateral (select o.order_id) picked on true
      join refunds r on r.order_id = o.order_id
    `));
    const forwardReference = analyzeQueryScopes(SelectQueryParser.parse(`
      select *
      from orders o
      join lateral (select r.order_id) picked on true
      join refunds r on r.order_id = o.order_id
    `));

    expect(correlated.find((scope) => scope.kind === 'derived')?.outerReferenceStatus).toBe('correlated');
    expect(forwardReference.find((scope) => scope.kind === 'derived')?.outerReferenceStatus).toBe('unresolved');
  });

  it('fails closed for an unqualified reference whose local or outer owner is unknown', () => {
    const scopes = analyzeQueryScopes(SelectQueryParser.parse(`
      select (
        select amount
        from payments p
        where p.order_id = customer_id
      )
      from orders o
    `));

    expect(scopes.find((scope) => scope.kind === 'scalar_subquery')?.outerReferenceStatus).toBe('unresolved');
  });

  it('uses DDL facts to prove an unqualified outer reference', () => {
    const query = SelectQueryParser.parse(`
      select (
        select p.amount
        from payments p
        where p.order_id = customer_id
      )
      from orders o
    `);
    const schemaFacts = parseSchemaFactsFromDdl([{ sql: `
      create table orders (order_id bigint, customer_id bigint);
      create table payments (payment_id bigint, order_id bigint, amount numeric);
    ` }]);

    const withoutDdl = analyzeQueryScopes(query);
    const withDdl = analyzeQueryScopes(query, schemaFacts);
    expect(withoutDdl.find((scope) => scope.kind === 'scalar_subquery')?.outerReferenceStatus).toBe('unresolved');
    expect(withDdl.find((scope) => scope.kind === 'scalar_subquery')?.outerReferenceStatus).toBe('correlated');
  });

  it('uses DDL facts to prove an unqualified reference is local', () => {
    const query = SelectQueryParser.parse(`
      select (
        select amount
        from payments p
      )
      from orders o
    `);
    const schemaFacts = parseSchemaFactsFromDdl([{ sql: `
      create table orders (order_id bigint, customer_id bigint);
      create table payments (payment_id bigint, order_id bigint, amount numeric);
    ` }]);

    expect(analyzeQueryScopes(query).find((scope) => scope.kind === 'scalar_subquery')?.outerReferenceStatus)
      .toBe('unresolved');
    expect(analyzeQueryScopes(query, schemaFacts).find((scope) => scope.kind === 'scalar_subquery')?.outerReferenceStatus)
      .toBe('none');
  });

  it('resolves nested WITH shadowing by the directly visible CTE name', () => {
    const scopes = analyzeQueryScopes(SelectQueryParser.parse(`
      with records as (select id from outer_records)
      select * from (
        with records as (select id from inner_records)
        select * from records
      ) nested
    `));
    const nested = scopes.find((scope) => scope.kind === 'derived');
    expect(nested?.directCteNames).toEqual(['records']);
  });

  it('keeps predicate EXISTS inventory, selector, parent, and correlation together', () => {
    const scopes = analyzeQueryScopes(SelectQueryParser.parse(`
      select *
      from orders o
      where exists (
        select 1
        from payments p
        where p.order_id = o.order_id
      )
    `));
    const exists = scopes.find((scope) => scope.kind === 'exists');

    expect(exists).toMatchObject({
      outerReferenceStatus: 'correlated',
      parentSelector: { path: [{ kind: 'root' }], version: 1 },
      selector: {
        path: [
          { kind: 'root' },
          {
            clause: 'where',
            index: 0,
            kind: 'expression_subquery',
            subqueryKind: 'exists',
          },
        ],
        version: 1,
      },
    });
  });
});
