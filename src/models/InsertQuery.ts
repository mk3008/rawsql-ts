// filepath: src/models/InsertQuery.ts
// Represents an INSERT query in SQL.
// Supports single/multi-row VALUES and INSERT ... SELECT.
import { SqlComponent } from "./SqlComponent";
import { IdentifierString, ValueComponent } from "./ValueComponent";
import { SelectQuery } from "./SelectQuery";

export class InsertQuery extends SqlComponent {
    static kind = Symbol("InsertQuery");
    table: IdentifierString;
    columns: IdentifierString[];
    selectQuery: SelectQuery | null;

    /**
     * @param params.table Table name (string or IdentifierString)
     * @param params.columns Array of column names (string[] or IdentifierString[])
     * @param params.selectQuery SELECT/VALUES query (required)
     */
    constructor(params: {
        table: string | IdentifierString,
        columns: (string | IdentifierString)[],
        selectQuery?: SelectQuery | null
    }) {
        super();
        this.table = typeof params.table === "string" ? new IdentifierString(params.table) : params.table;
        this.columns = params.columns.map(c => typeof c === "string" ? new IdentifierString(c) : c);
        this.selectQuery = params.selectQuery ?? null;
    }
}
