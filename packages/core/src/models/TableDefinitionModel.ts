import type { ColumnDefinition, SchemaRegistry } from '../utils/SchemaManager';
import { RawString, TypeValue } from './ValueComponent';
import type { ValueComponent } from './ValueComponent';
import type {
    ColumnConstraintKind,
    CreateTableQuery,
    TableColumnDefinition as CreateTableColumnDefinition
} from './CreateTableQuery';

/**
 * Column metadata that augments the SchemaManager definition with
 * type, nullability, and default information for insert simulation.
 */
export interface TableColumnDefinitionModel extends ColumnDefinition {
    /** SQL type that should be used when casting inserted values. */
    typeName?: string;
    /** Whether a value is required in the INSERT statement (NOT NULL without default). */
    required?: boolean;
    /** Expression text or AST from DDL that represents the column default, if any. */
    defaultValue?: string | ValueComponent | null;
}

/**
 * A description of a table that is rich enough to drive insert simulation.
 */
export interface TableDefinitionModel {
    /** The actual name of the table (including schema if provided). */
    name: string;
    /** Columns in the order they are defined in the table. */
    columns: TableColumnDefinitionModel[];
}

/** Registry keyed by table name (case-sensitive as provided by the caller). */
export type TableDefinitionRegistry = Record<string, TableDefinitionModel>;

/**
 * Helper to reformat a SchemaManager registry into the format consumed
 * by the insert-to-select transformer.
 */
export function createTableDefinitionRegistryFromSchema(schema: SchemaRegistry): TableDefinitionRegistry {
    const registry: TableDefinitionRegistry = {};

    for (const table of Object.values(schema)) {
        registry[table.name] = {
            name: table.name,
            columns: Object.entries(table.columns).map(([columnName, column]) => ({
                ...column,
                name: columnName
            }))
        };
    }

    return registry;
}

const NOT_NULL_KINDS: ReadonlySet<ColumnConstraintKind> = new Set(['not-null', 'primary-key']);
const IDENTITY_KINDS: ReadonlySet<ColumnConstraintKind> = new Set([
    'generated-always-identity',
    'generated-by-default-identity'
]);

function buildTableName(query: CreateTableQuery): string {
    const prefixes = query.namespaces ?? [];
    if (prefixes.length === 0) {
        return query.tableName.name;
    }

    // Preserve schema qualifiers so INSERT references align with qualified DDL targets.
    return `${prefixes.join('.')}.${query.tableName.name}`;
}

function getColumnTypeName(column: CreateTableColumnDefinition): string | undefined {
    const dataType = column.dataType;
    if (!dataType) {
        return undefined;
    }

    if (dataType instanceof TypeValue) {
        return dataType.getTypeName();
    }

    if (dataType instanceof RawString) {
        return dataType.value;
    }

    return undefined;
}

function adaptColumn(column: CreateTableColumnDefinition): TableColumnDefinitionModel {
    const defaultConstraint = column.constraints.find((constraint) => constraint.kind === 'default');
    const hasDefault = Boolean(defaultConstraint);
    const hasIdentity = column.constraints.some((constraint) => IDENTITY_KINDS.has(constraint.kind));
    const hasNotNull = column.constraints.some((constraint) => NOT_NULL_KINDS.has(constraint.kind));

    // Required columns must be NOT NULL/PRIMARY KEY and lack any automatic value coverage.
    const required = hasNotNull && !hasDefault && !hasIdentity;

    return {
        name: column.name.name,
        typeName: getColumnTypeName(column),
        required,
        defaultValue: defaultConstraint?.defaultValue ?? null
    };
}

/**
 * Convert a parsed CREATE TABLE query into the table definition model used by transformers.
 */
export function createTableDefinitionFromCreateTableQuery(query: CreateTableQuery): TableDefinitionModel {
    const qualifiedName = buildTableName(query);
    const columns = query.columns.map((column) => adaptColumn(column));
    return { name: qualifiedName, columns };
}

/**
 * Build a registry of table definitions from a batch of CREATE TABLE AST results.
 */
export function createTableDefinitionRegistryFromCreateTableQueries(
    queries: CreateTableQuery[]
): TableDefinitionRegistry {
    const registry: TableDefinitionRegistry = {};
    for (const query of queries) {
        const definition = createTableDefinitionFromCreateTableQuery(query);
        registry[definition.name] = definition;
    }
    return registry;
}
