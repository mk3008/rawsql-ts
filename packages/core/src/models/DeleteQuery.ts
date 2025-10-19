// Represents a DELETE query in SQL.
// Supports optional USING, WHERE, and RETURNING clauses alongside WITH.
import { SqlComponent } from "./SqlComponent";
import { DeleteClause, ReturningClause, UsingClause, WhereClause, WithClause } from "./Clause";

export class DeleteQuery extends SqlComponent {
    static kind = Symbol("DeleteQuery");
    withClause: WithClause | null;
    deleteClause: DeleteClause;
    usingClause: UsingClause | null;
    whereClause: WhereClause | null;
    returningClause: ReturningClause | null;

    constructor(params: {
        withClause?: WithClause | null;
        deleteClause: DeleteClause;
        usingClause?: UsingClause | null;
        whereClause?: WhereClause | null;
        returning?: ReturningClause | null;
    }) {
        super();
        this.withClause = params.withClause ?? null;
        this.deleteClause = params.deleteClause;
        this.usingClause = params.usingClause ?? null;
        this.whereClause = params.whereClause ?? null;
        this.returningClause = params.returning ?? null;
    }
}
