import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { SelectableColumnCollector } from "./SelectableColumnCollector";
import { BinaryExpression, FunctionCall, ParameterExpression, ParenExpression, ValueList } from "../models/ValueComponent";
import { UpstreamSelectQueryFinder } from "./UpstreamSelectQueryFinder";
import { SelectQueryParser } from "../parsers/SelectQueryParser";

/**
 * SqlParamInjector injects state parameters into a SelectQuery model,
 * creating WHERE conditions and setting parameter values.
 */
export class SqlParamInjector {
    private tableColumnResolver?: (tableName: string) => string[];
    private options: { ignoreCaseAndUnderscore?: boolean };

    constructor(optionsOrResolver?: { ignoreCaseAndUnderscore?: boolean } | ((tableName: string) => string[]), options?: { ignoreCaseAndUnderscore?: boolean }) {
        // Type-check to decide which argument was provided
        if (typeof optionsOrResolver === 'function') {
            this.tableColumnResolver = optionsOrResolver;
            this.options = options || {};
        } else {
            this.tableColumnResolver = undefined;
            this.options = optionsOrResolver || {};
        }
    }

    /**
     * Injects parameters as WHERE conditions into the given query model.
     * @param query The SelectQuery to modify
     * @param state A record of parameter names and values
     * @returns The modified SelectQuery
     */
    public inject(
        query: SimpleSelectQuery | string,
        state: Record<string, number | string | boolean | Date | null | undefined | Condition>
    ): SelectQuery {
        // Convert string query to SimpleSelectQuery using SelectQueryParser if needed
        if (typeof query === 'string') {
            query = SelectQueryParser.parse(query) as SimpleSelectQuery;
        }

        // Pass tableColumnResolver to finder and collector
        const finder = new UpstreamSelectQueryFinder(this.tableColumnResolver, this.options);
        const collector = new SelectableColumnCollector(this.tableColumnResolver);
        // Normalization is handled locally below.
        const normalize = (s: string) =>
            this.options.ignoreCaseAndUnderscore ? s.toLowerCase().replace(/_/g, '') : s;

        const allowedOps = ['min', 'max', 'like', 'in', 'any', '=', '<', '>', '!=', '<>', '<=', '>='];

        for (const [name, stateValue] of Object.entries(state)) {
            // skip undefined values
            if (stateValue === undefined) continue;

            const queries = finder.find(query, name);
            if (queries.length === 0) {
                throw new Error(`Column '${name}' not found in query`);
            }

            for (const q of queries) {
                const columns = collector.collect(q);
                const entry = columns.find(item => normalize(item.name) === normalize(name));
                if (!entry) {
                    throw new Error(`Column '${name}' not found in query`);
                }
                const columnRef = entry.value;

                // if object, validate its keys
                if (stateValue !== null && typeof stateValue === 'object' && !Array.isArray(stateValue)) {
                    Object.keys(stateValue).forEach(op => {
                        if (!allowedOps.includes(op)) {
                            throw new Error(`Unsupported operator '${op}' for state key '${name}'`);
                        }
                    });
                }

                if (
                    stateValue === null ||
                    typeof stateValue !== 'object' ||
                    Array.isArray(stateValue) ||
                    stateValue instanceof Date
                ) {
                    // use constructor to bind value
                    const paramExpr = new ParameterExpression(name, stateValue);
                    q.appendWhere(new BinaryExpression(columnRef, "=", paramExpr));
                } else {
                    // Explicit '=' operator support
                    if ('=' in stateValue) {
                        const paramEq = new ParameterExpression(name, stateValue['=']);
                        q.appendWhere(new BinaryExpression(columnRef, "=", paramEq));
                    }
                    else {
                        if ('min' in stateValue) {
                            const paramMin = new ParameterExpression(name + "_min", stateValue.min);
                            q.appendWhere(new BinaryExpression(columnRef, ">=", paramMin));
                        }
                        if ('max' in stateValue) {
                            const paramMax = new ParameterExpression(name + "_max", stateValue.max);
                            q.appendWhere(new BinaryExpression(columnRef, "<=", paramMax));
                        }
                        if ('like' in stateValue) {
                            const paramLike = new ParameterExpression(name + "_like", stateValue.like);
                            q.appendWhere(new BinaryExpression(columnRef, "like", paramLike));
                        }
                        // Additional condition for "in": expand array to individual parameters
                        if ('in' in stateValue) {
                            const arr = stateValue['in'] as (number | string)[];
                            const prms: ParameterExpression[] = arr.map((v, i) =>
                                new ParameterExpression(`${name}_in_${i}`, v)
                            );
                            q.appendWhere(new BinaryExpression(columnRef, "in", new ParenExpression(new ValueList(prms))));
                        }
                        if ('any' in stateValue) {
                            const paramAny = new ParameterExpression(name + "_any", stateValue.any);
                            q.appendWhere(new BinaryExpression(columnRef, "=", new FunctionCall(null, "any", paramAny, null)));
                        }
                        if ('<' in stateValue) {
                            const paramLT = new ParameterExpression(name + "_lt", stateValue['<']);
                            q.appendWhere(new BinaryExpression(columnRef, "<", paramLT));
                        }
                        if ('>' in stateValue) {
                            const paramGT = new ParameterExpression(name + "_gt", stateValue['>']);
                            q.appendWhere(new BinaryExpression(columnRef, ">", paramGT));
                        }
                        if ('!=' in stateValue) {
                            const paramNEQ = new ParameterExpression(name + "_neq", stateValue['!=']);
                            q.appendWhere(new BinaryExpression(columnRef, "!=", paramNEQ));
                        }
                        if ('<>' in stateValue) {
                            const paramNE = new ParameterExpression(name + "_ne", stateValue['<>']);
                            q.appendWhere(new BinaryExpression(columnRef, "<>", paramNE));
                        }
                        if ('<=' in stateValue) {
                            const paramLE = new ParameterExpression(name + "_le", stateValue['<=']);
                            q.appendWhere(new BinaryExpression(columnRef, "<=", paramLE));
                        }
                        if ('>=' in stateValue) {
                            const paramGE = new ParameterExpression(name + "_ge", stateValue['>=']);
                            q.appendWhere(new BinaryExpression(columnRef, ">=", paramGE));
                        }
                    }
                }
            }
        }

        return query;
    }
}

// Define allowed condition keywords for state values (single declaration)
type Condition = {
    '='?: number | string | boolean | Date;
    min?: number | string | Date;
    max?: number | string | Date;
    like?: string;
    in?: (number | string | Date)[];
    any?: (number | string | Date)[];
    '<'?: number | string | Date;
    '>'?: number | string | Date;
    '!='?: number | string | boolean | Date;
    '<>'?: number | string | boolean | Date;
    '<='?: number | string | Date;
    '>='?: number | string | Date;
};