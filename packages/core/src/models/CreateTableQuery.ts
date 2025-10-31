import { SqlComponent } from "./SqlComponent";
import type { SelectQuery } from "./SelectQuery";
import {
    ColumnReference,
    FunctionCall,
    IdentifierString,
    RawString,
    ValueComponent,
    TypeValue,
    QualifiedName
} from "./ValueComponent";
import { SimpleSelectQuery } from "./SimpleSelectQuery";
import { SelectClause, SelectItem, FromClause, TableSource, SourceExpression } from "./Clause";
import { SelectValueCollector } from "../transformers/SelectValueCollector";

export type ReferentialAction = 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default';
export type ConstraintDeferrability = 'deferrable' | 'not deferrable' | null;
export type ConstraintInitially = 'immediate' | 'deferred' | null;
export type MatchType = 'full' | 'partial' | 'simple' | null;

/**
 * Represents a REFERENCES clause definition that can be shared between column and table constraints.
 */
export class ReferenceDefinition extends SqlComponent {
    static kind = Symbol("ReferenceDefinition");
    targetTable: QualifiedName;
    columns: IdentifierString[] | null;
    matchType: MatchType;
    onDelete: ReferentialAction | null;
    onUpdate: ReferentialAction | null;
    deferrable: ConstraintDeferrability;
    initially: ConstraintInitially;

    constructor(params: {
        targetTable: QualifiedName;
        columns?: IdentifierString[] | null;
        matchType?: MatchType;
        onDelete?: ReferentialAction | null;
        onUpdate?: ReferentialAction | null;
        deferrable?: ConstraintDeferrability;
        initially?: ConstraintInitially;
    }) {
        super();
        this.targetTable = params.targetTable;
        this.columns = params.columns ? [...params.columns] : null;
        this.matchType = params.matchType ?? null;
        this.onDelete = params.onDelete ?? null;
        this.onUpdate = params.onUpdate ?? null;
        this.deferrable = params.deferrable ?? null;
        this.initially = params.initially ?? null;
    }
}

export type ColumnConstraintKind =
    | 'not-null'
    | 'null'
    | 'default'
    | 'primary-key'
    | 'unique'
    | 'references'
    | 'check'
    | 'generated-always-identity'
    | 'generated-by-default-identity'
    | 'raw';

/**
 * Column-level constraint definition.
 */
export class ColumnConstraintDefinition extends SqlComponent {
    static kind = Symbol("ColumnConstraintDefinition");
    kind: ColumnConstraintKind;
    constraintName?: IdentifierString;
    defaultValue?: ValueComponent;
    checkExpression?: ValueComponent;
    reference?: ReferenceDefinition;
    rawClause?: RawString;

    constructor(params: {
        kind: ColumnConstraintKind;
        constraintName?: IdentifierString;
        defaultValue?: ValueComponent;
        checkExpression?: ValueComponent;
        reference?: ReferenceDefinition;
        rawClause?: RawString;
    }) {
        super();
        this.kind = params.kind;
        this.constraintName = params.constraintName;
        this.defaultValue = params.defaultValue;
        this.checkExpression = params.checkExpression;
        this.reference = params.reference;
        this.rawClause = params.rawClause;
    }
}

export type TableConstraintKind = 'primary-key' | 'unique' | 'foreign-key' | 'check' | 'raw';

/**
 * Table-level constraint definition.
 */
export class TableConstraintDefinition extends SqlComponent {
    static kind = Symbol("TableConstraintDefinition");
    kind: TableConstraintKind;
    constraintName?: IdentifierString;
    columns: IdentifierString[] | null;
    reference?: ReferenceDefinition;
    checkExpression?: ValueComponent;
    rawClause?: RawString;
    deferrable: ConstraintDeferrability;
    initially: ConstraintInitially;

    constructor(params: {
        kind: TableConstraintKind;
        constraintName?: IdentifierString;
        columns?: IdentifierString[] | null;
        reference?: ReferenceDefinition;
        checkExpression?: ValueComponent;
        rawClause?: RawString;
        deferrable?: ConstraintDeferrability;
        initially?: ConstraintInitially;
    }) {
        super();
        this.kind = params.kind;
        this.constraintName = params.constraintName;
        this.columns = params.columns ? [...params.columns] : null;
        this.reference = params.reference;
        this.checkExpression = params.checkExpression;
        this.rawClause = params.rawClause;
        this.deferrable = params.deferrable ?? null;
        this.initially = params.initially ?? null;
    }
}

