import type { TableDefinitionModel } from 'rawsql-ts';

export type TableDefinition = TableDefinitionModel;

export const usersTableDefinition: TableDefinition = {
  name: 'users',
  columns: [
    {
      name: 'id',
      typeName: 'int',
      required: true,
      defaultValue: "nextval('users_id_seq'::regclass)",
    },
    { name: 'email', typeName: 'text', required: true },
    { name: 'active', typeName: 'bool', required: true, defaultValue: 'true' },
  ],
};

export const ordersTableDefinition: TableDefinition = {
  name: 'orders',
  columns: [
    { name: 'id', typeName: 'int' },
    { name: 'total', typeName: 'numeric' },
  ],
};

export const sharedTableDefinitions: ReadonlyArray<TableDefinition> = [
  usersTableDefinition,
  ordersTableDefinition,
];

export const sharedTableDefinitionRegistry: Record<string, TableDefinition> = Object.fromEntries(
  sharedTableDefinitions.map((definition) => [definition.name, definition])
);
