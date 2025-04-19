// Type definitions for rawsql-ts
// Project: rawsql-ts

/**
 * Represents a parser for SQL SELECT queries.
 */
export declare class SelectQueryParser {
    /**
     * Parses a SQL string and returns a SelectQuery object.
     * @param sql The SQL query string.
     */
    static parseFromText(sql: string): SelectQuery;
}

/**
 * Represents a binary SELECT query (e.g., UNION, INTERSECT, EXCEPT).
 */
export declare class BinarySelectQuery {
    static kind: symbol;
    left: SelectQuery;
    operator: RawString;
    right: SelectQuery;
    constructor(left: SelectQuery, operator: string, right: SelectQuery);
    union(query: SelectQuery): BinarySelectQuery;
    // ...other methods...
}

/**
 * Represents a SELECT query (simple, binary, or values).
 */
export type SelectQuery = SimpleSelectQuery | BinarySelectQuery | ValuesQuery;

/**
 * Represents a value component in SQL (column, literal, etc).
 */
export type ValueComponent = ValueList |
    ColumnReference |
    FunctionCall |
    UnaryExpression |
    BinaryExpression |
    LiteralValue |
    ParameterExpression |
    SwitchCaseArgument |
    CaseKeyValuePair |
    RawString |
    IdentifierString |
    ParenExpression |
    CastExpression |
    CaseExpression |
    ArrayExpression |
    BetweenExpression |
    InlineQuery |
    StringSpecifierExpression |
    TypeValue |
    TupleExpression;

export declare class InlineQuery {
    static kind: symbol;
    selectQuery: SelectQuery;
    constructor(selectQuery: SelectQuery);
}

export declare class ValueList {
    static kind: symbol;
    values: ValueComponent[];
    constructor(values: ValueComponent[]);
}

/**
 * Represents a VALUES query.
 */
export declare class ValuesQuery {
    static kind: symbol;
    tuples: TupleExpression[];
    constructor(tuples: TupleExpression[]);
}

/**
 * Collects CTEs from a query.
 */
export declare class CTECollector {
    // Main method to collect CTEs from a query
    collect(query: SelectQuery): any;
}

/**
 * Normalizes CTEs in a query.
 */
export declare class CTENormalizer {
    constructor();
    normalize(query: SelectQuery): SelectQuery;
}

/**
 * Formats a query object into a SQL string.
 */
export declare class Formatter {
    constructor();
    visit(query: any): string;
}

/**
 * Normalizes queries (e.g., flattens unions).
 */
export declare class QueryNormalizer {
    normalize(query: SelectQuery): SimpleSelectQuery;
}

/**
 * Collects select values from a query.
 */
export declare class SelectValueCollector {
    constructor(tableColumnResolver?: (tableName: string) => string[], initialCommonTables?: any[] | null);
    // ...other methods...
}

/**
 * Collects selectable columns from a query.
 */
export declare class SelectableColumnCollector {
    constructor(tableColumnResolver?: (tableName: string) => string[]);
    // ...other methods...
}

/**
 * Collects table sources from a query.
 */
export declare class TableSourceCollector {
    constructor(selectableOnly?: boolean);
    // ...other methods...
}

/**
 * Finds upstream select queries.
 */
export declare class UpstreamSelectQueryFinder {
    constructor(tableColumnResolver?: (tableName: string) => string[]);
    find(query: SelectQuery, columnNames: string[]): SelectQuery[];
}

/**
 * Represents a simple SELECT query in SQL.
 */
export declare class SimpleSelectQuery {
    static kind: symbol;
    WithClause: WithClause | null;
    selectClause: SelectClause;
    fromClause: FromClause | null;
    whereClause: WhereClause | null;
    groupByClause: GroupByClause | null;
    havingClause: HavingClause | null;
    orderByClause: OrderByClause | null;
    windowFrameClause: WindowFrameClause | null;
    rowLimitClause: LimitClause | null;
    forClause: ForClause | null;
    constructor(
        withClause: WithClause | null,
        selectClause: SelectClause,
        fromClause: FromClause | null,
        whereClause: WhereClause | null,
        groupByClause: GroupByClause | null,
        havingClause: HavingClause | null,
        orderByClause: OrderByClause | null,
        windowFrameClause: WindowFrameClause | null,
        rowLimitClause: LimitClause | null,
        forClause: ForClause | null
    );
}

export declare class RawString {
    static kind: symbol;
    value: string;
    constructor(value: string);
}

export declare class IdentifierString {
    static kind: symbol;
    name: string;
    constructor(alias: string);
}

export declare class TupleExpression {
    static kind: symbol;
    values: ValueComponent[];
    constructor(values: ValueComponent[]);
}

