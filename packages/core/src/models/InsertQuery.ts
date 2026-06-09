// Represents an INSERT query in SQL.
// Supports single/multi-row VALUES and INSERT ... SELECT.
import { SqlComponent } from "./SqlComponent";
import { SelectQuery } from "./SelectQuery";
import { InsertClause, OnConflictClause, ReturningClause } from "./Clause";

export class InsertQuery extends SqlComponent {
    static kind = Symbol("InsertQuery");
    insertClause: InsertClause;
    selectQuery: SelectQuery | null;
    onConflictClause: OnConflictClause | null;
    returningClause: ReturningClause | null;

    /**
     * @param params.insertClause InsertClause instance (target table and columns)
     * @param params.selectQuery SELECT/VALUES query (required)
     * @param params.returning Optional RETURNING clause
     */
    constructor(params: {
        insertClause: InsertClause;
        selectQuery?: SelectQuery | null;
        onConflict?: OnConflictClause | null;
        returning?: ReturningClause | null;
    }) {
        super();
        this.insertClause = params.insertClause;
        this.selectQuery = params.selectQuery ?? null;
        this.onConflictClause = params.onConflict ?? null;
        this.returningClause = params.returning ?? null;
    }
}
