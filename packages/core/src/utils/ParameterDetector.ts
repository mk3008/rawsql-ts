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

        for (const [key, value] of Object.entries(filter)) {
            if (hardcodedParamNames.includes(key)) {
                hardcodedParams[key] = value;
            } else {
                dynamicFilters[key] = value;
            }
        }

        return { hardcodedParams, dynamicFilters };
    }
}