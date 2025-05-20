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

        for (const [name, stateValue] of Object.entries(state)) {

            const queries = finder.find(query, name);
            if (queries.length === 0) {
                throw new Error(`Column '${name}' not found in query`);
            }

            for (const q of queries) {
                const columns = collector.collect(q);
                const entry = columns.find(item => item.name === name);
                if (!entry) {
                    throw new Error(`Column '${name}' not found in query`);
                }
                const columnRef = entry.value;

                // Check if stateValue is primitive or an object with operators
                if (stateValue === null || typeof stateValue !== 'object' || Array.isArray(stateValue)) {
                    const paramExpr = new ParameterExpression(name);
                    const condition = new BinaryExpression(columnRef, "=", paramExpr);
                    q.appendWhere(condition);
                    q.setParameter(name, stateValue);
                } else {
                    const conditions = [];
                    if ('min' in stateValue) {
                        const paramMin = new ParameterExpression(name + "_min");
                        const condMin = new BinaryExpression(columnRef, ">=", paramMin);
                        conditions.push({ key: name + "_min", value: stateValue.min, condition: condMin });
                    }
                    if ('max' in stateValue) {
                        const paramMax = new ParameterExpression(name + "_max");
                        const condMax = new BinaryExpression(columnRef, "<=", paramMax);
                        conditions.push({ key: name + "_max", value: stateValue.max, condition: condMax });
                    }
                    if ('like' in stateValue) {
                        const paramLike = new ParameterExpression(name);
                        const likeCond = new BinaryExpression(columnRef, "LIKE", paramLike);
                        conditions.push({ key: name, value: stateValue.like, condition: likeCond });
                    }
                    if (conditions.length === 0) {
                        // fallback to equals
                        const paramExpr = new ParameterExpression(name);
                        const condition = new BinaryExpression(columnRef, "=", paramExpr);
                        conditions.push({ key: name, value: stateValue, condition });
                    }
                    for (const condObj of conditions) {
                        q.appendWhere(condObj.condition);
                        q.setParameter(condObj.key, condObj.value);
                    }
                }
            }
        }

        return query;
    }
}
