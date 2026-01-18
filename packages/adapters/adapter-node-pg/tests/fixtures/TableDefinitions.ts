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

export const usersDrizzleTableDefinition: TableDefinition = {
  name: 'users_drizzle',
  columns: [
    {
      name: 'id',
      typeName: 'int',
      required: true,
      defaultValue: "nextval('users_drizzle_id_seq'::regclass)",
    },
    { name: 'email', typeName: 'text', required: true },
    { name: 'active', typeName: 'bool', required: true, defaultValue: 'true' },
  ],
};

export const usersPrismaTableDefinition: TableDefinition = {
  name: 'public.users_prisma',
  columns: [
    {
      name: 'id',
      typeName: 'int',
      required: true,
      defaultValue: "nextval('users_prisma_id_seq'::regclass)",
    },
    { name: 'email', typeName: 'text', required: true },
    { name: 'active', typeName: 'bool', required: true, defaultValue: 'true' },
  ],
};

export const sharedTableDefinitions: ReadonlyArray<TableDefinition> = [
  usersTableDefinition,
  ordersTableDefinition,
  usersDrizzleTableDefinition,
  usersPrismaTableDefinition,
];

export const sharedTableDefinitionRegistry: Record<string, TableDefinition> = Object.fromEntries(
  sharedTableDefinitions.map((definition) => [definition.name, definition])
);
