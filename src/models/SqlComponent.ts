export abstract class SqlComponent {
    map(arg0: (arg: any) => any) {
        throw new Error("Method not implemented.");
    }
    // `kind` is declared abstractly and defined concretely in a subclass.
    static kind: symbol;

    getKind(): symbol {
        return (this.constructor as typeof SqlComponent).kind;
    }

    accept<T>(visitor: SqlComponentVisitor<T>): T {
        return visitor.visit(this);
    }
}

export interface SqlComponentVisitor<T> {
    visit(expr: SqlComponent): T;
}

export class SqlDialectConfiguration {
    public parameterSymbol = ":";
    public identifierEscape = { start: '"', end: '"' };
}
