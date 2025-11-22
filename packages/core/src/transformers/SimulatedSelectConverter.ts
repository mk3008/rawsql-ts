import { SqlComponent } from '../models/SqlComponent';
import { InsertQuery } from '../models/InsertQuery';
import { UpdateQuery } from '../models/UpdateQuery';
import { DeleteQuery } from '../models/DeleteQuery';
import { MergeQuery } from '../models/MergeQuery';
import { CreateTableQuery } from '../models/CreateTableQuery';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { BinarySelectQuery } from '../models/BinarySelectQuery';
import { ValuesQuery } from '../models/ValuesQuery';
import { InsertResultSelectConverter, InsertResultSelectOptions } from './InsertResultSelectConverter';
import { UpdateResultSelectConverter, UpdateResultSelectOptions } from './UpdateResultSelectConverter';
import { DeleteResultSelectConverter, DeleteResultSelectOptions } from './DeleteResultSelectConverter';
import { MergeResultSelectConverter, MergeResultSelectOptions } from './MergeResultSelectConverter';
import { SelectResultSelectConverter, SelectResultSelectOptions } from './SelectResultSelectConverter';

export type SimulatedSelectOptions =
    & InsertResultSelectOptions
    & UpdateResultSelectOptions
    & DeleteResultSelectOptions
    & MergeResultSelectOptions
    & SelectResultSelectOptions;

export class SimulatedSelectConverter {
    /**
     * Converts a SQL statement into a simulated SELECT statement for previewing results.
     * 
     * Rules:
     * 1. INSERT/UPDATE/DELETE/MERGE: Converted to SELECT statement showing affected rows.
     * 2. SELECT: Preserved as is (with fixtures injected).
     * 3. CREATE TEMPORARY TABLE ... AS SELECT: Preserved as is (with fixtures injected into inner SELECT).
     * 4. Other DDL (CREATE TABLE, DROP, ALTER, etc.): Ignored (returns null).
     * 
     * @param ast The SQL component to convert
     * @param options Options for conversion (fixtures, table definitions, etc.)
     * @returns The converted SqlComponent or null if the statement should be ignored.
     */
    public static convert(ast: SqlComponent, options?: SimulatedSelectOptions): SqlComponent | null {
        if (ast instanceof InsertQuery) {
            return InsertResultSelectConverter.toSelectQuery(ast, options);
        }
        if (ast instanceof UpdateQuery) {
            return UpdateResultSelectConverter.toSelectQuery(ast, options);
        }
        if (ast instanceof DeleteQuery) {
            return DeleteResultSelectConverter.toSelectQuery(ast, options);
        }
        if (ast instanceof MergeQuery) {
            return MergeResultSelectConverter.toSelectQuery(ast, options);
        }

        if (ast instanceof SimpleSelectQuery || ast instanceof BinarySelectQuery || ast instanceof ValuesQuery) {
            // Use SelectResultSelectConverter to inject fixtures
            return SelectResultSelectConverter.toSelectQuery(ast, options);
        }

        if (ast instanceof CreateTableQuery) {
            // Allow CreateTemporaryTableAsSelect
            if (ast.isTemporary && ast.asSelectQuery) {
                // Inject fixtures into the inner select query
                // Note: We modify the AST in place as SelectResultSelectConverter does
                const processedSelect = SelectResultSelectConverter.toSelectQuery(ast.asSelectQuery, options);
                ast.asSelectQuery = processedSelect;
                return ast;
            }
            // Ignore other Create Table statements
            return null;
        }

        // Ignore all other statements (DDL, etc.)
        return null;
    }
}
