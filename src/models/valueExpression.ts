export type SqlComponent = ValueExpression |
    ColumnReference |
    FunctionCall |
    UnaryExpression |
    BinaryExpression |
    LiteralValue |
    ParameterExpression |
    ArrayExpression |
    SelectExpression |
    CastExpression |
    BracketExpression |
    BetweenExpression |
    PositionExpression |
    ExtractArgument |
    CaseExpression |
    TrimArgument |
    IdentifierString |
    RawString |
    PartitionByClause |
    OrderByClause |
    OrderByExpression |
    OverClause |
    WindowFrameClause |
    SelectClause |
    WhereClause |
    SelectQuery;


// inlineQuery
// 
// 
// substring



export abstract class ValueExpression {
    // `kind` is declared abstractly and defined concretely in a subclass.
    static kind: symbol;

    getKind(): symbol {
        return (this.constructor as typeof ValueExpression).kind;
    }

    accept<T>(visitor: SqlComponentVisitor<T>): T {
        return visitor.visit(this);
    }
}

export class ExtractArgument extends ValueExpression {
    static kind = Symbol("ExtractArgument");
    field: RawString;
    expression: ValueExpression;
    constructor(field: string, expression: ValueExpression) {
        super();
        this.field = new RawString(field);
        this.expression = expression;
    }
}

/*
 * Values ​​that must be hard-coded, such as type names and function names.
 * A simple check is performed when decoding.
 */
export class RawString extends ValueExpression {
    static kind = Symbol("RawString");
    keyword: string;
    constructor(keyword: string) {
        super();
        this.keyword = keyword;
    }
}

export class IdentifierString extends ValueExpression {
    static kind = Symbol("IdentifierString");
    // Use the string type instead of the RawString type because it has its own escaping process.
    alias: string;
    constructor(alias: string) {
        super();
        this.alias = alias;
    }
}

export class TrimArgument extends ValueExpression {
    static kind = Symbol("TrimExpression");
    modifier: RawString | null;
    trimCharacter: ValueExpression;
    inputString: ValueExpression;
    constructor(modifier: string | null, trimCharacter: ValueExpression, inputString: ValueExpression) {
        super();
        this.modifier = modifier !== null ? new RawString(modifier) : null;
        this.trimCharacter = trimCharacter;
        this.inputString = inputString;
    }
}

export class PartitionByClause extends ValueExpression {
    static kind = Symbol("PartitionByClause");
    columns: ValueExpression[];
    constructor(columns: ValueExpression[]) {
        super();
        this.columns = columns;
    }
}

export class OrderByExpression extends ValueExpression {
    static kind = Symbol("OrderByExpression");
    expression: ValueExpression;
    // Use the string type instead of the RawString type because it has its own escaping process.
    direction: string;
    // Use the string type instead of the RawString type because it has its own escaping process.
    nullsOption: string | null;
    constructor(expression: ValueExpression, direction: string, nullsOption: string | null) {
        super();
        this.expression = expression;
        this.direction = direction;
        this.nullsOption = nullsOption;
    }
}

export class OrderByClause extends ValueExpression {
    static kind = Symbol("OrederByClause");
    expressions: OrderByExpression[];
    constructor(expressions: OrderByExpression[]) {
        super();
        this.expressions = expressions;
    }
}