export declare class LiteralValue {
    static kind: symbol;
    value: string | number | boolean | null;
    constructor(value: string | number | boolean | null);
}

export declare class UnaryExpression {
    static kind: symbol;
    operator: RawString;
    expression: ValueComponent;
    constructor(operator: string, expression: ValueComponent);
}

export declare class BinaryExpression {
    static kind: symbol;
    left: ValueComponent;
    operator: RawString;
    right: ValueComponent;
    constructor(left: ValueComponent, operator: string, right: ValueComponent);
}

export declare class ParameterExpression {
    static kind: symbol;
    name: RawString;
    constructor(name: string);
}

export declare class SwitchCaseArgument {
    static kind: symbol;
    cases: CaseKeyValuePair[];
    elseValue: ValueComponent | null;
    constructor(cases: CaseKeyValuePair[], elseValue?: ValueComponent | null);
}

export declare class CaseKeyValuePair {
    static kind: symbol;
    key: ValueComponent;
    value: ValueComponent;
    constructor(key: ValueComponent, value: ValueComponent);
}

export declare class ParenExpression {
    static kind: symbol;
    expression: ValueComponent;
    constructor(expression: ValueComponent);
}

export declare class CastExpression {
    static kind: symbol;
    input: ValueComponent;
    castType: TypeValue;
    constructor(input: ValueComponent, castType: TypeValue);
}

export declare class CaseExpression {
    static kind: symbol;
    condition: ValueComponent | null;
    switchCase: SwitchCaseArgument;
    constructor(condition: ValueComponent | null, switchCase: SwitchCaseArgument);
}

export declare class ArrayExpression {
    static kind: symbol;
    expression: ValueComponent;
    constructor(expression: ValueComponent);
}

export declare class BetweenExpression {
    static kind: symbol;
    expression: ValueComponent;
    lower: ValueComponent;
    upper: ValueComponent;
    negated: boolean;
    constructor(expression: ValueComponent, lower: ValueComponent, upper: ValueComponent, negated: boolean);
}

export declare class StringSpecifierExpression {
    static kind: symbol;
    specifier: RawString;
    value: ValueComponent;
    constructor(specifier: string, value: string);
}

export declare class TypeValue {
    static kind: symbol;
    type: RawString;
    argument: ValueComponent | null;
    constructor(type: string, argument?: ValueComponent | null);
}

export declare class ColumnReference {
    static kind: symbol;
    namespaces: IdentifierString[] | null;
    column: IdentifierString;
    constructor(namespaces: string[] | null, column: string);
}

export declare class FunctionCall {
    static kind: symbol;
    name: RawString;
    argument: ValueComponent | null;
    over: any | null;
    constructor(name: string, argument: ValueComponent | null, over: any | null);
}

export declare class SelectClause {
    static kind: symbol;
    items: SelectComponent[];
    distinct: DistinctComponent | null;
    constructor(items: SelectComponent[], distinct?: DistinctComponent | null);
}

export declare type SelectComponent = SelectItem | ValueComponent;

export declare class SelectItem {
    static kind: symbol;
    value: ValueComponent;
    identifier: IdentifierString;
    constructor(value: ValueComponent, name: string);
}

export declare type DistinctComponent = Distinct | DistinctOn;

export declare class Distinct {
    static kind: symbol;
    constructor();
}

export declare class DistinctOn {
    static kind: symbol;
    value: ValueComponent;
    constructor(value: ValueComponent);
}

export declare class WhereClause {
    static kind: symbol;
    condition: ValueComponent;
    constructor(condition: ValueComponent);
}

export declare class WindowFrameClause {
    static kind: symbol;
    name: IdentifierString;
    expression: any;
    constructor(name: string, expression: any);
}

export declare class FromClause {
    static kind: symbol;
    source: any;
    joins: any[] | null;
    constructor(source: any, joins?: any[] | null);
}

export declare class GroupByClause {
    static kind: symbol;
    grouping: ValueComponent[];
    constructor(grouping: ValueComponent[]);
}

export declare class HavingClause {
    static kind: symbol;
    condition: ValueComponent;
    constructor(condition: ValueComponent);
}

export declare class OrderByClause {
    static kind: symbol;
    order: any[];
    constructor(order: any[]);
}

export declare class LimitClause {
    static kind: symbol;
    limit: ValueComponent;
    offset?: ValueComponent;
    constructor(limit: ValueComponent, offset?: ValueComponent);
}

export declare class ForClause {
    static kind: symbol;
    lockMode: string;
    constructor(lockMode: string);
}

export declare class WithClause {
    static kind: symbol;
    tables: any[];
    recursive: boolean;
    constructor(tables: any[], recursive?: boolean);
}
