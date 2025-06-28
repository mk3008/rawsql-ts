import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { ParameterHelper } from "../utils/ParameterHelper";
import { ParameterDetector } from "../utils/ParameterDetector";
import { QueryBuilder } from "./QueryBuilder";

/**
 * Options for SqlParameterBinder
 */
export interface SqlParameterBinderOptions {
    /** Whether to throw an error if a parameter value is missing (defaults to true) */
    requireAllParameters?: boolean;
}

/**
 * SqlParameterBinder binds values to existing hardcoded parameters in SQL queries.
 * 
 * This transformer is designed to work with SQL queries that already contain
 * parameter placeholders (e.g., :param_name) and bind actual values to them.
 * 
 * Unlike SqlParamInjector which creates new WHERE conditions, this transformer
 * only sets values for parameters that already exist in the parsed SQL.
 */
export class SqlParameterBinder {
    private options: SqlParameterBinderOptions;

    constructor(options: SqlParameterBinderOptions = {}) {
        this.options = {
            requireAllParameters: true,
            ...options
        };
    }

    /**
     * Binds values to existing hardcoded parameters in the query.
     * @param query The SelectQuery to modify
     * @param parameterValues A record of parameter names and values to bind
     * @returns The modified SelectQuery with parameter values set
     * @throws Error when required parameters are missing values
     */
    public bind(
        query: SelectQuery,
        parameterValues: Record<string, any>
    ): SelectQuery {
        // Work directly with the query (ParameterHelper modifies in place)
        // This is consistent with other transformers in the codebase
        const modifiedQuery = query;

        // Get all existing parameter names from the query
        const existingParams = ParameterDetector.extractParameterNames(modifiedQuery);

        // Validate that all parameters have values if required
        if (this.options.requireAllParameters) {
            const missingParams = existingParams.filter(paramName => 
                !(paramName in parameterValues) || parameterValues[paramName] === undefined
            );
            
            if (missingParams.length > 0) {
                throw new Error(`Missing values for required parameters: ${missingParams.join(', ')}`);
            }
        }

        // Bind values to existing parameters
        for (const [paramName, value] of Object.entries(parameterValues)) {
            if (existingParams.includes(paramName)) {
                try {
                    ParameterHelper.set(modifiedQuery, paramName, value);
                } catch (error) {
                    // ParameterHelper.set throws if parameter not found, but we already checked
                    // This should not happen, but include for safety
                    throw new Error(`Failed to bind parameter '${paramName}': ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            // Silently ignore parameters that don't exist in the query
            // (these might be intended for other transformers like SqlParamInjector)
        }

        return modifiedQuery;
    }

    /**
     * Convenience method to bind parameters to a SimpleSelectQuery.
     * @param query The SimpleSelectQuery to modify
     * @param parameterValues A record of parameter names and values to bind
     * @returns The modified SelectQuery with parameter values set
     */
    public bindToSimpleQuery(
        query: SimpleSelectQuery,
        parameterValues: Record<string, any>
    ): SelectQuery {
        return this.bind(query, parameterValues);
    }
}