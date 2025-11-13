import { describe, expect, it } from 'vitest';
import { buildSchemaFromMetadata } from '../../src/cli/generateSchema';

const sampleRows = [
  { table_schema: 'public', table_name: 'customers', column_name: 'id', data_type: 'integer' },
  { table_schema: 'public', table_name: 'customers', column_name: 'name', data_type: 'text' },
  { table_schema: 'sales', table_name: 'customers', column_name: 'region', data_type: 'text' },
];

describe('Postgres schema builder', () => {
  it('maps metadata rows to schema entries keyed by schema.table', () => {
    const schema = buildSchemaFromMetadata(sampleRows);
    expect(Object.keys(schema)).toEqual(['public.customers', 'sales.customers']);
    expect(schema['public.customers'].columns).toMatchObject({ id: 'integer', name: 'text' });
    expect(schema['sales.customers'].columns).toMatchObject({ region: 'text' });
  });

  it('filters tables when provided with schema-qualified or bare names', () => {
    const filtered = buildSchemaFromMetadata(sampleRows, ['public.customers']);
    expect(Object.keys(filtered)).toEqual(['public.customers']);

    const tableFiltered = buildSchemaFromMetadata(sampleRows, ['customers']);
    expect(Object.keys(tableFiltered)).toEqual(['public.customers', 'sales.customers']);
  });
});
