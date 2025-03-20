import { SelectQuery } from "./SelectQuery";
import { SqlComponent } from "./SqlComponent";
import { IdentifierString, RawString, ValueComponent } from "./ValueComponent";

export type SelectComponent = SelectItem | SelectList;

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

export class SelectList extends SqlComponent {
    static kind = Symbol("SelectList");
    items: SelectItem[];
    constructor(items: SelectItem[]) {
        super();
        this.items = items;
    }
}

export class SelectClause extends SqlComponent {
    static kind = Symbol("SelectClause");
    select: SelectComponent;
    distinct: DistinctComponent | null;
    constructor(expression: SelectComponent, distinct: DistinctComponent | null = null) {
        super();
        this.select = expression;
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

export class OrderByClause extends SqlComponent {
    static kind = Symbol("OrderByClause");
    orderBy: OrderByComponent;
    constructor(expression: OrderByComponent) {
        super();
        this.orderBy = expression;
    }
}

export type OrderByComponent = OrderByItem | OrderByList;

export class OrderByItem extends SqlComponent {
    static kind = Symbol("OrderByItem");
    value: ValueComponent;
    sortDirection: SortDirection;
    nullsPosition: NullsSortDirection | null;
    constructor(expression: ValueComponent, sortDirection: SortDirection = SortDirection.Ascending, nullsPosition: NullsSortDirection | null) {
        super();
        this.value = expression;
        this.sortDirection = sortDirection;
        this.nullsPosition = nullsPosition;
    }
}

export class OrderByList extends SqlComponent {
    static kind = Symbol("OrderByList");
    items: OrderByItem[];
    constructor(items: OrderByItem[]) {
        super();
        this.items = items;
    }
}

export type GroupByComponent = GroupByItem | GroupByList | GroupingSet | Cube | Rollup;

export class Rollup extends SqlComponent {
    static kind = Symbol("Rollup");
    value: ValueComponent;
    constructor(value: ValueComponent) {
        super();
        this.value = value;
    }
}

export class Cube extends SqlComponent {
    static kind = Symbol("Cube");
    value: ValueComponent;
    constructor(value: ValueComponent) {
        super();
        this.value = value;
    }
}
export class GroupingSet extends SqlComponent {
    static kind = Symbol("GroupingSet");
    value: ValueComponent;
    constructor(value: ValueComponent) {
        super();
        this.value = value;
    }
}

export class GroupByItem extends SqlComponent {
    static kind = Symbol("GroupByItem");
    value: ValueComponent;
    constructor(value: ValueComponent) {
        super();
        this.value = value;
    }
}

export class GroupByList extends SqlComponent {
    static kind = Symbol("GroupByList");
    items: GroupByItem[];
    constructor(items: GroupByItem[]) {
        super();
        this.items = items;
    }
}

export class GroupByClause extends SqlComponent {
    static kind = Symbol("GroupByClause");
    grouping: GroupByComponent;
    constructor(expression: GroupByComponent) {
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
    CommonTableSource;

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
    constructor(namespaces: IdentifierString[] | null, table: string) {
        super();
        this.namespaces = namespaces;
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

export class SubQuerySource extends SqlComponent {
    static kind = Symbol("SubQuerySource");
    query: SelectQuery;
    name: IdentifierString | null = null;
    constructor(query: SelectQuery) {
        super();
        this.query = query;
    }
}

export class SourceExpression extends SqlComponent {
    static kind = Symbol("SourceExpression");
    datasource: SourceComponent;
    alias: IdentifierString | null;
    columnAlias: ColumnAliasComponent | null;
    constructor(datasource: SourceComponent, alias: string | null, columnAlias: ColumnAliasComponent | null) {
        super();
        this.datasource = datasource;
        this.alias = alias !== null ? new IdentifierString(alias) : null;
        this.columnAlias = columnAlias;
    }
}

export type JoinComponent = JoinItem | JoinList;

export class JoinItem extends SqlComponent {
    static kind = Symbol("JoinItem");
    joinType: RawString;
    source: SourceExpression;
    condition: ValueComponent | null;
    lateral: boolean;
    constructor(joinType: string, datasourceExpression: SourceExpression, condition: ValueComponent | null, lateral: boolean) {
        super();
        this.joinType = new RawString(joinType);
        this.source = datasourceExpression;
        this.condition = condition;
        this.lateral = lateral;
    }
}

export class JoinList extends SqlComponent {
    static kind = Symbol("JoinList");
    items: JoinItem[];
    constructor(items: JoinItem[]) {
        super();
        this.items = items;
    }
}

export class FromClause extends SqlComponent {
    static kind = Symbol("FromClause");
    source: SourceExpression;
    join: JoinComponent | null;
    constructor(source: SourceExpression, join: JoinComponent | null) {
        super();
        this.source = source;
        this.join = join;
    }
}

export type CommonTableComponent = CommonTableItem | CommonTableList;

export type ColumnAliasComponent = ColumnAliasItem | ColumnAliasList;

export class ColumnAliasList extends SqlComponent {
    static kind = Symbol("ColumnAliasList");
    items: ColumnAliasItem[];
    constructor(items: ColumnAliasItem[]) {
        super();
        this.items = items;
    }
}
export class ColumnAliasItem extends SqlComponent {
    static kind = Symbol("ColumnAliasItem");
    name: IdentifierString
    constructor(name: string) {
        super();
        this.name = new IdentifierString(name);
    }
}

export class CommonTableItem extends SqlComponent {
    static kind = Symbol("CommonTable");
    name: IdentifierString;
    query: SelectQuery;
    materialized: boolean | null;
    columnAlias: ColumnAliasComponent | null;
    constructor(name: string, query: SelectQuery, materialized: boolean | null, columnAlias: ColumnAliasComponent | null) {
        super();
        this.name = new IdentifierString(name);
        this.query = query;
        this.materialized = materialized;
        this.columnAlias = columnAlias;
    }
}

export class CommonTableList extends SqlComponent {
    static kind = Symbol("CommonTableList");
    items: CommonTableItem[];
    constructor(items: CommonTableItem[]) {
        super();
        this.items = items;
    }
}

export class WithClause extends SqlComponent {
    static kind = Symbol("WithClause");
    recursive: boolean;
    commonTable: CommonTableComponent;
    constructor(recursive: boolean, commonTable: CommonTableComponent) {
        super();
        this.recursive = recursive;
        this.commonTable = commonTable;
    }
}

export type RowLimitComponent = LimitOffset | FetchSpecification;

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
    constructor(lockMode: LockMode) {
        super();
        this.lockMode = lockMode;
    }
}

