import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { BinarySelectQuery } from "../models/BinarySelectQuery";
import { SelectableColumnCollector } from "./SelectableColumnCollector";
import { BinaryExpression, FunctionCall, ParameterExpression, ParenExpression, ValueComponent, ValueList, SqlParameterValue, ColumnReference } from "../models/ValueComponent";
import { UpstreamSelectQueryFinder } from "./UpstreamSelectQueryFinder";
import { SelectQueryParser } from "../parsers/SelectQueryParser";

/**
 * Options for SqlParamInjector
 */
export interface SqlParamInjectorOptions {
    /** Whether to ignore case and underscore differences when matching column names */
    ignoreCaseAndUnderscore?: boolean;
    /** Whether to allow injection when all parameters are undefined (defaults to false for safety) */
    allowAllUndefined?: boolean;
    /** Whether to skip column validation entirely (defaults to false for safety) */
    skipColumnValidation?: boolean;
}

// Type for state parameter values - can be simple values, conditions, or complex objects
export type StateParameterValue = SqlParameterValue | SqlParameterValue[] | Condition | OrCondition | AndCondition | ExplicitColumnMapping;

/**
 * SqlParamInjector injects state parameters into a SelectQuery model,
 * creating WHERE conditions and setting parameter values.
 */
export class SqlParamInjector {
    private tableColumnResolver?: (tableName: string) => string[];
    private options: SqlParamInjectorOptions;

