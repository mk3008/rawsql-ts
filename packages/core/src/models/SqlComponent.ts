export abstract class SqlComponent {
    // `kind` is declared abstractly and defined concretely in a subclass.
    static kind: symbol;

    getKind(): symbol {
        return (this.constructor as typeof SqlComponent).kind;
    }

    accept<T>(visitor: SqlComponentVisitor<T>): T {
        return visitor.visit(this);
    }

    toSqlString(formatter: SqlComponentVisitor<string>): string {
        return this.accept(formatter);
    }

    comments: string[] | null = null;
}

export interface SqlComponentVisitor<T> {
    visit(expr: SqlComponent): T;
}

export class SqlDialectConfiguration {
    public parameterSymbol: string = ":";
    public identifierEscape = { start: '"', end: '"' };
    public exportComment: boolean = true;
}
