import { SelectQuery, SimpleSelectQuery } from "./SelectQuery";
import { SqlComponent } from "./SqlComponent";
import { IdentifierString, RawString, TupleExpression, ValueComponent, WindowFrameExpression } from "./ValueComponent";

export class SelectItem extends SqlComponent {
    static kind = Symbol("SelectItem");
    value: ValueComponent;
    identifier: IdentifierString | null;
    constructor(value: ValueComponent, name: string | null = null) {
        super();
        this.value = value;
        this.identifier = name ? new IdentifierString(name) : null;
    }
}

export class SelectClause extends SqlComponent {
    static kind = Symbol("SelectClause");
    items: SelectItem[];
    distinct: DistinctComponent | null;
    constructor(items: SelectItem[], distinct: DistinctComponent | null = null) {
        super();
        this.items = items;
        this.distinct = distinct;
    }
}

export type DistinctComponent = Distinct | DistinctOn;

export class Distinct extends SqlComponent {
    static kind = Symbol("Distinct");
    constructor() {
        super();
    }
}

export class DistinctOn extends SqlComponent {
    static kind = Symbol("DistinctOn");
    value: ValueComponent;
    constructor(value: ValueComponent) {
        super();
        this.value = value;
    }
}


export class WhereClause extends SqlComponent {
    static kind = Symbol("WhereClause");
    condition: ValueComponent;
    constructor(condition: ValueComponent) {
        super();
        this.condition = condition;
    }
}

export class PartitionByClause extends SqlComponent {
    static kind = Symbol("PartitionByClause");
    value: ValueComponent;
    constructor(value: ValueComponent) {
        super();
        this.value = value;
    }
}

export class WindowFrameClause extends SqlComponent {
    static kind = Symbol("WindowFrameClause");
    name: IdentifierString;
    expression: WindowFrameExpression;
    constructor(name: string, expression: WindowFrameExpression) {
        super();
        this.name = new IdentifierString(name);
        this.expression = expression;
    }
}

/**
 * Represents a collection of window definitions (WINDOW clause in SQL).
 * @param windows Array of WindowFrameClause
 */
export class WindowsClause extends SqlComponent {
    static kind = Symbol("WindowsClause");
    windows: WindowFrameClause[];
    constructor(windows: WindowFrameClause[]) {
        super();
        this.windows = windows;
    }
}

export enum SortDirection {
    Ascending = "asc",
    Descending = "desc",
}
export enum NullsSortDirection {
    First = "first",
    Last = "last",
}

export type OrderByComponent = OrderByItem | ValueComponent;

export class OrderByClause extends SqlComponent {
    static kind = Symbol("OrderByClause");
    order: OrderByComponent[];
    constructor(items: OrderByComponent[]) {
        super();
        this.order = items;
    }
}

export class OrderByItem extends SqlComponent {
    static kind = Symbol("OrderByItem");
    value: ValueComponent;
    sortDirection: SortDirection;
    nullsPosition: NullsSortDirection | null;
    constructor(expression: ValueComponent, sortDirection: SortDirection | null, nullsPosition: NullsSortDirection | null) {
        super();
        this.value = expression;
        this.sortDirection = sortDirection === null ? SortDirection.Ascending : sortDirection;
        this.nullsPosition = nullsPosition;
    }
}

export class GroupByClause extends SqlComponent {
    static kind = Symbol("GroupByClause");
    grouping: ValueComponent[];
    constructor(expression: ValueComponent[]) {
        super();
        this.grouping = expression;
    }
}

export class HavingClause extends SqlComponent {
    static kind = Symbol("HavingClause");
    condition: ValueComponent;
    constructor(condition: ValueComponent) {
        super();
        this.condition = condition;
    }
}

export type SourceComponent = TableSource |
    FunctionSource |
    SubQuerySource |
    ParenSource;

export class TableSource extends SqlComponent {
    static kind = Symbol("TableSource");
    namespaces: IdentifierString[] | null;
    table: IdentifierString;
    identifier: IdentifierString;
    constructor(namespaces: string[] | IdentifierString[] | null, table: string | IdentifierString) {
        super();
        // Accept both string[] and IdentifierString[] for namespaces
        if (namespaces === null) {
            this.namespaces = null;
        } else if (typeof namespaces[0] === "string") {
            this.namespaces = (namespaces as string[]).map(ns => new IdentifierString(ns));
        } else {
            this.namespaces = namespaces as IdentifierString[];
        }
        // Accept both string and IdentifierString for table
        this.table = typeof table === "string" ? new IdentifierString(table) : table;
        this.identifier = this.table;
    }
    public getSourceName(): string {
        if (this.namespaces) {
            return this.namespaces.map((namespace) => namespace.name).join(".") + "." + this.table.name;
        } else {
            return this.table.name;
        }
    }
}