    constructor(optionsOrResolver?: SqlParamInjectorOptions | ((tableName: string) => string[]), options?: SqlParamInjectorOptions) {
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
     * @throws Error when all parameters are undefined and allowAllUndefined is not set to true
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

        const allowedOps = ['min', 'max', 'like', 'ilike', 'in', 'any', '=', '<', '>', '!=', '<>', '<=', '>=', 'or', 'and', 'column'];

        // Check if all parameters are undefined
        const stateValues = Object.values(state);
        const hasParameters = stateValues.length > 0;
        const allUndefined = hasParameters && stateValues.every(value => value === undefined);
        
        if (allUndefined && !this.options.allowAllUndefined) {
            throw new Error('All parameters are undefined. This would result in fetching all records. Use allowAllUndefined: true option to explicitly allow this behavior.');
        }

        for (const [name, stateValue] of Object.entries(state)) {
            // skip undefined values
            if (stateValue === undefined) continue;

            this.processStateParameter(
                name, stateValue, query, finder, collector, normalize, allowedOps,
                injectOrConditions, injectAndConditions, injectSimpleCondition, injectComplexConditions, validateOperators
            );
        } function injectAndConditions(
            q: SimpleSelectQuery,
            baseName: string,
            andConditions: SingleCondition[],
            normalize: (s: string) => string,
            availableColumns: { name: string; value: ValueComponent }[],
            collector: SelectableColumnCollector
        ): void {
            // For AND conditions, we process each condition and add them all with AND logic
            for (let i = 0; i < andConditions.length; i++) {
                const andCondition = andConditions[i];
                const columnName = andCondition.column || baseName;

                // Find the target column
                const entry = availableColumns.find(item => normalize(item.name) === normalize(columnName));
                if (!entry) {
                    throw new Error(`Column '${columnName}' not found in query for AND condition`);
                }
                const columnRef = entry.value;

                // Process each operator in the AND condition
                if ('=' in andCondition && andCondition['='] !== undefined) {
                    const paramName = `${baseName}_and_${i}_eq`;
                    const paramExpr = new ParameterExpression(paramName, andCondition['=']);
                    q.appendWhere(new BinaryExpression(columnRef, "=", paramExpr));
                }
                if ('min' in andCondition && andCondition.min !== undefined) {
                    const paramName = `${baseName}_and_${i}_min`;
                    const paramExpr = new ParameterExpression(paramName, andCondition.min);
                    q.appendWhere(new BinaryExpression(columnRef, ">=", paramExpr));
                }
                if ('max' in andCondition && andCondition.max !== undefined) {
                    const paramName = `${baseName}_and_${i}_max`;
                    const paramExpr = new ParameterExpression(paramName, andCondition.max);
                    q.appendWhere(new BinaryExpression(columnRef, "<=", paramExpr));
                } if ('like' in andCondition && andCondition.like !== undefined) {
                    const paramName = `${baseName}_and_${i}_like`;
                    const paramExpr = new ParameterExpression(paramName, andCondition.like);
                    q.appendWhere(new BinaryExpression(columnRef, "like", paramExpr));
                }
                if ('ilike' in andCondition && andCondition.ilike !== undefined) {
                    const paramName = `${baseName}_and_${i}_ilike`;
                    const paramExpr = new ParameterExpression(paramName, andCondition.ilike);
                    q.appendWhere(new BinaryExpression(columnRef, "ilike", paramExpr));
                }
                if ('in' in andCondition && andCondition.in !== undefined) {
                    const arr = andCondition.in as (number | string)[];
                    const prms: ParameterExpression[] = arr.map((v, j) =>
                        new ParameterExpression(`${baseName}_and_${i}_in_${j}`, v)
                    );
                    q.appendWhere(new BinaryExpression(columnRef, "in", new ParenExpression(new ValueList(prms))));
                }
                if ('any' in andCondition && andCondition.any !== undefined) {
                    const paramName = `${baseName}_and_${i}_any`;
                    const paramExpr = new ParameterExpression(paramName, andCondition.any);
                    q.appendWhere(new BinaryExpression(columnRef, "=", new FunctionCall(null, "any", paramExpr, null)));
                }
                if ('<' in andCondition && andCondition['<'] !== undefined) {
                    const paramName = `${baseName}_and_${i}_lt`;
                    const paramExpr = new ParameterExpression(paramName, andCondition['<']);
                    q.appendWhere(new BinaryExpression(columnRef, "<", paramExpr));
                }
                if ('>' in andCondition && andCondition['>'] !== undefined) {
                    const paramName = `${baseName}_and_${i}_gt`;
                    const paramExpr = new ParameterExpression(paramName, andCondition['>']);
                    q.appendWhere(new BinaryExpression(columnRef, ">", paramExpr));
                }
                if ('!=' in andCondition && andCondition['!='] !== undefined) {
                    const paramName = `${baseName}_and_${i}_neq`;
                    const paramExpr = new ParameterExpression(paramName, andCondition['!=']);
                    q.appendWhere(new BinaryExpression(columnRef, "!=", paramExpr));
                }
                if ('<>' in andCondition && andCondition['<>'] !== undefined) {
                    const paramName = `${baseName}_and_${i}_ne`;
                    const paramExpr = new ParameterExpression(paramName, andCondition['<>']);
                    q.appendWhere(new BinaryExpression(columnRef, "<>", paramExpr));
                }
                if ('<=' in andCondition && andCondition['<='] !== undefined) {
                    const paramName = `${baseName}_and_${i}_le`;
                    const paramExpr = new ParameterExpression(paramName, andCondition['<=']);
                    q.appendWhere(new BinaryExpression(columnRef, "<=", paramExpr));
                }
                if ('>=' in andCondition && andCondition['>='] !== undefined) {
                    const paramName = `${baseName}_and_${i}_ge`;
                    const paramExpr = new ParameterExpression(paramName, andCondition['>=']);
                    q.appendWhere(new BinaryExpression(columnRef, ">=", paramExpr));
                }
            }
        }

        function injectOrConditions(
            q: SimpleSelectQuery,
            baseName: string,
            orConditions: SingleCondition[],
            normalize: (s: string) => string,
            availableColumns: { name: string; value: ValueComponent }[],
            collector: SelectableColumnCollector
        ): void {
            const orExpressions: ValueComponent[] = [];

            for (let i = 0; i < orConditions.length; i++) {
                const orCondition = orConditions[i];
                const columnName = orCondition.column || baseName;

                // Find the target column
                const entry = availableColumns.find(item => normalize(item.name) === normalize(columnName));
                if (!entry) {
                    throw new Error(`Column '${columnName}' not found in query for OR condition`);
                }
                const columnRef = entry.value;

                // Create conditions for this OR branch
                const branchConditions: ValueComponent[] = [];

                // Process each operator in the OR condition
                if ('=' in orCondition && orCondition['='] !== undefined) {
                    const paramName = `${baseName}_or_${i}_eq`;
                    const paramExpr = new ParameterExpression(paramName, orCondition['=']);
                    branchConditions.push(new BinaryExpression(columnRef, "=", paramExpr));
                }
                if ('min' in orCondition && orCondition.min !== undefined) {
                    const paramName = `${baseName}_or_${i}_min`;
                    const paramExpr = new ParameterExpression(paramName, orCondition.min);
                    branchConditions.push(new BinaryExpression(columnRef, ">=", paramExpr));
                }
                if ('max' in orCondition && orCondition.max !== undefined) {
                    const paramName = `${baseName}_or_${i}_max`;
                    const paramExpr = new ParameterExpression(paramName, orCondition.max);
                    branchConditions.push(new BinaryExpression(columnRef, "<=", paramExpr));
                } if ('like' in orCondition && orCondition.like !== undefined) {
                    const paramName = `${baseName}_or_${i}_like`;
                    const paramExpr = new ParameterExpression(paramName, orCondition.like);
                    branchConditions.push(new BinaryExpression(columnRef, "like", paramExpr));
                }
                if ('ilike' in orCondition && orCondition.ilike !== undefined) {
                    const paramName = `${baseName}_or_${i}_ilike`;
                    const paramExpr = new ParameterExpression(paramName, orCondition.ilike);
                    branchConditions.push(new BinaryExpression(columnRef, "ilike", paramExpr));
                }
                if ('in' in orCondition && orCondition.in !== undefined) {
                    const arr = orCondition.in as (number | string)[];
                    const prms: ParameterExpression[] = arr.map((v, j) =>
                        new ParameterExpression(`${baseName}_or_${i}_in_${j}`, v)
                    );
                    branchConditions.push(new BinaryExpression(columnRef, "in", new ParenExpression(new ValueList(prms))));
                }
                if ('any' in orCondition && orCondition.any !== undefined) {
                    const paramName = `${baseName}_or_${i}_any`;
                    const paramExpr = new ParameterExpression(paramName, orCondition.any);
                    branchConditions.push(new BinaryExpression(columnRef, "=", new FunctionCall(null, "any", paramExpr, null)));
                }
                if ('<' in orCondition && orCondition['<'] !== undefined) {
                    const paramName = `${baseName}_or_${i}_lt`;
                    const paramExpr = new ParameterExpression(paramName, orCondition['<']);
                    branchConditions.push(new BinaryExpression(columnRef, "<", paramExpr));
                }
                if ('>' in orCondition && orCondition['>'] !== undefined) {
                    const paramName = `${baseName}_or_${i}_gt`;
                    const paramExpr = new ParameterExpression(paramName, orCondition['>']);
                    branchConditions.push(new BinaryExpression(columnRef, ">", paramExpr));
                }
                if ('!=' in orCondition && orCondition['!='] !== undefined) {
                    const paramName = `${baseName}_or_${i}_neq`;
                    const paramExpr = new ParameterExpression(paramName, orCondition['!=']);
                    branchConditions.push(new BinaryExpression(columnRef, "!=", paramExpr));
                }
                if ('<>' in orCondition && orCondition['<>'] !== undefined) {
                    const paramName = `${baseName}_or_${i}_ne`;
                    const paramExpr = new ParameterExpression(paramName, orCondition['<>']);
                    branchConditions.push(new BinaryExpression(columnRef, "<>", paramExpr));
                }
                if ('<=' in orCondition && orCondition['<='] !== undefined) {
                    const paramName = `${baseName}_or_${i}_le`;
                    const paramExpr = new ParameterExpression(paramName, orCondition['<=']);
                    branchConditions.push(new BinaryExpression(columnRef, "<=", paramExpr));
                }
                if ('>=' in orCondition && orCondition['>='] !== undefined) {
                    const paramName = `${baseName}_or_${i}_ge`;
                    const paramExpr = new ParameterExpression(paramName, orCondition['>=']);
                    branchConditions.push(new BinaryExpression(columnRef, ">=", paramExpr));
                }

                // Combine branch conditions with AND if there are multiple
                if (branchConditions.length > 0) {
                    let branchExpr = branchConditions[0];
                    for (let j = 1; j < branchConditions.length; j++) {
                        branchExpr = new BinaryExpression(branchExpr, "and", branchConditions[j]);
                    }
                    // Wrap in parentheses if multiple conditions within the OR branch
                    if (branchConditions.length > 1) {
                        orExpressions.push(new ParenExpression(branchExpr));
                    } else {
                        orExpressions.push(branchExpr);
                    }
                }
            }

            // Combine OR expressions
            if (orExpressions.length > 0) {
                let finalOrExpr = orExpressions[0];
                for (let i = 1; i < orExpressions.length; i++) {
                    finalOrExpr = new BinaryExpression(finalOrExpr, "or", orExpressions[i]);
                }

                // Wrap in parentheses and append to WHERE clause
                q.appendWhere(new ParenExpression(finalOrExpr));
            }
        }

        function validateOperators(stateValue: object, allowedOps: string[], name: string): void {
            Object.keys(stateValue).forEach(op => {
                if (!allowedOps.includes(op)) {
                    throw new Error(`Unsupported operator '${op}' for state key '${name}'`);
                }
            });
        }

        function injectSimpleCondition(q: SimpleSelectQuery, columnRef: ValueComponent, name: string, stateValue: SqlParameterValue): void {
            const paramExpr = new ParameterExpression(name, stateValue);
            q.appendWhere(new BinaryExpression(columnRef, "=", paramExpr));
        } function injectComplexConditions(q: SimpleSelectQuery, columnRef: ValueComponent, name: string, stateValue: Condition): void {
            const conditions: ValueComponent[] = [];

            if ('=' in stateValue) {
                const paramEq = new ParameterExpression(name, stateValue['=']);
                conditions.push(new BinaryExpression(columnRef, "=", paramEq));
            }
            if ('min' in stateValue) {
                const paramMin = new ParameterExpression(name + "_min", stateValue.min);
                conditions.push(new BinaryExpression(columnRef, ">=", paramMin));
            }
            if ('max' in stateValue) {
                const paramMax = new ParameterExpression(name + "_max", stateValue.max);
                conditions.push(new BinaryExpression(columnRef, "<=", paramMax));
            } if ('like' in stateValue) {
                const paramLike = new ParameterExpression(name + "_like", stateValue.like);
                conditions.push(new BinaryExpression(columnRef, "like", paramLike));
            }
            if ('ilike' in stateValue) {
                const paramIlike = new ParameterExpression(name + "_ilike", stateValue.ilike);
                conditions.push(new BinaryExpression(columnRef, "ilike", paramIlike));
            }
            if ('in' in stateValue) {
                const arr = stateValue['in'] as (number | string)[];
                const prms: ParameterExpression[] = arr.map((v, i) =>
                    new ParameterExpression(`${name}_in_${i}`, v)
                );
                conditions.push(new BinaryExpression(columnRef, "in", new ParenExpression(new ValueList(prms))));
            }
            if ('any' in stateValue) {
                const paramAny = new ParameterExpression(name + "_any", stateValue.any);
                conditions.push(new BinaryExpression(columnRef, "=", new FunctionCall(null, "any", paramAny, null)));
            }
            if ('<' in stateValue) {
                const paramLT = new ParameterExpression(name + "_lt", stateValue['<']);
                conditions.push(new BinaryExpression(columnRef, "<", paramLT));
            }
            if ('>' in stateValue) {
                const paramGT = new ParameterExpression(name + "_gt", stateValue['>']);
                conditions.push(new BinaryExpression(columnRef, ">", paramGT));
            }
            if ('!=' in stateValue) {
                const paramNEQ = new ParameterExpression(name + "_neq", stateValue['!=']);
                conditions.push(new BinaryExpression(columnRef, "!=", paramNEQ));
            }
            if ('<>' in stateValue) {
                const paramNE = new ParameterExpression(name + "_ne", stateValue['<>']);
                conditions.push(new BinaryExpression(columnRef, "<>", paramNE));
            }
            if ('<=' in stateValue) {
                const paramLE = new ParameterExpression(name + "_le", stateValue['<=']);
                conditions.push(new BinaryExpression(columnRef, "<=", paramLE));
            }
            if ('>=' in stateValue) {
                const paramGE = new ParameterExpression(name + "_ge", stateValue['>=']);
                conditions.push(new BinaryExpression(columnRef, ">=", paramGE));
            }

            // Combine conditions with AND and wrap in parentheses if multiple conditions for clarity
            if (conditions.length === 1) {
                // Single condition - no parentheses needed
                q.appendWhere(conditions[0]);
            } else if (conditions.length > 1) {
                // Multiple conditions - combine with AND and wrap in parentheses for clarity
                let combinedExpr = conditions[0];
                for (let i = 1; i < conditions.length; i++) {
                    combinedExpr = new BinaryExpression(combinedExpr, "and", conditions[i]);
                }
                q.appendWhere(new ParenExpression(combinedExpr));
            }
        }

        return query;
    }

