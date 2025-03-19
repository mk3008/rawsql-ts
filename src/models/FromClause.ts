import { SelectQuery } from "./SelectQuery";
import { SqlComponent } from "./SqlComponent";
import { IdentifierString, RawString, ValueComponent } from "./ValueComponent";

export abstract class DatasourceComponent extends SqlComponent {
}

export class TableSource extends DatasourceComponent {
    static kind = Symbol("TableSource");
    namespaces: IdentifierString[] | null;
    table: IdentifierString;
    constructor(namespaces: IdentifierString[] | null, table: string) {
        super();
        this.namespaces = namespaces;
        this.table = new IdentifierString(table);
    }
}

export class FuncionSource extends DatasourceComponent {
    static kind = Symbol("FuncionSource");
    function: RawString;
    argument: ValueComponent | null;
    constructor(functionName: string, argument: ValueComponent | null) {
        super();
        this.function = new RawString(functionName);
        this.argument = argument;
    }
}

export class SubQuerySource extends DatasourceComponent {
    static kind = Symbol("SubQuerySource");
    query: SelectQuery;
    constructor(query: SelectQuery) {
        super();
        this.query = query;
    }
}

export class DatasourceExpression extends SqlComponent {
    static kind = Symbol("DatasourceExpression");
    datasource: DatasourceComponent;
    alias: IdentifierString | null;
    constructor(datasource: DatasourceComponent, alias: string | null) {
        super();
        this.datasource = datasource;
        this.alias = alias !== null ? new IdentifierString(alias) : null;
    }
}

export abstract class JoinComponent extends SqlComponent {
}

export class JoinClause extends JoinComponent {
    static kind = Symbol("JoinClause");
    joinType: RawString;
    datasource: DatasourceExpression;
    condition: SqlComponent | null;
    lateral: boolean;
    constructor(joinType: string, datasource: DatasourceExpression, condition: SqlComponent | null, lateral: boolean) {
        super();
        this.joinType = new RawString(joinType);
        this.datasource = datasource;
        this.condition = condition;
        this.lateral = lateral;
    }
}

export class JoinCollection extends JoinComponent {
    static kind = Symbol("JoinCollection");
    collection: JoinClause[];
    constructor(collection: JoinClause[]) {
        super();
        this.collection = collection;
    }
}

export class FromClause extends SqlComponent {
    static kind = Symbol("FromClause");
    datasource: DatasourceExpression;
    join: JoinComponent | null;
    constructor(datasource: DatasourceExpression, join: JoinComponent | null) {
        super();
        this.datasource = datasource;
        this.join = join;
    }
}
