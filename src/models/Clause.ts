import { SelectQuery, SimpleSelectQuery } from "./SelectQuery";
import { SqlComponent } from "./SqlComponent";
import { IdentifierString, RawString, TupleExpression, ValueComponent, WindowFrameExpression } from "./ValueComponent";

export type SelectComponent = SelectItem | ValueComponent;

export class SelectItem extends SqlComponent {
    static kind = Symbol("SelectItem");
    value: ValueComponent;
    identifier: IdentifierString;
    constructor(value: ValueComponent, name: string) {
        super();
        this.value = value;
        this.identifier = new IdentifierString(name);
    }
}

export class SelectClause extends SqlComponent {
    static kind = Symbol("SelectClause");
    items: SelectComponent[];
    distinct: DistinctComponent | null;
    constructor(items: SelectComponent[], distinct: DistinctComponent | null = null) {
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
    constructor(namespaces: string[] | null, table: string) {
        super();
        this.namespaces = namespaces !== null ? namespaces.map((namespace) => new IdentifierString(namespace)) : null;;
        this.table = new IdentifierString(table);
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
    public getAliasSourceName(): string | null {
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
    public getAliasSourceName(): string | null {
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
    public getAliasSourceName(): string {
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

//export type RowLimitComponent = LimitOffset | FetchSpecification;

export class LimitClause extends SqlComponent {
    static kind = Symbol("LimitClause");
    limit: ValueComponent;
    offset: ValueComponent | null;
    constructor(limit: ValueComponent, offset: ValueComponent | null) {
        super();
        this.limit = limit;
        this.offset = offset;
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

export class FetchSpecification extends SqlComponent {
    static kind = Symbol("FetchSpecification");
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