    /**
     * Type guard for OR conditions
     */
    private isOrCondition(value: unknown): value is { or: SingleCondition[] } {
        return value !== null && typeof value === 'object' && !Array.isArray(value) && 'or' in value;
    }

    /**
     * Type guard for AND conditions
     */
    private isAndCondition(value: unknown): value is { and: SingleCondition[] } {
        return value !== null && typeof value === 'object' && !Array.isArray(value) && 'and' in value;
    }

    /**
     * Type guard for explicit column mapping without OR
     */
    private isExplicitColumnMapping(value: unknown): value is { column: string } {
        return value !== null && typeof value === 'object' && !Array.isArray(value) && 
               'column' in value && !('or' in value);
    }

    /**
     * Type guard for objects that need operator validation
     */
    private isValidatableObject(value: unknown): value is object {
        return value !== null && typeof value === 'object' && !Array.isArray(value) && 
               Object.getPrototypeOf(value) === Object.prototype;
    }

    /**
     * Type guard for column mapping presence
     */
    private hasColumnMapping(value: unknown): value is { column?: string } {
        return value !== null && typeof value === 'object' && !Array.isArray(value) && 'column' in value;
    }

    /**
     * Type guard for simple values (non-object conditions)
     */
    private isSimpleValue(value: unknown): boolean {
        return value === null || typeof value !== 'object' || Array.isArray(value) || value instanceof Date;
    }

