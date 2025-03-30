import { SelectQuery } from "./SelectQuery";
import { SqlComponent } from "./SqlComponent";
import { IdentifierString, RawString, ValueComponent } from "./ValueComponent";

export type SelectComponent = SelectItem | ValueComponent;

export class SelectItem extends SqlComponent {
    static kind = Symbol("SelectItem");
    value: ValueComponent;
    alias: IdentifierString | null;
    constructor(value: ValueComponent, alias: string | null) {
        super();
        this.value = value;
        this.alias = alias !== null ? new IdentifierString(alias) : null;
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

export type PartitionByComponent = PartitionByItem | PartitionByList;

export class PartitionByItem extends SqlComponent {
    static kind = Symbol("PartitionByItem");
    value: ValueComponent;
    constructor(value: ValueComponent) {
        super();
        this.value = value;
    }
}

export class PartitionByList extends SqlComponent {
    static kind = Symbol("PartitionByList");
    items: PartitionByItem[];
    constructor(items: PartitionByItem[]) {
        super();
        this.items = items;
    }
}

export class WindowFrameClause extends SqlComponent {
    static kind = Symbol("WindowFrameClause");
    alias: IdentifierString;
    partitionBy: PartitionByClause | null;
    orderBy: OrderByClause | null;
    constructor(alias: string, partitionBy: PartitionByClause | null, orderBy: OrderByClause | null) {
        super();
        this.alias = new IdentifierString(alias);
        this.partitionBy = partitionBy;
        this.orderBy = orderBy;
    }
}

export class OverClause extends SqlComponent {
    static kind = Symbol("OverClause");
    partitionByClause: PartitionByClause | null;
    orderByClause: OrderByClause | null;
    windowFrameAlias: IdentifierString | null;
    constructor(partitionByClause: PartitionByClause | null, orderByClause: OrderByClause | null, windowFrameAlias: string | null) {
        super();
        this.partitionByClause = partitionByClause;
        this.orderByClause = orderByClause;
        this.windowFrameAlias = windowFrameAlias !== null ? new IdentifierString(windowFrameAlias) : null;
    }
}

export class PartitionByClause extends SqlComponent {
    static kind = Symbol("PartitionByClause");
    partitionBy: PartitionByComponent;
    constructor(partitionBy: PartitionByComponent) {
        super();
        this.partitionBy = partitionBy;
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
    orderBy: OrderByComponent[];
    constructor(items: OrderByComponent[]) {
        super();
        this.orderBy = items;
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
    CommonTableSource |
    ParenSource;

export class CommonTableSource extends SqlComponent {
    static kind = Symbol("CommonTableSource");
    name: IdentifierString;
    constructor(name: string) {
        super();
        this.name = new IdentifierString(name);
    }
}

export class TableSource extends SqlComponent {
    static kind = Symbol("TableSource");
    namespaces: IdentifierString[] | null;
    table: IdentifierString;
    name: IdentifierString;
    constructor(namespaces: string[] | null, table: string) {
        super();
        this.namespaces = namespaces !== null ? namespaces.map((namespace) => new IdentifierString(namespace)) : null;;
        this.table = new IdentifierString(table);
        this.name = this.table;
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
    alias: SourceAliasExpression | null;
    constructor(datasource: SourceComponent, alias: SourceAliasExpression | null) {
        super();
        this.datasource = datasource;
        this.alias = alias;
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
}

export class CommonTable extends SqlComponent {
    static kind = Symbol("CommonTable");
    query: SelectQuery;
    materialized: boolean | null;
    alias: SourceAliasExpression;
    constructor(query: SelectQuery, alias: SourceAliasExpression | string, materialized: boolean | null) {
        super();
        this.query = query;
        this.materialized = materialized;
        if (typeof alias === "string") {
            this.alias = new SourceAliasExpression(alias, null);
        } else {
            this.alias = alias;
        }
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

export class LimitOffset extends SqlComponent {
    static kind = Symbol("LimitOffset");
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
    constructor(lockMode: LockModeFor
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
