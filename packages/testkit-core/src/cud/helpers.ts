import {
  CastExpression,
  ColumnReference,
  InsertQuery,
  SimpleSelectQuery,
  TypeValue,
  ValuesQuery,
} from 'rawsql-ts';
import { QueryBuilder } from 'rawsql-ts';

export interface ColumnDef {
  name: string;
  dbType: string;
  nullable?: boolean;
  hasDefault?: boolean;
}

export interface TableDef {
  tableName: string;
  columns: ColumnDef[];
}

export type CudValidationIssue =
  | { kind: 'MissingColumn'; column: string; message: string }
  | { kind: 'ExtraColumn'; column: string; message: string }
  | { kind: 'RequiredColumnMissing'; column: string; message: string }
  | { kind: 'RuntimeDtoWithoutFrom'; column: string; message: string };

const buildColumnLookup = (table: TableDef): Record<string, ColumnDef> => {
  const lookup: Record<string, ColumnDef> = {};
  for (const column of table.columns) {
    lookup[column.name.toLowerCase()] = column;
  }
  return lookup;
};

const getInsertColumnNames = (insert: InsertQuery): string[] => {
  const explicit = insert.insertClause.columns;
  if (!explicit || explicit.length === 0) {
    throw new Error('INSERT statements must declare target columns to normalize VALUES to SELECT');
  }

  return explicit.map((identifier) => identifier.name);
};

const deriveSelectItemName = (index: number, item: SimpleSelectQuery['selectClause']['items'][number]): string => {
  if (item.identifier) {
    return item.identifier.name;
  }
  if (item.value instanceof ColumnReference) {
    return item.value.column.name;
  }
  return `column${index + 1}`;
};

export const normalizeInsertValuesToSelect = (insert: InsertQuery): InsertQuery => {
  const values = insert.selectQuery;
  if (!values || !(values instanceof ValuesQuery)) {
    return insert;
  }

  const columnNames = getInsertColumnNames(insert);

  // Provide column aliases before converting to a SimpleSelectQuery so the column order survives.
  values.columnAliases = columnNames;
  const normalized = QueryBuilder.buildSimpleQuery(values);
  insert.selectQuery = normalized;
  return insert;
};

export const applyTypeCastsToSelect = (select: SimpleSelectQuery, table: TableDef): SimpleSelectQuery => {
  const columnLookup = buildColumnLookup(table);

  // Wrap each SELECT item with a CAST targeted to the table metadata.
  select.selectClause.items.forEach((item, index) => {
    const columnName = deriveSelectItemName(index, item).toLowerCase();
    const columnDef = columnLookup[columnName];
    if (!columnDef) {
      throw new Error(`Column "${columnName}" is not defined in table "${table.tableName}"`);
    }

    const castTarget = columnDef.dbType;
    if (item.value instanceof CastExpression && item.value.castType instanceof TypeValue) {
      item.value = new CastExpression(
        item.value.input,
        new TypeValue(item.value.castType.namespaces, castTarget),
      );
      return;
    }

    item.value = new CastExpression(item.value, new TypeValue(null, castTarget));
  });

  return select;
};

export const validateInsertShape = (insert: InsertQuery, table: TableDef): CudValidationIssue[] => {
  const issues: CudValidationIssue[] = [];
  const columnLookup = buildColumnLookup(table);
  const insertColumns = getInsertColumnNames(insert);
  const normalized = insertColumns.map((column) => column.toLowerCase());
  const seen = new Set<string>();

  // Detect columns supplied in the INSERT that are not part of the table definition.
  for (const column of insertColumns) {
    const lower = column.toLowerCase();
    seen.add(lower);
    if (!columnLookup[lower]) {
      issues.push({
        kind: 'ExtraColumn',
        column,
        message: `Column "${column}" is not defined on table "${table.tableName}"`,
      });
    }
  }

  for (const column of table.columns) {
    // Report required columns that were left out and lack defaults.
    const lower = column.name.toLowerCase();
    if (!seen.has(lower) && !column.nullable && !column.hasDefault) {
      issues.push({
        kind: 'RequiredColumnMissing',
        column: column.name,
        message: `Column "${column.name}" is required but was not provided`,
      });
    }
  }

  return issues;
};

export const validateDtoSelectRuntime = (select: SimpleSelectQuery, table: TableDef): CudValidationIssue[] => {
  // DTO selects without a FROM clause require runtime validation to guarantee shape.
  if (!select.fromClause) {
    return [
      {
        kind: 'RuntimeDtoWithoutFrom',
        column: table.tableName,
        message: `DTO select for "${table.tableName}" lacks a FROM clause`,
      },
    ];
  }

  return [];
};