export class WindowFrameClause extends ValueExpression {
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

export class OverClause extends ValueExpression {
    static kind = Symbol("OverClause");
    partitionBy: PartitionByClause | null;
    orderBy: OrderByClause | null;
    windowFrameAlias: IdentifierString | null;
    constructor(partitionBy: PartitionByClause | null, orderBy: OrderByClause | null, windowFrameAlias: string | null) {
        super();
        this.partitionBy = partitionBy;
        this.orderBy = orderBy;
        this.windowFrameAlias = windowFrameAlias !== null ? new IdentifierString(windowFrameAlias) : null;
    }
}

export class PositionExpression extends ValueExpression {
    static kind = Symbol("PositionExpression");
    expression: ValueExpression;
    subExpression: ValueExpression;
    constructor(expression: ValueExpression, subExpression: ValueExpression) {
        super();
        this.expression = expression;
        this.subExpression = subExpression;
    }
}

export class BetweenExpression extends ValueExpression {
    static kind = Symbol("BetweenExpression");
    expression: ValueExpression;
    lower: ValueExpression;
    upper: ValueExpression;
    constructor(expression: ValueExpression, lower: ValueExpression, upper: ValueExpression) {
        super();
        this.expression = expression;
        this.lower = lower;
        this.upper = upper;
    }
}

export class BracketExpression extends ValueExpression {
    static kind = Symbol("BracketExpression");
    expression: ValueExpression;
    constructor(expression: ValueExpression) {
        super();
        this.expression = expression;
    }
}

export class CastExpression extends ValueExpression {
    static kind = Symbol("CastExpression");
    expression: ValueExpression;
    castType: RawString;
    constructor(expression: ValueExpression, castType: string) {
        super();
        this.expression = expression;
        this.castType = new RawString(castType);
    }
}

export class CaseExpression extends ValueExpression {
    static kind = Symbol("CaseExpression");
    condition: ValueExpression | null;
    keyValues: { key: ValueExpression, value: ValueExpression }[];
    elseValue: ValueExpression | null;

    constructor(condition: ValueExpression | null, keyValues: { key: ValueExpression, value: ValueExpression }[], elseValue: ValueExpression | null = null) {
        super();
        this.condition = condition;
        this.keyValues = keyValues;
        this.elseValue = elseValue;
    }
}

export class ArrayExpression extends ValueExpression {
    static kind = Symbol("ArrayExpression");
    args: ValueExpression[];
    constructor(args: ValueExpression[]) {
        super();
        this.args = args;
    }
}

export class SelectExpression extends ValueExpression {
    static kind = Symbol("SelectExpression");
    select: ValueExpression;
    alias: IdentifierString | null;
    constructor(select: ValueExpression, alias: string | null) {
        super();
        this.select = select;
        this.alias = alias !== null ? new IdentifierString(alias) : null;
    }
}

export class ColumnReference extends ValueExpression {
    static kind = Symbol("ColumnReferenceExpression");
    // Use the string type instead of the RawString type because it has its own escaping process.
    namespaces: IdentifierString[];
    // Use the string type instead of the RawString type because it has its own escaping process.
    column: IdentifierString;
    constructor(namespaces: string[], column: string) {
        super();
        this.namespaces = namespaces.map(ns => new IdentifierString(ns));
        this.column = new IdentifierString(column);
    }
}

export class FunctionCall extends ValueExpression {
    static kind = Symbol("FunctionCall");
    name: RawString;
    args: ValueExpression[];
    constructor(name: string, args: string[]) {
        super();
        this.name = new RawString(name);
        this.args = args.map(arg => new IdentifierString(arg));
    }
}

export class UnaryExpression extends ValueExpression {
    static kind = Symbol("UnaryExpression");
    operator: RawString;
    expression: ValueExpression;
    constructor(operator: string, expression: ValueExpression) {
        super();
        this.operator = new RawString(operator);
        this.expression = expression;
    }
}

export class BinaryExpression extends ValueExpression {
    static kind = Symbol("BinaryExpression");
    left: ValueExpression;
    operator: RawString;
    right: ValueExpression;
    constructor(left: ValueExpression, operator: string, right: ValueExpression) {
        super();
        this.left = left;
        this.operator = new RawString(operator);
        this.right = right;
    }
}

export class LiteralValue extends ValueExpression {
    static kind = Symbol("LiteralExpression");
    // Use the string type instead of the RawString type because it has its own escaping process.
    value: string | number | boolean | null;
    // Use the string type instead of the RawString type because it has its own escaping process.
    escapeOption: string | null;
    constructor(value: string | number | boolean | null, escapeOption: string | null = null) {
        super();
        this.value = value;
        this.escapeOption = escapeOption;
    }
}

export class ParameterExpression extends ValueExpression {
    static kind = Symbol("ParameterExpression");
    name: RawString;
    constructor(name: string) {
        super();
        this.name = new RawString(name);
    }
}

export class SelectClause extends ValueExpression {
    static kind = Symbol("SelectClause");
    columns: ValueExpression[];
    constructor(columns: ValueExpression[]) {
        super();
        this.columns = columns;
    }
}

export class WhereClause extends ValueExpression {
    static kind = Symbol("WhereClause");
    condition: ValueExpression;
    constructor(condition: ValueExpression) {
        super();
        this.condition = condition;
    }
}

export class SelectQuery extends ValueExpression {
    static kind = Symbol("SelectQuery");
    select: SelectClause;
    constructor(select: SelectClause) {
        super();
        this.select = select;
    }

}

export interface SqlComponentVisitor<T> {
    visit(expr: SqlComponent): T;
}

export class SqlDialectConfiguration {
    public parameterSymbol = ":";
    public identifierEscape = { start: "\"", end: "\"" };
}

export class SelectQueryFormatter implements SqlComponentVisitor<string> {
    private handlers = new Map<symbol, (expr: SqlComponent) => string>();

