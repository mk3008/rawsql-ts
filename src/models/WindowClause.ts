import { OrderByClause } from "./OrderByClause";
import { SqlComponent } from "./SqlComponent";
import { IdentifierString } from "./ValueComponent";

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

export class PartitionByClause extends SqlComponent {
    static kind = Symbol("PartitionByClause");
    expression: SqlComponent;
    constructor(expression: SqlComponent) {
        super();
        this.expression = expression;
    }
}
