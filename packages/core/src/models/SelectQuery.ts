import { SqlComponent } from "./SqlComponent";
import { InsertQuery } from "./InsertQuery";
import { SimpleSelectQuery } from "./SimpleSelectQuery";
import { BinarySelectQuery } from "./BinarySelectQuery";
import { ValuesQuery } from "./ValuesQuery";
import { SqlParameterValue } from "./ValueComponent";
import { UpdateQuery } from "./UpdateQuery";
import { DeleteQuery } from "./DeleteQuery";
import { MergeQuery } from "./MergeQuery";

/**
 * Options that control how a Common Table Expression is materialized when the query is executed.
 *
 * @example
 * ```typescript
 * const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
 * const cte = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
 *
 * mainQuery.addCTE('active_accounts', cte, { materialized: true });
 * ```
 * Related tests: packages/core/tests/models/SelectQuery.cte-management.test.ts
 */
export interface CTEOptions {
    materialized?: boolean | null;
}

export { DuplicateCTEError, InvalidCTENameError, CTENotFoundError } from './CTEError';

/**
 * Fluent API for managing Common Table Expressions on a select query.
 *
 * Implementations are expected to surface the same error behaviour exercised in
 * packages/core/tests/models/SelectQuery.cte-management.test.ts.
 */
export interface CTEManagement {
    addCTE(name: string, query: SelectQuery, options?: CTEOptions): this;
    removeCTE(name: string): this;
    hasCTE(name: string): boolean;
    getCTENames(): string[];
    replaceCTE(name: string, query: SelectQuery, options?: CTEOptions): this;
}

export interface InsertQueryConversionOptions {
    target: string;
    columns?: string[];
}

export interface UpdateQueryConversionOptions {
    target: string;
    primaryKeys: string | string[];
    columns?: string[];
    sourceAlias?: string;
}

export interface DeleteQueryConversionOptions {
    target: string;
    primaryKeys: string | string[];
    columns?: string[];
    sourceAlias?: string;
}

export type MergeMatchedAction = "update" | "delete" | "doNothing";
export type MergeNotMatchedAction = "insert" | "doNothing";
export type MergeNotMatchedBySourceAction = "delete" | "doNothing";

export interface MergeQueryConversionOptions {
    target: string;
    primaryKeys: string | string[];
    updateColumns?: string[];
    insertColumns?: string[];
    sourceAlias?: string;
    matchedAction?: MergeMatchedAction;
    notMatchedAction?: MergeNotMatchedAction;
    notMatchedBySourceAction?: MergeNotMatchedBySourceAction;
}

/**
 * Shared interface implemented by all select query variants.
 *
 * @example
 * ```typescript
 * const query = SelectQueryParser.parse('WITH active_users AS (SELECT * FROM users)');
 * query.setParameter('tenantId', 42);
 * const simple = query.toSimpleQuery();
 * ```
 * Related tests: packages/core/tests/models/SelectQuery.toSimpleQuery.test.ts
 */
export interface SelectQuery extends SqlComponent {
    readonly __selectQueryType: 'SelectQuery'; // Discriminator property for type safety
    headerComments: string[] | null;
    setParameter(name: string, value: SqlParameterValue): this;
    toSimpleQuery(): SimpleSelectQuery;
    toInsertQuery(options: InsertQueryConversionOptions): InsertQuery;
    toUpdateQuery(options: UpdateQueryConversionOptions): UpdateQuery;
    toDeleteQuery(options: DeleteQueryConversionOptions): DeleteQuery;
    toMergeQuery(options: MergeQueryConversionOptions): MergeQuery;
}
export {
    SimpleSelectQuery,
    BinarySelectQuery,
    ValuesQuery,
    InsertQuery,
    UpdateQuery,
    DeleteQuery,
    MergeQuery
};
