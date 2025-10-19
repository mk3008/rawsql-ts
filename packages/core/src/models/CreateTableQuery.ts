import { SqlComponent } from "./SqlComponent";
import type { SelectQuery } from "./SelectQuery";
import { ColumnReference, FunctionCall, IdentifierString, RawString } from "./ValueComponent";
import { SimpleSelectQuery } from "./SimpleSelectQuery";
import { SelectClause, SelectItem, FromClause, TableSource, SourceExpression } from "./Clause";
import { SelectValueCollector } from "../transformers/SelectValueCollector";

// Represents a CREATE TABLE query model
// Supports temporary tables and AS SELECT ...
export class CreateTableQuery extends SqlComponent {
    /** SqlComponent kind symbol for visitor pattern */
    static kind = Symbol("CreateTableQuery");
    /** Table name (with optional schema) */
    tableName: IdentifierString;
    /** If true, this is a temporary table */
    isTemporary: boolean;
    /** If true, the statement includes IF NOT EXISTS */
    ifNotExists: boolean;
    /** Optional: SELECT query for AS SELECT ... */
    asSelectQuery?: SelectQuery;

    constructor(params: {
        tableName: string;
        isTemporary?: boolean;
        ifNotExists?: boolean;
        asSelectQuery?: SelectQuery;
    }) {
        super();
        this.tableName = new IdentifierString(params.tableName);
        this.isTemporary = params.isTemporary ?? false;
        this.ifNotExists = params.ifNotExists ?? false;
        this.asSelectQuery = params.asSelectQuery;
    }

    /**
     * Returns a SelectQuery that selects all columns from this table.
     */
    getSelectQuery(): SimpleSelectQuery {
        let selectItems: SelectItem[];
        if (this.asSelectQuery) {
            // Use SelectValueCollector to get columns from asSelectQuery
            const collector = new SelectValueCollector();
            const values = collector.collect(this.asSelectQuery);
            selectItems = values.map(val => new SelectItem(val.value, val.name));
        } else {
            // fallback: wildcard
            selectItems = [new SelectItem(new RawString("*"))];
        }
        return new SimpleSelectQuery({
            selectClause: new SelectClause(selectItems),
            fromClause: new FromClause(
                new SourceExpression(
                    new TableSource(null, this.tableName.name),
                    null
                ),
                null // joins
            ),
        });
    }

    /**
     * Returns a SelectQuery that counts all rows in this table.
     */
    getCountQuery(): SimpleSelectQuery {
        return new SimpleSelectQuery({
            selectClause: new SelectClause([
                new SelectItem(new FunctionCall(null, "count", new ColumnReference(null, "*"), null))
            ]),
            fromClause: new FromClause(
                new SourceExpression(
                    new TableSource(null, this.tableName.name),
                    null
                ),
                null // joins
            ),
        });
    }
}
