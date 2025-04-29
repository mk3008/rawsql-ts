// Represents an UPDATE query in SQL.
// Supports SET, WHERE, and optional FROM/RETURNING clauses.
import { SqlComponent } from "./SqlComponent";
import { IdentifierString, ValueComponent } from "./ValueComponent";
import { FromClause, ReturningClause, SetClause, WhereClause } from "./Clause";

export class UpdateQuery extends SqlComponent {
    static kind = Symbol("UpdateQuery");
    namespaces: IdentifierString[] | null;
    table: IdentifierString;
    setClause: SetClause;
    where: WhereClause | null;
    from: FromClause | null;
    returning: ReturningClause | null;

    /**
     * @param params.table Table name (string or IdentifierString)
     * @param params.setClause SetClause instance or array of {column, value} pairs
     * @param params.where WHERE clause (optional)
     * @param params.from FROM clause (optional)
     * @param params.returning RETURNING clause (optional)
     */
    constructor(params: {
        namespaces: (string | IdentifierString)[] | null;
        table: string | IdentifierString;
        setClause: SetClause | { column: string | IdentifierString, value: ValueComponent }[];
        where?: WhereClause | null;
        from?: FromClause | null;
        returning?: ReturningClause | null;
    }) {
        super();
        this.namespaces = params.namespaces
            ? params.namespaces.map(ns => typeof ns === "string" ? new IdentifierString(ns) : ns)
            : null;
        this.table = typeof params.table === "string" ? new IdentifierString(params.table) : params.table;
        this.setClause = params.setClause instanceof SetClause ? params.setClause : new SetClause(params.setClause);
        this.where = params.where ?? null;
        this.from = params.from ?? null;
        this.returning = params.returning ?? null;
    }
}
