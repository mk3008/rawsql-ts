// Represents an INSERT query in SQL.
// Supports single/multi-row VALUES and INSERT ... SELECT.
import { SqlComponent } from "./SqlComponent";
import { SelectQuery } from "./SelectQuery";
import { InsertClause, ReturningClause, WithClause } from "./Clause";

export class InsertQuery extends SqlComponent {
    static kind = Symbol("InsertQuery");
    withClause: WithClause | null;
    insertClause: InsertClause;
    selectQuery: SelectQuery | null;
    returningClause: ReturningClause | null;

    /**
     * @param params.insertClause InsertClause instance (target table and columns)
     * @param params.selectQuery SELECT/VALUES query (required)
     * @param params.withClause Optional WITH clause scoped to the INSERT statement
     * @param params.returning Optional RETURNING clause
     */
    constructor(params: {
        withClause?: WithClause | null;
        insertClause: InsertClause;
        selectQuery?: SelectQuery | null;
        returning?: ReturningClause | null;
    }) {
        super();
        this.withClause = params.withClause ?? null;
        this.insertClause = params.insertClause;
        this.selectQuery = params.selectQuery ?? null;
        this.returningClause = params.returning ?? null;
    }
}
