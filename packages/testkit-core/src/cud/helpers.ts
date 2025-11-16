import {
  CastExpression,
  ColumnReference,
  InsertQuery,
  LiteralValue,
  ParameterExpression,
  RawString,
  SelectQuery,
  SimpleSelectQuery,
  TupleExpression,
  TypeValue,
  ValueComponent,
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
  | { kind: 'RuntimeDtoWithoutFrom'; column: string; message: string }
  | { kind: 'NullOnNotNullColumn'; column: string; message: string }
  | { kind: 'DbTypeError'; column: string; message: string };

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
  const issues: CudValidationIssue[] = [];

  // DTO selects without a FROM clause need runtime enforcement before execution.
  if (!select.fromClause) {
    issues.push({
      kind: 'RuntimeDtoWithoutFrom',
      column: table.tableName,
      message: `DTO select for "${table.tableName}" lacks a FROM clause`,
    });

    const columnLookup = buildColumnLookup(table);

    // Check each projected column for null violations or CAST mismatches.
    select.selectClause.items.forEach((item, index) => {
      const columnName = deriveSelectItemName(index, item);
      const columnDef = columnLookup[columnName.toLowerCase()];
      if (!columnDef) {
        return;
      }

      const valueUnderCast = item.value instanceof CastExpression ? item.value.input : item.value;

      // Detect NULL literals or parameter entries hitting NOT NULL targets.
      if (!columnDef.nullable && isNullExpression(valueUnderCast)) {
        issues.push({
          kind: 'NullOnNotNullColumn',
          column: columnDef.name,
          message: `Column "${columnDef.name}" cannot receive NULL in DTO select for "${table.tableName}"`,
        });
      }

      // Ensure the CAST target matches the declared column type.
      if (item.value instanceof CastExpression) {
        const castTarget = item.value.castType.getTypeName().toLowerCase();
        if (castTarget !== columnDef.dbType.toLowerCase()) {
          issues.push({
            kind: 'DbTypeError',
            column: columnDef.name,
            message: `DTO select for "${table.tableName}" casts "${columnDef.name}" to ${castTarget} instead of ${columnDef.dbType}`,
          });
        }
      }
    });
  }

  return issues;
};

const isNullExpression = (value: ValueComponent): boolean =>
  (value instanceof LiteralValue && value.value === null) ||
  (value instanceof ParameterExpression && value.value === null) ||
  (value instanceof RawString && value.value.toLowerCase() === 'null');

const evaluateValueExpression = (value: ValueComponent, params?: unknown[]): unknown => {
  // Unwrap CAST wrappers before evaluating the underlying literal or parameter.
  if (value instanceof CastExpression) {
    return evaluateValueExpression(value.input, params);
  }

  // Literal constants are used as-is.
  if (value instanceof LiteralValue) {
    return value.value;
  }

  // Parameter expressions resolve against the positional parameter list.
  if (value instanceof ParameterExpression) {
    return resolveParameterValue(value, params);
  }

  // Raw strings cover simple tokens such as NULL/TRUE/FALSE or raw SQL fragments.
  if (value instanceof RawString) {
    const normalized = value.value.trim().toLowerCase();
    if (normalized === 'null') {
      return null;
    }
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
    return value.value;
  }

  throw new Error(
    `Unsupported DTO value expression "${value.constructor.name}" for CUD simulation`,
  );
};

const resolveParameterValue = (parameter: ParameterExpression, params?: unknown[]): unknown => {
  // Use any value already attached to the AST before falling back to positional arguments.
  if (parameter.value !== undefined) {
    return parameter.value;
  }

  // Positional values must be supplied by the calling code to resolve $n placeholders.
  if (!params || params.length === 0) {
    throw new Error(
      'Parameterized INSERT statements require positional values to simulate RETURNING rows',
    );
  }

  const placeholder = parameter.name.value;
  // Detect numeric placeholders (e.g. $1) and map them to the provided array.
  const digits = placeholder.match(/\d+/);
  if (digits) {
    const index = Number(digits[0]) - 1;
    if (index < 0 || index >= params.length) {
      throw new Error(`Parameter ${placeholder} refers to missing value`);
    }
    return params[index];
  }

  throw new Error(`Cannot resolve parameter placeholder "${placeholder}" for CUD simulation`);
};

const deriveColumnNames = (select: SimpleSelectQuery): string[] =>
  select.selectClause.items.map((item, index) => deriveSelectItemName(index, item));

export const extractDtoRowsFromSelect = (
  select: SimpleSelectQuery,
  params?: unknown[],
): Record<string, unknown>[] | null => {
  const columnNames = deriveColumnNames(select);
  if (!select.fromClause) {
    const row: Record<string, unknown> = {};

    // Evaluate each select item when the DTO select emits literals or parameters directly.
    columnNames.forEach((name, index) => {
      const value = select.selectClause.items[index].value;
      row[name] = evaluateValueExpression(value, params);
    });

    return [row];
  }

  // Detect the VALUES subquery by looking for a datasource that exposes a `.query`.
  const datasource = select.fromClause.source.datasource as { query?: SelectQuery } | null;
  const valuesQuery =
    datasource && datasource.query instanceof ValuesQuery ? datasource.query : null;
  if (valuesQuery) {

    // Use column aliases derived from the select clause order to stay synchronized with DTO output.
    return valuesQuery.tuples.map((tuple, tupleIndex) => {
      if (tuple.values.length !== columnNames.length) {
        throw new Error(
          `Tuple at index ${tupleIndex} has ${tuple.values.length} values but ${columnNames.length} columns are expected`,
        );
      }

      const row: Record<string, unknown> = {};

      // Map each tuple entry to its column name after evaluating expressions.
      tuple.values.forEach((value, valueIndex) => {
        const target = columnNames[valueIndex];
        row[target] = evaluateValueExpression(value, params);
      });

      return row;
    });
  }

  return null;
};
