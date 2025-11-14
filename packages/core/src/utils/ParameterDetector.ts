import { BinaryExpression, ColumnReference, ParameterExpression } from "../models/ValueComponent";
import { ParameterCollector } from "../transformers/ParameterCollector";
import { SqlComponent } from "../models/SqlComponent";

/**
 * Utility class for detecting hardcoded parameters in SQL queries.
 * 
 * This class helps identify existing ParameterExpression nodes in parsed SQL,
 * which represent hardcoded parameters like :param_name in the original SQL.
 */
export class ParameterDetector {
    /**
     * Extracts all hardcoded parameter names from a parsed SQL query.
     * @param query The parsed SQL query (must be a SqlComponent)
     * @returns Array of parameter names found in the query
     */
    public static extractParameterNames(query: SqlComponent): string[] {
        const params = ParameterCollector.collect(query);
        return params.map(p => p.name.value);
    }

    /**
     * Checks if a parameter with the given name exists in the query.
     * @param query The parsed SQL query (must be a SqlComponent)
     * @param parameterName The parameter name to check
     * @returns True if the parameter exists, false otherwise
     */
    public static hasParameter(query: SqlComponent, parameterName: string): boolean {
        const paramNames = this.extractParameterNames(query);
        return paramNames.includes(parameterName);
    }

    /**
     * Separates filter options into hardcoded parameters and dynamic column filters.
     * @param query The parsed SQL query (must be a SqlComponent)
     * @param filter The filter object from DynamicQueryBuilder options
     * @returns Object with separated hardcoded and dynamic filters
     */
    public static separateFilters(query: SqlComponent, filter: Record<string, any>): {
        hardcodedParams: Record<string, any>;
        dynamicFilters: Record<string, any>;
    } {
        const hardcodedParamNames = this.extractParameterNames(query);
        const hardcodedParams: Record<string, any> = {};
        const dynamicFilters: Record<string, any> = {};

        // Build column-to-parameter associations so positional placeholders can be tracked by column name.
        const columnParamMap = this.collectColumnParameterMap(query);

        for (const [key, value] of Object.entries(filter)) {
            const paramName = hardcodedParamNames.includes(key)
                ? key
                : columnParamMap.get(key);

            if (paramName) {
                hardcodedParams[paramName] = value;
            } else {
                dynamicFilters[key] = value;
            }
        }

        const missingParams = hardcodedParamNames.filter(name => !(name in hardcodedParams));
        if (missingParams.length > 0) {
            const toPlaceholder = (name: string): string =>
                /^[0-9]+$/.test(name) ? `$${name}` : `:${name}`;
            const placeholderList = missingParams.map(toPlaceholder).join(', ');
            throw new Error(
                `Missing values for hardcoded placeholders (${placeholderList}). ` +
                    'Provide each placeholder (e.g., via the filter object) or remove the placeholder from the SQL; expressions such as arithmetic/function calls still leave the placeholder active, so its value must be supplied explicitly.'
            );
        }

        return { hardcodedParams, dynamicFilters };
    }

    private static collectColumnParameterMap(query: SqlComponent): Map<string, string> {
        const map = new Map<string, string>();
        const visited = new Set<object>();

        const recordMapping = (columnCandidate: any, parameterCandidate: any): void => {
            if (!columnCandidate || !parameterCandidate) {
                return;
            }

            if (
                columnCandidate.constructor?.kind === ColumnReference.kind &&
                parameterCandidate.constructor?.kind === ParameterExpression.kind
            ) {
                const column = columnCandidate as ColumnReference;
                const parameter = parameterCandidate as ParameterExpression;
                const names = this.buildColumnNameVariants(column);
                const targetName = parameter.name?.value;
                if (!targetName) {
                    return;
                }

                for (const columnName of names) {
                    if (!map.has(columnName)) {
                        map.set(columnName, targetName);
                    }
                }
            }
        };

        const walk = (node: any): void => {
            if (!node || typeof node !== "object" || visited.has(node)) {
                return;
            }

            visited.add(node);

            if (node.constructor?.kind === BinaryExpression.kind) {
                const binary = node as BinaryExpression;
                const comparisonOperators = new Set(['=', '==', '!=', '<>', '>=', '<=', '>', '<']);
                const operatorValue = binary.operator?.value?.trim().toLowerCase();
                if (operatorValue && comparisonOperators.has(operatorValue)) {
                    // Explore each binary comparison to find where columns meet parameters.
                    recordMapping(binary.left, binary.right);
                    recordMapping(binary.right, binary.left);
                }
            }

            for (const child of Object.values(node)) {
                if (Array.isArray(child)) {
                    child.forEach(walk);
                } else {
                    walk(child);
                }
            }
        };

        walk(query);
        return map;
    }

    private static buildColumnNameVariants(column: ColumnReference): string[] {
        const names = new Set<string>();
        const baseName = column.column?.name?.trim();

        if (baseName) {
            names.add(baseName);
        }

        const namespace = column.getNamespace();
        if (namespace && baseName) {
            names.add(`${namespace}.${baseName}`);
        }

        const qualified = column.toString();
        if (qualified) {
            names.add(qualified);
        }

        return Array.from(names);
    }
}
