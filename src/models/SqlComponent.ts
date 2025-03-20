export abstract class SqlComponent {
    // `kind` is declared abstractly and defined concretely in a subclass.
    static kind: symbol;

    getKind(): symbol {
        return (this.constructor as typeof SqlComponent).kind;
    }

    accept<T>(visitor: SqlComponentVisitor<T>): T {
        return visitor.visit(this);
    }

    toString(formatter: SqlComponentVisitor<string> | null = null): string {
        if (formatter === null) {
            // 動的インポートを使用して循環参照を回避
            const { DefaultFormatter } = require('./DefaultFormatter');
            formatter = new DefaultFormatter();
        }
        if (formatter === null) {
            throw new Error("Formatter cannot be null");
        }
        return this.accept(formatter);
    }
}

export interface SqlComponentVisitor<T> {
    visit(expr: SqlComponent): T;
}

export class SqlDialectConfiguration {
    public parameterSymbol = ":";
    public identifierEscape = { start: '"', end: '"' };
}