export class FunctionSource extends SqlComponent {
    static kind = Symbol("FunctionSource");
    name: RawString;
    argument: ValueComponent | null;
    constructor(functionName: string, argument: ValueComponent | null) {
        super();
        this.name = new RawString(functionName);
        this.argument = argument;
    }
}

export class ParenSource extends SqlComponent {
    static kind = Symbol("ParenSource");
    source: SourceComponent;
    constructor(source: SourceComponent) {
        super();
        this.source = source;
    }
}

export class SubQuerySource extends SqlComponent {
    static kind = Symbol("SubQuerySource");
    query: SelectQuery;
    constructor(query: SelectQuery) {
        super();
        this.query = query;
    }
}

export class SourceExpression extends SqlComponent {
    static kind = Symbol("SourceExpression");
    datasource: SourceComponent;
    aliasExpression: SourceAliasExpression | null;
    constructor(datasource: SourceComponent, aliasExpression: SourceAliasExpression | null) {
        super();
        this.datasource = datasource;
        this.aliasExpression = aliasExpression;
    }
    public getAliasName(): string | null {
        if (this.aliasExpression) {
            return this.aliasExpression.table.name;
        }
        else if (this.datasource instanceof TableSource) {
            return this.datasource.getSourceName();
        }
        return null;
    }
}

export type JoinConditionComponent = JoinOnClause | JoinUsingClause;

export class JoinOnClause extends SqlComponent {
    static kind = Symbol("JoinOnClause");
    condition: ValueComponent;
    constructor(condition: ValueComponent) {
        super();
        this.condition = condition;
    }
}

export class JoinUsingClause extends SqlComponent {
    static kind = Symbol("JoinUsingClause");
    condition: ValueComponent;
    constructor(condition: ValueComponent) {
        super();
        this.condition = condition;
    }
}

export class JoinClause extends SqlComponent {
    static kind = Symbol("JoinItem");
    joinType: RawString;
    source: SourceExpression;
    condition: JoinConditionComponent | null;
    lateral: boolean;
    constructor(joinType: string, source: SourceExpression, condition: JoinConditionComponent | null, lateral: boolean) {
        super();
        this.joinType = new RawString(joinType);
        this.source = source;
        this.condition = condition;
        this.lateral = lateral;
    }
    public getSourceAliasName(): string | null {
        if (this.source.aliasExpression) {
            return this.source.aliasExpression.table.name;
        }
        else if (this.source instanceof TableSource) {
            return this.source.table.name;
        }
        return null;
    }
}

export class FromClause extends SqlComponent {
    static kind = Symbol("FromClause");
    source: SourceExpression;
    joins: JoinClause[] | null;
    constructor(source: SourceExpression, join: JoinClause[] | null) {
        super();
        this.source = source;
        this.joins = join;
    }
    public getSourceAliasName(): string | null {
        if (this.source.aliasExpression) {
            return this.source.aliasExpression.table.name;
        }
        else if (this.source.datasource instanceof TableSource) {
            return this.source.datasource.table.name;
        }
        return null;
    }
    /**
     * Returns all SourceExpression objects in this FROM clause, including main source and all JOIN sources.
     */
    public getSources(): SourceExpression[] {
        const sources: SourceExpression[] = [this.source];
        if (this.joins) {
            for (const join of this.joins) {
                sources.push(join.source);
            }
        }
        return sources;
    }
}

export class CommonTable extends SqlComponent {
    static kind = Symbol("CommonTable");
    query: SelectQuery;
    materialized: boolean | null;
    aliasExpression: SourceAliasExpression;
    constructor(query: SelectQuery, aliasExpression: SourceAliasExpression | string, materialized: boolean | null) {
        super();
        this.query = query;
        this.materialized = materialized;
        if (typeof aliasExpression === "string") {
            this.aliasExpression = new SourceAliasExpression(aliasExpression, null);
        } else {
            this.aliasExpression = aliasExpression;
        }
    }
    public getSourceAliasName(): string {
        return this.aliasExpression.table.name;
    }
}

export class WithClause extends SqlComponent {
    static kind = Symbol("WithClause");
    recursive: boolean;
    tables: CommonTable[];
    constructor(recursive: boolean, tables: CommonTable[]) {
        super();
        this.recursive = recursive;
        this.tables = tables;
    }
}

export class LimitClause extends SqlComponent {
    static kind = Symbol("LimitClause");
    value: ValueComponent;
    constructor(limit: ValueComponent) {
        super();
        this.value = limit;
    }
}

export enum FetchType {
    Next = "next",
    First = "first",
}

export enum FetchUnit {
    RowsOnly = "rows only",
    Percent = "percent",
    PercentWithTies = "percent with ties",
}


