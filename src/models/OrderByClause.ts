import { SqlComponent } from "./SqlComponent";

export enum SortDirection {
    Ascending = "asc",
    Descending = "desc",
}
export enum NullsSortDirection {
    First = "first",
    Last = "last",
}

export class OrderByClause extends SqlComponent {
    static kind = Symbol("OrederByClause");
    expression: OrderByComponent;
    constructor(expression: OrderByComponent) {
        super();
        this.expression = expression;
    }
}

export abstract class OrderByComponent extends SqlComponent {
}

export class OrderExpression extends OrderByComponent {
    static kind = Symbol("OrderByExpression");
    expression: SqlComponent;
    sortDirection: SortDirection;
    nullsPosition: NullsSortDirection | null;
    constructor(expression: SqlComponent, sortDirection: SortDirection = SortDirection.Ascending, nullsPosition: NullsSortDirection | null) {
        super();
        this.expression = expression;
        this.sortDirection = sortDirection;
        this.nullsPosition = nullsPosition;
    }
}

export class OrderByCollection extends OrderByComponent {
    static kind = Symbol("OrderByCollection");
    expressions: OrderExpression[];
    constructor(expressions: OrderExpression[]) {
        super();
        this.expressions = expressions;
    }
}