    /**
     * Processes a single state parameter
     */
    private processStateParameter(
        name: string,
        stateValue: StateParameterValue,
        query: SimpleSelectQuery,
        finder: UpstreamSelectQueryFinder,
        collector: SelectableColumnCollector,
        normalize: (s: string) => string,
        allowedOps: string[],
        injectOrConditions: Function,
        injectAndConditions: Function,
        injectSimpleCondition: Function,
        injectComplexConditions: Function,
        validateOperators: Function
    ): void {
        // Handle OR conditions specially - they don't need the main column to exist
        if (this.isOrCondition(stateValue)) {
            const orConditions = stateValue.or as SingleCondition[];
            if (orConditions && orConditions.length > 0) {
                const targetQuery = this.findTargetQueryForLogicalCondition(
                    finder, query, name, orConditions
                );
                const allColumns = this.getAllAvailableColumns(targetQuery, collector);
                injectOrConditions(targetQuery, name, orConditions, normalize, allColumns, collector);
                return;
            }
        }

        // Handle AND conditions specially - they don't need the main column to exist
        if (this.isAndCondition(stateValue)) {
            const andConditions = stateValue.and as SingleCondition[];
            if (andConditions && andConditions.length > 0) {
                const targetQuery = this.findTargetQueryForLogicalCondition(
                    finder, query, name, andConditions
                );
                const allColumns = this.getAllAvailableColumns(targetQuery, collector);
                injectAndConditions(targetQuery, name, andConditions, normalize, allColumns, collector);
                return;
            }
        }

        // Handle explicit column mapping without OR
        if (this.isExplicitColumnMapping(stateValue)) {
            const explicitColumnName = stateValue.column;
            if (explicitColumnName) {
                const queries = finder.find(query, explicitColumnName);
                if (queries.length === 0) {
                    throw new Error(`Explicit column '${explicitColumnName}' not found in query`);
                }

                for (const q of queries) {
                    const allColumns = this.getAllAvailableColumns(q, collector);
                    const entry = allColumns.find(item => normalize(item.name) === normalize(explicitColumnName));
                    if (!entry) {
                        throw new Error(`Explicit column '${explicitColumnName}' not found in query`);
                    }

                    // if object, validate its keys
                    if (this.isValidatableObject(stateValue)) {
                        validateOperators(stateValue, allowedOps, name);
                    }

                    injectComplexConditions(q, entry.value, name, stateValue);
                }
                return;
            }
        }

        // Handle regular column conditions
        this.processRegularColumnCondition(
            name, stateValue, query, finder, collector, normalize, allowedOps,
            injectSimpleCondition, injectComplexConditions, validateOperators
        );
    }

