import type { SelectQuery } from "./SelectQuery";
import { SqlComponent } from "./SqlComponent";
import { TupleExpression } from "./ValueComponent";

/**
 * Represents a VALUES query in SQL.
 */
export class ValuesQuery extends SqlComponent {
    static kind = Symbol("ValuesQuery");
    tuples: TupleExpression[];
    constructor(tuples: TupleExpression[]) {
        super();
        this.tuples = tuples;
    }
}
