import { expect, test } from 'vitest';
import {
  buildRelationGraphFromCreateTableQueries,
  getIncomingRelations,
  getOutgoingRelations,
  CreateTableParser
} from '../../src';

test('buildRelationGraphFromCreateTableQueries captures column-level and table-level foreign keys', () => {
  const query = CreateTableParser.parse(`
    CREATE TABLE public.orders (
      order_id integer PRIMARY KEY,
      customer_id integer REFERENCES public.customers(id),
      salesperson_id integer,
      CONSTRAINT orders_salesperson_fk FOREIGN KEY (salesperson_id) REFERENCES public.users(id)
    );
  `);

  const graph = buildRelationGraphFromCreateTableQueries([query]);
  const outgoing = getOutgoingRelations(graph, 'public.orders');

  expect(outgoing).toHaveLength(2);
  expect(outgoing).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        childTable: 'public.orders',
        parentTable: 'public.customers',
        childColumns: ['customer_id'],
        parentColumns: ['id'],
        constraintKind: 'column-reference',
        isSelfReference: false
      }),
      expect.objectContaining({
        childTable: 'public.orders',
        parentTable: 'public.users',
        childColumns: ['salesperson_id'],
        parentColumns: ['id'],
        constraintKind: 'table-foreign-key',
        isSelfReference: false
      })
    ])
  );
});

test('buildRelationGraphFromCreateTableQueries marks self references explicitly', () => {
  const query = CreateTableParser.parse(`
    CREATE TABLE public.nodes (
      id integer PRIMARY KEY,
      parent_id integer REFERENCES public.nodes(id)
    );
  `);

  const graph = buildRelationGraphFromCreateTableQueries([query]);
  const outgoing = getOutgoingRelations(graph, 'public.nodes');
  const incoming = getIncomingRelations(graph, 'public.nodes');

  expect(outgoing).toHaveLength(1);
  expect(incoming).toHaveLength(1);
  expect(outgoing[0]).toMatchObject({
    childTable: 'public.nodes',
    parentTable: 'public.nodes',
    isSelfReference: true
  });
});