    /**
     * Processes regular column conditions (non-logical, non-explicit)
     */
    private processRegularColumnCondition(
        name: string,
        stateValue: StateParameterValue,
        query: SimpleSelectQuery,
        finder: UpstreamSelectQueryFinder,
        collector: SelectableColumnCollector,
        normalize: (s: string) => string,
        allowedOps: string[],
        injectSimpleCondition: Function,
        injectComplexConditions: Function,
        validateOperators: Function
    ): void {
        // Skip column validation if option is enabled
        if (this.options.skipColumnValidation) {
            // if object, validate its keys
            if (this.isValidatableObject(stateValue)) {
                validateOperators(stateValue, allowedOps, name);
            }
            
            // Create a column reference using the name directly
            const columnRef = new ColumnReference(null, name);
            
            // Handle complex conditions if needed
            if (this.isValidatableObject(stateValue)) {
                injectComplexConditions(query, columnRef, name, stateValue);
            } else {
                injectSimpleCondition(query, columnRef, name, stateValue);
            }
            return;
        }
        
        const queries = finder.find(query, name);
        if (queries.length === 0) {
            throw new Error(`Column '${name}' not found in query`);
        }

        for (const q of queries) {
            const allColumns = this.getAllAvailableColumns(q, collector);
            const entry = allColumns.find(item => normalize(item.name) === normalize(name));
            if (!entry) {
                throw new Error(`Column '${name}' not found in query`);
            }
            const columnRef = entry.value;
            
            // if object, validate its keys
            if (this.isValidatableObject(stateValue)) {
                validateOperators(stateValue, allowedOps, name);
            }

            // Handle explicit column mapping
            let targetColumn = columnRef;
            let targetColumnName = name;
            if (this.hasColumnMapping(stateValue)) {
                const explicitColumnName = stateValue.column;
                if (explicitColumnName) {
                    const explicitEntry = allColumns.find(item => normalize(item.name) === normalize(explicitColumnName));
                    if (explicitEntry) {
                        targetColumn = explicitEntry.value;
                        targetColumnName = explicitColumnName;
                    }
                }
            }

            if (this.isSimpleValue(stateValue)) {
                injectSimpleCondition(q, targetColumn, targetColumnName, stateValue);
            } else {
                injectComplexConditions(q, targetColumn, targetColumnName, stateValue);
            }
        }
    }

