import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { SelectableColumnCollector } from "./SelectableColumnCollector";
import { BinaryExpression, ParameterExpression } from "../models/ValueComponent";
import { UpstreamSelectQueryFinder } from "./UpstreamSelectQueryFinder";

/**
 * SqlParamInjector injects state parameters into a SelectQuery model,
 * creating WHERE conditions and setting parameter values.
 */
export class SqlParamInjector {
    /**
     * Injects parameters as WHERE conditions into the given query model.
     * @param query The SelectQuery to modify
     * @param state A record of parameter names and values
     * @returns The modified SelectQuery
     */
    public inject(query: SimpleSelectQuery, state: Record<string, any>): SelectQuery {
        const finder = new UpstreamSelectQueryFinder();
        const collector = new SelectableColumnCollector();

        for (const [name, value] of Object.entries(state)) {

            const queries = finder.find(query, name);
            if (queries.length === 0) {
                throw new Error(`Column '${name}' not found in query`);
            }

            for (const q of queries) {
                const columns = collector.collect(q);

                // Find the corresponding column reference
                const entry = columns.find(item => item.name === name);
                if (!entry) {
                    throw new Error(`Column '${name}' not found in query`);
                }
                const columnRef = entry.value;

                // Create a parameter expression and binary condition
                const paramExpr = new ParameterExpression(name);
                const condition = new BinaryExpression(columnRef, "=", paramExpr);

                q.appendWhere(condition);
                q.setParameter(name, value);
            }
        }

        return query;
    }
}
