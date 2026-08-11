import { describe, expect, it } from 'vitest';
import { inspectQueryContract } from './queryContractInspection';

describe('inspectQueryContract', () => {
  it('preserves parameter occurrences, output order, aliases, and physical tables', () => {
    const result = inspectQueryContract({
      sql: `with active as (
        select order_id, customer_id from public.orders where customer_id = :customer
      )
      select order_id as id, customer_id from active
      where customer_id = :customer and order_id = $1 and order_id > ?`,
    });

    expect(result.parameters).toEqual([
      { name: 'customer', occurrenceIndex: 0, sourceText: ':customer', style: 'named' },
      { name: 'customer', occurrenceIndex: 1, sourceText: ':customer', style: 'named' },
      { index: 1, occurrenceIndex: 2, sourceText: '$1', style: 'indexed' },
      { occurrenceIndex: 3, sourceText: '?', style: 'anonymous' },
    ]);
    expect(result.outputColumns).toEqual([
      { name: 'id', outputIndex: 0 },
      { name: 'customer_id', outputIndex: 1 },
    ]);
    expect(result.referencedTables).toEqual([
      { name: 'orders', qualifiedName: 'public.orders', schemaName: 'public' },
    ]);
  });

  it('expands wildcard outputs and includes only DDL-proven metadata', () => {
    const withDdl = inspectQueryContract({
      ddl: [{ sql: 'create table public.orders (order_id bigint not null, amount numeric null);' }],
      sql: 'select * from public.orders',
    });
    const withoutDdl = inspectQueryContract({ sql: 'select order_id from public.orders' });

    expect(withDdl.outputColumns).toEqual([
      {
        name: 'order_id',
        nullable: false,
        outputIndex: 0,
        source: { columnName: 'order_id', tableName: 'public.orders' },
        type: 'bigint',
      },
      {
        name: 'amount',
        nullable: true,
        outputIndex: 1,
        source: { columnName: 'amount', tableName: 'public.orders' },
        type: 'numeric',
      },
    ]);
    expect(withoutDdl.outputColumns).toEqual([{ name: 'order_id', outputIndex: 0 }]);
    expect(withoutDdl.outputColumns[0]).not.toHaveProperty('type');
    expect(withoutDdl.outputColumns[0]).not.toHaveProperty('nullable');
  });

  it('treats an empty DDL array the same as omitted DDL', () => {
    expect(inspectQueryContract({ ddl: [], sql: 'select o.order_id from public.orders o' }))
      .toEqual(inspectQueryContract({ sql: 'select o.order_id from public.orders o' }));
  });

  it('reports DDL nullability only when the query output preserves the source guarantee', () => {
    const joinDdl = [{ sql: `
      create table orders (id bigint not null, optional_id bigint null, customer_id bigint not null);
      create table customers (id bigint not null);
    ` }];
    const single = inspectQueryContract({ ddl: joinDdl, sql: 'select o.id, o.optional_id from orders o' });
    const inner = inspectQueryContract({
      ddl: joinDdl,
      sql: 'select o.id, c.id as customer_id from orders o join customers c on c.id = o.customer_id',
    });
    const left = inspectQueryContract({
      ddl: joinDdl,
      sql: 'select c.id from orders o left join customers c on c.id = o.customer_id',
    });
    const right = inspectQueryContract({
      ddl: joinDdl,
      sql: 'select o.id from orders o right join customers c on c.id = o.customer_id',
    });
    const full = inspectQueryContract({
      ddl: joinDdl,
      sql: 'select o.id, c.id as customer_id from orders o full join customers c on c.id = o.customer_id',
    });

    expect(single.outputColumns).toMatchObject([
      { name: 'id', nullable: false, type: 'bigint' },
      { name: 'optional_id', nullable: true, type: 'bigint' },
    ]);
    expect(inner.outputColumns).toMatchObject([
      { name: 'id', nullable: false },
      { name: 'customer_id', nullable: false },
    ]);
    expect(left.outputColumns[0]).toMatchObject({ name: 'id', type: 'bigint' });
    expect(left.outputColumns[0]).not.toHaveProperty('nullable');
    expect(right.outputColumns[0]).toMatchObject({ name: 'id', type: 'bigint' });
    expect(right.outputColumns[0]).not.toHaveProperty('nullable');
    expect(full.outputColumns[0]).not.toHaveProperty('nullable');
    expect(full.outputColumns[1]).not.toHaveProperty('nullable');
  });

  it('accounts for later outer joins in a join chain', () => {
    const result = inspectQueryContract({
      ddl: [{ sql: `
        create table orders (id bigint not null, customer_id bigint not null);
        create table customers (id bigint not null, region_id bigint not null);
        create table regions (id bigint not null);
      ` }],
      sql: `select o.id, c.id as customer_id, r.id as region_id
        from orders o
        join customers c on c.id = o.customer_id
        right join regions r on r.id = c.region_id`,
    });

    expect(result.outputColumns[0]).not.toHaveProperty('nullable');
    expect(result.outputColumns[1]).not.toHaveProperty('nullable');
    expect(result.outputColumns[2]).toMatchObject({ nullable: false, type: 'bigint' });
  });

  it('returns parse failures as structured inspection diagnostics', () => {
    expect(inspectQueryContract({ sql: 'select from' })).toMatchObject({
      diagnostics: [expect.objectContaining({ code: 'QUERY_CONTRACT_PARSE_ERROR', severity: 'error' })],
      outputColumns: [],
      parameters: [],
      referencedTables: [],
    });
  });
});