/**
 * Represents a single column definition within CREATE TABLE.
 */
export class TableColumnDefinition extends SqlComponent {
    static kind = Symbol("TableColumnDefinition");
    name: IdentifierString;
    dataType?: TypeValue | RawString;
    constraints: ColumnConstraintDefinition[];

    constructor(params: {
        name: IdentifierString;
        dataType?: TypeValue | RawString;
        constraints?: ColumnConstraintDefinition[];
    }) {
        super();
        this.name = params.name;
        this.dataType = params.dataType;
        this.constraints = params.constraints ? [...params.constraints] : [];
    }
}

// Represents a CREATE TABLE query model that supports column definitions and AS SELECT variants.
export class CreateTableQuery extends SqlComponent {
    static kind = Symbol("CreateTableQuery");
    tableName: IdentifierString;
    namespaces: string[] | null;
    isTemporary: boolean;
    ifNotExists: boolean;
    columns: TableColumnDefinition[];
    tableConstraints: TableConstraintDefinition[];
    tableOptions?: RawString | null;
    asSelectQuery?: SelectQuery;
    withDataOption: 'with-data' | 'with-no-data' | null;

    constructor(params: {
        tableName: string;
        namespaces?: string[] | null;
        isTemporary?: boolean;
        ifNotExists?: boolean;
        columns?: TableColumnDefinition[];
        tableConstraints?: TableConstraintDefinition[];
        tableOptions?: RawString | null;
        asSelectQuery?: SelectQuery;
        withDataOption?: 'with-data' | 'with-no-data' | null;
    }) {
        super();
        this.tableName = new IdentifierString(params.tableName);
        this.namespaces = params.namespaces ? [...params.namespaces] : null;
        this.isTemporary = params.isTemporary ?? false;
        this.ifNotExists = params.ifNotExists ?? false;
        this.columns = params.columns ? [...params.columns] : [];
        this.tableConstraints = params.tableConstraints ? [...params.tableConstraints] : [];
        this.tableOptions = params.tableOptions ?? null;
        this.asSelectQuery = params.asSelectQuery;
        this.withDataOption = params.withDataOption ?? null;
    }

    /**
     * Returns a SelectQuery that selects all columns from this table.
     */
    getSelectQuery(): SimpleSelectQuery {
        let selectItems: SelectItem[];

        // Prefer explicit AS SELECT query columns when present.
        if (this.asSelectQuery) {
            const collector = new SelectValueCollector();
            const values = collector.collect(this.asSelectQuery);
            selectItems = values.map(val => new SelectItem(val.value, val.name));
        } else if (this.columns.length > 0) {
            // Use defined column names when the table definition is DDL-based.
            selectItems = this.columns.map(column => new SelectItem(
                new ColumnReference(null, column.name),
                column.name.name
            ));
        } else {
            // Fallback to wild-card selection when no column metadata is available.
            selectItems = [new SelectItem(new RawString("*"))];
        }

        // Build a simple SELECT ... FROM table query.
        const qualifiedName = this.namespaces && this.namespaces.length > 0
            ? [...this.namespaces, this.tableName.name].join(".")
            : this.tableName.name;

        return new SimpleSelectQuery({
            selectClause: new SelectClause(selectItems),
            fromClause: new FromClause(
                new SourceExpression(
                    new TableSource(null, qualifiedName),
                    null
                ),
                null
            ),
        });
    }

    /**
     * Returns a SelectQuery that counts all rows in this table.
     */
    getCountQuery(): SimpleSelectQuery {
        const qualifiedName = this.namespaces && this.namespaces.length > 0
            ? [...this.namespaces, this.tableName.name].join(".")
            : this.tableName.name;

        return new SimpleSelectQuery({
            selectClause: new SelectClause([
                new SelectItem(new FunctionCall(null, "count", new ColumnReference(null, "*"), null))
            ]),
            fromClause: new FromClause(
                new SourceExpression(
                    new TableSource(null, qualifiedName),
                    null
                ),
                null
            ),
        });
    }
}