    /**
     * Finds target query for logical conditions (AND/OR)
     */
    private findTargetQueryForLogicalCondition(
        finder: UpstreamSelectQueryFinder,
        query: SimpleSelectQuery,
        baseName: string,
        conditions: SingleCondition[]
    ): SimpleSelectQuery {
        const referencedColumns = conditions
            .map(cond => cond.column || baseName)
            .filter((col, index, arr) => arr.indexOf(col) === index); // unique columns

        for (const colName of referencedColumns) {
            const queries = finder.find(query, colName);
            if (queries.length > 0) {
                return queries[0];
            }
        }

        const conditionType = conditions === (conditions as any).or ? 'OR' : 'AND';
        throw new Error(`None of the ${conditionType} condition columns [${referencedColumns.join(', ')}] found in query`);
    }

    /**
     * Collects all available columns from a query including CTE columns
     */
    private getAllAvailableColumns(
        query: SimpleSelectQuery, 
        collector: SelectableColumnCollector
    ): { name: string; value: ValueComponent }[] {
        const columns = collector.collect(query);
        const cteColumns = this.collectCTEColumns(query);
        return [...columns, ...cteColumns];
    }

    /**
     * Collects column names and references from CTE definitions
     */
    private collectCTEColumns(query: SimpleSelectQuery): { name: string; value: ValueComponent }[] {
        const cteColumns: { name: string; value: ValueComponent }[] = [];
        
        if (query.withClause) {
            for (const cte of query.withClause.tables) {
                try {
                    const columns = this.collectColumnsFromSelectQuery(cte.query);
                    cteColumns.push(...columns);
                } catch (error) {
                    // Log error but continue processing other CTEs
                    console.warn(`Failed to collect columns from CTE '${cte.getSourceAliasName()}':`, error);
                }
            }
        }
        
        return cteColumns;
    }