export class OffsetClause extends SqlComponent {
    static kind = Symbol("OffsetClause");
    value: ValueComponent;
    constructor(value: ValueComponent) {
        super();
        this.value = value;
    }
}

export class FetchClause extends SqlComponent {
    static kind = Symbol("FetchClause");
    expression: FetchExpression;
    constructor(expression: FetchExpression) {
        super();
        this.expression = expression;
    }
}

export class FetchExpression extends SqlComponent {
    static kind = Symbol("FetchExpression");
    type: FetchType;
    count: ValueComponent;
    unit: FetchUnit | null;
    constructor(type: FetchType, count: ValueComponent, unit: FetchUnit | null) {
        super();
        this.type = type;
        this.count = count;
        this.unit = unit;
    }
}

export enum LockMode {
    Update = "update",
    Share = "share",
    KeyShare = "key share",
    NokeyUpdate = "no key update",
}

export class ForClause extends SqlComponent {
    static kind = Symbol("ForClause");
    lockMode: LockMode;
    constructor(lockMode: LockMode) {
        super();
        this.lockMode = lockMode;
    }
}

export class SourceAliasExpression extends SqlComponent {
    static kind = Symbol("SourceAliasExpression");
    table: IdentifierString;
    columns: IdentifierString[] | null;
    constructor(alias: string, columnAlias: string[] | null) {
        super();
        this.table = new IdentifierString(alias);
        this.columns = columnAlias !== null ? columnAlias.map((alias) => new IdentifierString(alias)) : null;
    }
}

export class ReturningClause extends SqlComponent {
    static kind = Symbol("ReturningClause");
    columns: IdentifierString[];
    /**
     * Constructs a ReturningClause.
     * @param columns Array of IdentifierString or string representing column names.
     */
    constructor(columns: (IdentifierString | string)[]) {
        super();
        this.columns = columns.map(col => typeof col === "string" ? new IdentifierString(col) : col);
    }
}


export class SetClause extends SqlComponent {
    static kind = Symbol("SetClause");
    items: SetClauseItem[];
    constructor(items: (SetClauseItem | { column: string | IdentifierString, value: ValueComponent })[]) {
        super();
        this.items = items.map(item => item instanceof SetClauseItem ? item : new SetClauseItem(item.column, item.value));
    }
}

/**
 * Represents a single SET clause item in an UPDATE statement.
 */
/**
 * Represents a single SET clause item in an UPDATE statement.
 * Now supports namespaces for fully qualified column names (e.g. schema.table.column).
 */
export class SetClauseItem extends SqlComponent {
    static kind = Symbol("SetClauseItem");
    namespaces: IdentifierString[] | null;
    column: IdentifierString;
    value: ValueComponent;
    constructor(
        column: string | IdentifierString | { namespaces: string[] | IdentifierString[] | null, column: string | IdentifierString },
        value: ValueComponent
    ) {
        super();
        if (typeof column === "object" && column !== null && "column" in column) {
            // Accepts { namespaces, column }
            const colObj = column as { namespaces: string[] | IdentifierString[] | null, column: string | IdentifierString };
            if (colObj.namespaces == null) {
                this.namespaces = null;
            } else if (typeof colObj.namespaces[0] === "string") {
                this.namespaces = (colObj.namespaces as string[]).map(ns => new IdentifierString(ns));
            } else {
                this.namespaces = colObj.namespaces as IdentifierString[];
            }
            this.column = typeof colObj.column === "string" ? new IdentifierString(colObj.column) : colObj.column;
        } else {
            this.namespaces = null;
            this.column = typeof column === "string" ? new IdentifierString(column) : column as IdentifierString;
        }
        this.value = value;
    }
    /**
     * Returns the fully qualified column name as a string.
     */
    public getFullName(): string {
        if (this.namespaces && this.namespaces.length > 0) {
            return this.namespaces.map(ns => ns.name).join(".") + "." + this.column.name;
        } else {
            return this.column.name;
        }
    }
}

export class UpdateClause extends SqlComponent {
    static kind = Symbol("UpdateClause");
    source: SourceExpression;
    constructor(source: SourceExpression) {
        super();
        this.source = source;
    }
    public getSourceAliasName() {
        if (this.source.aliasExpression) {
            return this.source.aliasExpression.table.name;
        }
        else if (this.source.datasource instanceof TableSource) {
            return this.source.datasource.table.name;
        }
        return null;
    }
}

/**
 * Represents the target table (with optional alias/schema) and columns for an INSERT statement.
 * @param source The target table as a SourceExpression (can include schema, alias, etc.)
 * @param columns Array of column names (as strings)
 */
export class InsertClause extends SqlComponent {
    source: SourceExpression;
    columns: string[];

    constructor(source: SourceExpression, columns: string[]) {
        super();
        this.source = source;
        this.columns = columns;
    }
}