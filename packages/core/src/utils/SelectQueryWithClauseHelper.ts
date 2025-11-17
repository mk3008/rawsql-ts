import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from '../models/SelectQuery';
import { WithClause } from '../models/Clause';

/**
 * Utility to manage WITH clause placement for statements that promote the
 * CTE definitions outside of the SELECT body (for example, INSERT).
 */
export class SelectQueryWithClauseHelper {
    public static getWithClause(selectQuery: SelectQuery | null): WithClause | null {
        const owner = this.findClauseOwner(selectQuery);
        if (!owner) {
            return null;
        }
        return owner.withClause;
    }

    public static setWithClause(selectQuery: SelectQuery, withClause: WithClause | null): void {
        const owner = this.findClauseOwner(selectQuery);
        if (!owner) {
            throw new Error("Cannot attach WITH clause to the provided select query.");
        }
        owner.withClause = withClause;
    }

    public static detachWithClause(selectQuery: SelectQuery): WithClause | null {
        const owner = this.findClauseOwner(selectQuery);
        if (!owner) {
            return null;
        }
        const clause = owner.withClause;
        owner.withClause = null;
        return clause;
    }

    private static findClauseOwner(selectQuery: SelectQuery | null): SimpleSelectQuery | ValuesQuery | null {
        if (!selectQuery) {
            return null;
        }
        if (selectQuery instanceof SimpleSelectQuery || selectQuery instanceof ValuesQuery) {
            return selectQuery;
        }
        if (selectQuery instanceof BinarySelectQuery) {
            return this.findClauseOwner(selectQuery.left);
        }
        throw new Error("Unsupported select query type for WITH clause management.");
    }
}
