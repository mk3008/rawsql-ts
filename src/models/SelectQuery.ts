import { Distinct, SelectClause } from "./SelectClause";
import { SqlComponent } from "./SqlComponent";

export class SelectQuery extends SqlComponent {
    static kind = Symbol("SelectQuery");
    selectClause: SelectClause;
    distinct: Distinct | null;
    constructor(select: SelectClause, distinct: Distinct | null = null) {
        super();
        this.selectClause = select;
        this.distinct = distinct;
    }
}