    config: SqlDialectConfiguration;

    constructor(config: SqlDialectConfiguration) {
        this.config = config;
        //this.handlers.set(ColumnReference.kind, expr => this.decodeColumnReference(expr as ColumnReference));
        //this.handlers.set(FunctionCall.kind, expr => this.decodeFunctionCall(expr as FunctionCall));
        //this.handlers.set(UnaryExpression.kind, expr => this.decodeUnaryExpression(expr as UnaryExpression));
        //this.handlers.set(BinaryExpression.kind, expr => this.decodeBinaryExpression(expr as BinaryExpression));
        //this.handlers.set(LiteralValue.kind, expr => this.decodeLiteralExpression(expr as LiteralValue));
        //this.handlers.set(ParameterExpression.kind, expr => this.decodeParameterExpression(expr as ParameterExpression));
        //this.handlers.set(SelectExpression.kind, expr => this.decodeSelectExpression(expr as SelectExpression));
        //this.handlers.set(SelectClause.kind, expr => this.decodeSelectClause(expr as SelectClause));
        //this.handlers.set(SelectQuery.kind, expr => this.decodeSelectQuery(expr as SelectQuery));
    }

    visit(expr: SqlComponent): string {
        const handler = this.handlers.get(expr.getKind());
        return handler ? handler(expr) : `Unknown Expression`;
    }
}

export class ValueExpressionFormatter implements SqlComponentVisitor<string> {
    private handlers = new Map<symbol, (expr: SqlComponent) => string>();

    config: SqlDialectConfiguration;

