import type { SchemaRegistry } from '@rawsql-ts/testkit-core';

const SCHEMA: Record<string, { columns: Record<string, string> }> = {
  'public.customers': {
    columns: {
      id: 'INTEGER',
      email: 'TEXT',
      display_name: 'TEXT',
      tier: 'TEXT',
      suspended_at: 'TEXT',
    },
  },
  'public.customer_tiers': {
    columns: {
      tier: 'TEXT',
      monthly_quota: 'INTEGER',
      priority_level: 'TEXT',
      escalation_sla_hours: 'INTEGER',
    },
  },
};

export const demoSchemaRegistry: SchemaRegistry = {
  getTable(name: string) {
    const normalized = name.toLowerCase();
    return SCHEMA[normalized];
  },
};
