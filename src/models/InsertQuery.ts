// Represents an INSERT query in SQL.
// Supports single/multi-row VALUES and INSERT ... SELECT.
import { SqlComponent } from "./SqlComponent";
import { SelectQuery } from "./SelectQuery";
import { InsertClause } from "./Clause";

export class InsertQuery extends SqlComponent {
    static kind = Symbol("InsertQuery");
    insertClause: InsertClause;
    selectQuery: SelectQuery | null;

    /**
     * @param params.insertClause InsertClause instance (target table and columns)
     * @param params.selectQuery SELECT/VALUES query (required)
     */
    constructor(params: {
        insertClause: InsertClause;
        selectQuery?: SelectQuery | null;
    }) {
        super();
        this.insertClause = params.insertClause;
        this.selectQuery = params.selectQuery ?? null;
    }
}