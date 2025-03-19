import { SqlComponent } from "./SqlComponent";
import { IdentifierString, ValueComponent } from "./ValueComponent";

export abstract class SelectComponent extends SqlComponent {
}

export class SelectExpression extends SelectComponent {
    static kind = Symbol("SelectExpression");
    expression: ValueComponent;
    alias: IdentifierString | null;
    constructor(expression: SqlComponent, alias: string | null) {
        super();
        this.expression = expression;
        this.alias = alias !== null ? new IdentifierString(alias) : null;
    }
}

export class SelectCollection extends SelectComponent {
    static kind = Symbol("SelectCollection");
    collection: SelectComponent[];
    constructor(collection: SelectComponent[]) {
        super();
        this.collection = collection;
    }
}

export class SelectClause extends SqlComponent {
    static kind = Symbol("SelectClause");
    expression: SelectComponent;
    constructor(expression: SelectComponent) {
        super();
        this.expression = expression;
    }
}

export class DistinctComponent extends SelectComponent {
}

export class Distinct extends DistinctComponent {
    static kind = Symbol("Distinct");
    constructor() {
        super();
    }
}

export class DistinctOn extends DistinctComponent {
    static kind = Symbol("DistinctOn");
    expressions: ValueComponent[];
    constructor(expressions: ValueComponent[]) {
        super();
        this.expressions = expressions;
    }
}