    constructor(config: SqlDialectConfiguration | null = null) {
        this.config = config !== null ? config : new SqlDialectConfiguration();

        this.handlers.set(ColumnReference.kind, expr => this.decodeColumnReference(expr as ColumnReference));
        this.handlers.set(FunctionCall.kind, expr => this.decodeFunctionCall(expr as FunctionCall));
        this.handlers.set(UnaryExpression.kind, expr => this.decodeUnaryExpression(expr as UnaryExpression));
        this.handlers.set(BinaryExpression.kind, expr => this.decodeBinaryExpression(expr as BinaryExpression));
        this.handlers.set(LiteralValue.kind, expr => this.decodeLiteralExpression(expr as LiteralValue));
        this.handlers.set(ParameterExpression.kind, expr => this.decodeParameterExpression(expr as ParameterExpression));
        this.handlers.set(SelectExpression.kind, expr => this.decodeSelectExpression(expr as SelectExpression));
        this.handlers.set(ArrayExpression.kind, expr => this.decodeArrayExpression(expr as ArrayExpression));
        this.handlers.set(CaseExpression.kind, expr => this.decodeCaseExpression(expr as CaseExpression));
        this.handlers.set(CastExpression.kind, expr => this.decodeCastExpression(expr as CastExpression));
        this.handlers.set(BracketExpression.kind, expr => this.decodeBracketExpression(expr as BracketExpression));
        this.handlers.set(BetweenExpression.kind, expr => this.decodeBetweenExpression(expr as BetweenExpression));
        this.handlers.set(PositionExpression.kind, expr => this.decodePositionExpression(expr as PositionExpression));
        this.handlers.set(OrderByExpression.kind, expr => this.decodeOrderByExpression(expr as OrderByExpression));
        this.handlers.set(TrimArgument.kind, expr => this.decodeTrimArgument(expr as TrimArgument));
        this.handlers.set(ExtractArgument.kind, expr => this.decodeExtractArgument(expr as ExtractArgument));
        this.handlers.set(RawString.kind, expr => this.decodeKeywordValue(expr as RawString));
        this.handlers.set(IdentifierString.kind, expr => this.decodeIdentifierString(expr as IdentifierString));

        this.handlers.set(PartitionByClause.kind, expr => this.decodePartitionByClause(expr as PartitionByClause));
        this.handlers.set(OverClause.kind, expr => this.decodeOverClause(expr as OverClause));
        this.handlers.set(WhereClause.kind, expr => this.decodeWhereClause(expr as WhereClause));
        this.handlers.set(WindowFrameClause.kind, expr => this.decodeWindowFrameClause(expr as WindowFrameClause));
        this.handlers.set(SelectClause.kind, expr => this.decodeSelectClause(expr as SelectClause));

        this.handlers.set(SelectQuery.kind, expr => this.decodeSelectQuery(expr as SelectQuery));
    }

    visit(expr: SqlComponent): string {
        const handler = this.handlers.get(expr.getKind());
        return handler ? handler(expr) : `Unknown Expression`;
    }

    decodeColumnReference(expr: ColumnReference): string {
        if (expr.namespaces.length > 0) {
           return `${expr.namespaces.map(ns => `${ns.accept(this)}`).join(".")}.${expr.column.accept(this)}`;
        }
        return `${expr.column.accept(this)}`;
    }

    decodeFunctionCall(expr: FunctionCall): string {
        if (expr.args.length > 0) {
            return `${expr.name.accept(this)}(${expr.args.map(arg => arg.accept(this)).join(", ")})`;
        }
        return `${expr.name.accept(this)}()`;
    }

    decodeUnaryExpression(expr: UnaryExpression): string {
        return `${expr.operator.accept(this)} ${expr.expression.accept(this)}`;
    }

    decodeBinaryExpression(expr: BinaryExpression): string {
        return `${expr.left.accept(this)} ${expr.operator.accept(this)} ${expr.right.accept(this)}`;
    }

    decodeLiteralExpression(expr: LiteralValue): string {
        if (typeof expr.value === "string") {
            const option = expr.escapeOption !== null ? ` uescape '${expr.escapeOption.replace(/'/g, "''")}'` : '';
            return `'${expr.value.replace(/'/g, "''")}'${option}`;
        }
        else if (expr.value === null) {
            return "null";
        }
        return expr.value.toString();
    }

    decodeParameterExpression(expr: ParameterExpression): string {
        return `${this.config.parameterSymbol}${expr.name}`;
    }

    decodeSelectExpression(expr: SelectExpression): string {
        if (expr.alias !== null) {
            return `${expr.select.accept(this)} as ${expr.alias}`;
        }
        return expr.select.accept(this);
    }

    decodeSelectClause(expr: SelectClause): string {
        return expr.columns.map(col => col.accept(this)).join(", ");
    }

    decodeSelectQuery(expr: SelectQuery): string {
        return `select ${expr.select.accept(this)}`;
    }

