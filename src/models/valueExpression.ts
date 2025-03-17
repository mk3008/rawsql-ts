export type SqlComponent = ValueExpression |
    ColumnReference |
    FunctionCall |
    UnaryExpression |
    BinaryExpression |
    LiteralValue |
    ParameterExpression;

export abstract class ValueExpression {
    // kindは抽象的に宣言し、サブクラスで具体的に定義
    static kind: symbol;

    getKind(): symbol {
        return (this.constructor as typeof ValueExpression).kind;
    }

    accept<T>(visitor: SqlComponentVisitor<T>): T {
        return visitor.visit(this);
    }
}

export class ColumnReference extends ValueExpression {
    static kind = Symbol("ColumnReferenceExpression");
    namespaces: string[];
    column: string;

    constructor(namespaces: string[], column: string) {
        super();
        this.namespaces = namespaces;
        this.column = column;
    }
}

export class FunctionCall extends ValueExpression {
    static kind = Symbol("FunctionCall");
    name: string;
    args: ValueExpression[];

    constructor(name: string, args: ValueExpression[]) {
        super();
        this.name = name;
        this.args = args;
    }
}

export class UnaryExpression extends ValueExpression {
    static kind = Symbol("UnaryExpression");
    operator: string;
    expression: ValueExpression;
    constructor(operator: string, expression: ValueExpression) {
        super();
        this.operator = operator;
        this.expression = expression;
    }
}

export class BinaryExpression extends ValueExpression {
    static kind = Symbol("BinaryExpression");
    left: ValueExpression;
    operator: string;
    right: ValueExpression;
    constructor(left: ValueExpression, operator: string, right: ValueExpression) {
        super();
        this.left = left;
        this.operator = operator;
        this.right = right;
    }
}

export class LiteralValue extends ValueExpression {
    static kind = Symbol("LiteralExpression");
    value: string | number | boolean | null;
    escapeOption: string | null;
    constructor(value: string | number | boolean | null, escapeOption: string | null = null) {
        super();
        this.value = value;
        this.escapeOption = escapeOption;
    }
}

export class ParameterExpression extends ValueExpression {
    static kind = Symbol("ParameterExpression");
    name: string;
    constructor(name: string) {
        super();
        this.name = name;
    }
}



export interface SqlComponentVisitor<T> {
    visit(expr: SqlComponent): T;
}

export class SqlDialectConfiguration {
    public parameterSymbol = ":";
    public identifierEscape = { start: "\"", end: "\"" };
}

export class ValueExpressionFormatter implements SqlComponentVisitor<string> {
    private handlers = new Map<symbol, (expr: SqlComponent) => string>();

    public config = new SqlDialectConfiguration();

    constructor() {
        this.handlers.set(ColumnReference.kind, expr => this.decodeColumnReference(expr as ColumnReference));
        this.handlers.set(FunctionCall.kind, expr => this.decodeFunctionCall(expr as FunctionCall));
        this.handlers.set(UnaryExpression.kind, expr => this.decodeUnaryExpression(expr as UnaryExpression));
        this.handlers.set(BinaryExpression.kind, expr => this.decodeBinaryExpression(expr as BinaryExpression));
        this.handlers.set(LiteralValue.kind, expr => this.decodeLiteralExpression(expr as LiteralValue));
        this.handlers.set(ParameterExpression.kind, expr => this.decodeParameterExpression(expr as ParameterExpression));
    }

    visit(expr: SqlComponent): string {
        const handler = this.handlers.get(expr.getKind());
        return handler ? handler(expr) : `Unknown Expression`;
    }

    decodeColumnReference(expr: ColumnReference): string {
        if (expr.namespaces.length > 0) {
            return `${expr.namespaces.map(ns => `${this.config.identifierEscape.start}${ns}${this.config.identifierEscape.end}`).join(".")}.${this.config.identifierEscape.start}${expr.column}${this.config.identifierEscape.end}`;
        }
        return `${this.config.identifierEscape.start}${expr.column}${this.config.identifierEscape.end}`;
    }

    decodeFunctionCall(expr: FunctionCall): string {
        if (expr.args.length > 0) {
            return `${expr.name}(${expr.args.map(arg => arg.accept(this)).join(", ")})`;
        }
        return `${expr.name}()`;
    }

    decodeUnaryExpression(expr: UnaryExpression): string {
        return `${expr.operator} ${expr.expression.accept(this)}`;
    }

    decodeBinaryExpression(expr: BinaryExpression): string {
        return `${expr.left.accept(this)} ${expr.operator} ${expr.right.accept(this)}`;
    }

    decodeLiteralExpression(expr: LiteralValue): string {
        if (typeof expr.value === "string") {
            const option = expr.escapeOption !== null ? ` uescape '${expr.escapeOption.replace(/'/g, "''")}'` : '';
            return `'${expr.value.replace(/'/g, "''")}'${option}`;
        }
        if (expr.value === null) {
            return "null";
        }
        return expr.value.toString();
    }

    decodeParameterExpression(expr: ParameterExpression): string {
        return `${this.config.parameterSymbol}${expr.name}`;
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