    /**
     * Recursively collects columns from any SelectQuery type
     */
    private collectColumnsFromSelectQuery(query: SelectQuery): { name: string; value: ValueComponent }[] {
        if (query instanceof SimpleSelectQuery) {
            const collector = new SelectableColumnCollector(this.tableColumnResolver);
            return collector.collect(query);
        } else if (query instanceof BinarySelectQuery) {
            // For UNION/INTERSECT/EXCEPT, columns from left side are representative
            // since both sides must have matching column structure
            return this.collectColumnsFromSelectQuery(query.left);
        }
        return [];
    }
}

// Define allowed condition keywords for state values
type BaseCondition = {
    '='?: number | string | boolean | Date;
    min?: number | string | Date;
    max?: number | string | Date;
    like?: string;
    ilike?: string;
    in?: (number | string | Date)[];
    any?: (number | string | Date)[];
    '<'?: number | string | Date;
    '>'?: number | string | Date;
    '!='?: number | string | boolean | Date;
    '<>'?: number | string | boolean | Date;
    '<='?: number | string | Date;
    '>='?: number | string | Date;
};

// Single condition with optional column mapping
type SingleCondition = BaseCondition & {
    column?: string;
};

// Logical grouping conditions
type LogicalCondition = {
    column?: string;
    and?: SingleCondition[];
    or?: SingleCondition[];
};

// Main condition type supporting all patterns
type Condition = BaseCondition | SingleCondition | LogicalCondition;

// OR condition type
type OrCondition = {
    or: SingleCondition[];
};

// AND condition type
type AndCondition = {
    and: SingleCondition[];
};

// Explicit column mapping type
type ExplicitColumnMapping = {
    column: string;
} & BaseCondition;