    decodeArrayExpression(expr: ArrayExpression): string {
        return `array[${expr.args.map(arg => arg.accept(this))}]`;
    }

    decodeCaseExpression(expr: CaseExpression): string {
        if (expr.condition !== null) {
            const casePart = expr.keyValues.map(kv => `when ${kv.key.accept(this)} then ${kv.value.accept(this)}`).join(" ");
            const elsePart = expr.elseValue ? ` else ${expr.elseValue.accept(this)}` : "";
            return `case ${expr.condition.accept(this)} ${casePart}${elsePart} end`;
        } else {
            const casePart = expr.keyValues.map(kv => `when ${kv.key.accept(this)} then ${kv.value.accept(this)}`).join(" ");
            const elsePart = expr.elseValue ? ` else ${expr.elseValue.accept(this)}` : "";
            return `case ${casePart}${elsePart} end`;
        }
    }

    decodeCastExpression(expr: CastExpression): string {
        return `${expr.expression.accept(this)}::${expr.castType.accept(this)}`;

    }

    decodeBracketExpression(expr: BracketExpression): string {
        return `(${expr.expression.accept(this)})`;
    }

    decodeBetweenExpression(expr: BetweenExpression): string {
        return `${expr.expression.accept(this)} between ${expr.lower.accept(this)} and ${expr.upper.accept(this)}`;
    }

    decodePositionExpression(expr: PositionExpression): string {

        return `position(${expr.subExpression.accept(this)} in ${expr.expression.accept(this)})`;
    }

    decodePartitionByClause(expr: PartitionByClause): string {
        if (expr.columns.length > 0) {
            return `partition by ${expr.columns.map(col => col.accept(this)).join(", ")}`;
        }
        return "";
    }

    decodeOrderByExpression(expr: OrderByExpression): string {
        const direction = expr.direction !== null
            ? expr.direction.toLocaleLowerCase() === "asc"
                ? null
                : "desc"
            : null;

        const nullsOption = expr.nullsOption !== null
            ? expr.nullsOption.toLocaleLowerCase() === "first"
                ? "nulls first"
                : "nulls last"
            : null;

        if (direction !== null && nullsOption !== null) {
            return `${expr.expression.accept(this)} ${direction} ${nullsOption}`;
        } else if (direction !== null) {
            return `${expr.expression.accept(this)} ${direction}`;
        }
        return expr.expression.accept(this);
    }

    decodeOverClause(expr: OverClause): string {
        if (expr.windowFrameAlias !== null) {
            return `over ${expr.windowFrameAlias}`;
        }
        else if (expr.partitionBy !== null && expr.orderBy) {
            return `over (${expr.partitionBy.accept(this)} ${expr.orderBy.accept(this)})`;
        } else if (expr.partitionBy !== null) {
            return `over (${expr.partitionBy.accept(this)})`;
        } else if (expr.orderBy !== null) {
            return `over (${expr.orderBy.accept(this)})`;
        }
        return "over ()";
    }

    decodeTrimArgument(expr: TrimArgument): string {
        const modifier = expr.modifier !== null
            ? expr.modifier.accept(this)
            : null;

        if (modifier !== null && expr.trimCharacter != null) {
            // e.g. leading 'xyz' from 'yxTomxx'
            return `${modifier} ${expr.trimCharacter.accept(this)} from ${expr.inputString.accept(this)}`;
        } else if (expr.trimCharacter !== null) {
            // e.g. 'xyz' from 'yxTomxx'
            return `${expr.trimCharacter.accept(this)} from ${expr.inputString.accept(this)}`;
        }
        throw new Error("Invalid TrimArgument");
    }

