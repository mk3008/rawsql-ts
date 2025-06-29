// Represents an UPDATE query in SQL.
// Supports SET, WHERE, and optional FROM/RETURNING clauses.
import { SqlComponent } from "./SqlComponent";
import { IdentifierString, ValueComponent } from "./ValueComponent";
import { FromClause, ReturningClause, SetClause, WhereClause, SourceExpression, UpdateClause } from "./Clause";
import { WithClause } from "./Clause";

export class UpdateQuery extends SqlComponent {
    static kind = Symbol("UpdateQuery");
    withClause: WithClause | null;
    updateClause: UpdateClause;
    setClause: SetClause;
    whereClause: WhereClause | null;
    fromClause: FromClause | null;
    returningClause: ReturningClause | null;

    /**
     * @param params.source SourceExpression (table or subquery with optional alias)
     * @param params.setClause SetClause instance or array of {column, value} pairs
     * @param params.where WHERE clause (optional)
     * @param params.from FROM clause (optional)
     * @param params.returning RETURNING clause (optional)
     */

    constructor(params: {
        withClause?: WithClause | null;
        updateClause: UpdateClause;
        setClause: SetClause | { column: string | IdentifierString, value: ValueComponent }[];
        whereClause?: WhereClause | null;
        fromClause?: FromClause | null;
        returning?: ReturningClause | null;
    }) {
        super();
        this.withClause = params.withClause ?? null;
        this.updateClause = params.updateClause;
        this.setClause = params.setClause instanceof SetClause ? params.setClause : new SetClause(params.setClause);
        this.whereClause = params.whereClause ?? null;
        this.fromClause = params.fromClause ?? null;
        this.returningClause = params.returning ?? null;
    }
}