    decodeWindowFrameClause(expr: WindowFrameClause): string {
        if (expr.partitionBy !== null && expr.orderBy !== null) {
            return `window ${expr.alias.accept(this)} as (${expr.partitionBy.accept(this)} ${expr.orderBy.accept(this)})`;
        } else if (expr.partitionBy !== null) {
            return `window ${expr.alias.accept(this)} as (${expr.partitionBy.accept(this)})`;
        } else if (expr.orderBy !== null) {
            return `window ${expr.alias.accept(this)} as (${expr.orderBy.accept(this)})`;
        }
        throw new Error("Invalid WindowFrameClause");
    }

    decodeWhereClause(expr: WhereClause): string {
        return `where ${expr.condition.accept(this)}`;
    }

    decodeExtractArgument(expr: ExtractArgument): string {
        return `extract(${expr.field.accept(this)} from ${expr.expression.accept(this)})`;
    }

    decodeKeywordValue(expr: RawString): string {
        const invalidChars = new Set(["'", '"', ",", ";", ":", ".", "--", "/*"]);
        if (invalidChars.has(expr.keyword)) {
            throw new Error(`invalid keyword: ${expr.keyword}`);
        }
        else if (expr.keyword.trim() === "") {
            throw new Error("invalid keyword: empty string");
        }
        return expr.keyword.trim();
    }

    decodeIdentifierString(expr: IdentifierString): string {
        return `${this.config.identifierEscape.start}${expr.alias}${this.config.identifierEscape.end}`;
    }
}

/*

export interface FunctionCall extends ValueExpression {
    type: "function";
    name: string;
    args: ValueExpression[];
    accept<T>(visitor: ValueExpressionVisitor<T>): T {
        return visitor.visitFunctionCall(this);
    }
}

export interface CastExpression extends ValueExpression {
    type: "cast";
    expression: ValueExpression;
    castType: string;
    accept<T>(visitor: ValueExpressionVisitor<T>): T {
        return visitor.visitCastExpression(this);
    }
}

export interface ArrayConstructorExpression extends ValueExpression {
    type: "array";
    elements: ValueExpression[];
    accept<T>(visitor: ValueExpressionVisitor<T>): T {
        return visitor.visitArrayConstructorExpression(this);
    }
}

export interface BinaryExpression extends ValueExpression {
    type: "binary";
    left: ValueExpression;
    operator: string;
    right: ValueExpression;
    accept<T>(visitor: ValueExpressionVisitor<T>): T {
        return visitor.visitBinaryExpression(this);
    }
}

export interface UnaryExpression extends ValueExpression {
    type: "unary";
    operator: string;
    expression: ValueExpression;
    accept<T>(visitor: ValueExpressionVisitor<T>): T {
        return visitor.visitUnaryExpression(this);
    }
}

export interface LiteralExpression extends ValueExpression {
    type: "literal";
    value: string | number | boolean | null;
    accept<T>(visitor: ValueExpressionVisitor<T>): T {
        return visitor.visitLiteralExpression(this);
    }
}

export interface NamedParameterExpression extends ValueExpression {
    type: "parameter";
    name: string;
    accept<T>(visitor: ValueExpressionVisitor<T>): T {
        return visitor.visitNamedParameterExpression(this);
    }
}

export interface NamelessParameterExpression extends ValueExpression {
    type: "parameter";
    index: number;
    accept<T>(visitor: ValueExpressionVisitor<T>): T {
        return visitor.visitNamelessParameterExpression(this);
    }
}
*//*
export interface ValueExpressionVisitor<T> {
    visitColumnReference(expr: ColumnReference): T;
    visitFunctionCall(expr: FunctionCall): T;
    visitCastExpression(expr: CastExpression): T;
    visitArrayConstructorExpression(expr: ArrayConstructorExpression): T;
    visitBinaryExpression(expr: BinaryExpression): T;
    visitUnaryExpression(expr: UnaryExpression): T;
    visitLiteralExpression(expr: LiteralExpression): T;
    visitNamedParameterExpression(expr: NamedParameterExpression): T;
    visitNamelessParameterExpression(expr: NamelessParameterExpression): T;
}*/
