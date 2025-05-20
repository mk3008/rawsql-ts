import { SqlComponent, SqlComponentVisitor } from '../models/SqlComponent';
import { SimpleSelectQuery, BinarySelectQuery, SelectQuery } from '../models/SelectQuery';
import { SelectValueCollector } from './SelectValueCollector';
import { Formatter } from './Formatter';

/**
 * Options for JSONFormatter
 */
export interface JSONFormatterOptions {
    /**
     * Optional grouping configuration for nested JSON structure
     * Keys are group names, values are arrays of column names to include in that group
     */
    groupBy?: Record<string, string[]>;
    
    /**
     * Whether to use jsonb_agg (true) or json_agg (false)
     * @default true
     */
    useJsonb?: boolean;
}

/**
 * JSONFormatter transforms SQL queries to return JSON array results using PostgreSQL JSON functions.
 * This follows the pattern from CarbunqleX, wrapping column expressions with JSON conversion functions.
 */
export class JSONFormatter implements SqlComponentVisitor<string> {
    private options: JSONFormatterOptions;
    private formatter: Formatter;

    constructor(options: JSONFormatterOptions = {}) {
        this.options = {
            useJsonb: true,
            ...options
        };
        this.formatter = new Formatter();
    }

    /**
     * Main entry point for the visitor pattern.
     * @param arg The SQL component to visit.
     */
    public visit(arg: SqlComponent): string {
        if (arg instanceof SimpleSelectQuery) {
            return this.visitSimpleSelectQuery(arg);
        } else if (arg instanceof BinarySelectQuery) {
            throw new Error('JSON formatting for binary select queries (UNION, INTERSECT, EXCEPT) is not supported.');
        } else {
            // For other component types, delegate to the standard formatter
            return this.formatter.visit(arg);
        }
    }

    /**
     * Transforms a SimpleSelectQuery into a JSON-returning query
     * @param query The SimpleSelectQuery to transform
     */
    private visitSimpleSelectQuery(query: SimpleSelectQuery): string {
        // If we have grouping, create a more complex JSON structure
        if (this.options.groupBy) {
            return this.createNestedJsonQuery(query);
        }
        
        // Otherwise, create a simple flat JSON array
        return this.createFlatJsonQuery(query);
    }

    /**
     * Creates a flat JSON array structure from the select query
     */
    private createFlatJsonQuery(query: SimpleSelectQuery): string {
        // Collect all the columns
        const collector = new SelectValueCollector();
        query.accept(collector);
        const columns = collector.getValues();

        // Get the JSON function prefix
        const jsonPrefix = this.options.useJsonb ? 'jsonb' : 'json';
        
        // Create the SELECT part with JSON functions
        let sql = `SELECT COALESCE(${jsonPrefix}_agg(${jsonPrefix}_build_object(\n`;
        
        // Add each column to the build_object function
        const columnExpressions = columns.map(col => {
            const colName = col.name;
            // Use formatter to get the column expression
            const valueStr = this.formatter.visit(col.value);
            // Need to strip quotes for proper JSON property names
            return `  '${colName}', ${valueStr}`;
        }).join(',\n');
        
        sql += columnExpressions;
        sql += `\n)), '[]') AS result`;
        
        // Add FROM clause
        if (query.fromClause) {
            // Get the raw SQL text for the FROM clause
            let fromClauseText = this.formatter.visit(query.fromClause);
            // Remove any extra keywords that formatter may have added
            fromClauseText = fromClauseText.replace(/^from /i, '');
            sql += `\nFROM ${fromClauseText}`;
        }
        
        // Add WHERE clause if it exists
        if (query.whereClause) {
            // Get the raw SQL text for the WHERE clause
            let whereClauseText = this.formatter.visit(query.whereClause);
            // Remove any extra keywords that formatter may have added
            whereClauseText = whereClauseText.replace(/^where /i, '');
            sql += `\nWHERE ${whereClauseText}`;
        }
        
        // Add GROUP BY clause if it exists
        if (query.groupByClause) {
            // Get the raw SQL text for the GROUP BY clause
            let groupByClauseText = this.formatter.visit(query.groupByClause);
            // Remove any extra keywords that formatter may have added
            groupByClauseText = groupByClauseText.replace(/^group by /i, '');
            sql += `\nGROUP BY ${groupByClauseText}`;
        }
        
        // Add HAVING clause if it exists
        if (query.havingClause) {
            // Get the raw SQL text for the HAVING clause
            let havingClauseText = this.formatter.visit(query.havingClause);
            // Remove any extra keywords that formatter may have added
            havingClauseText = havingClauseText.replace(/^having /i, '');
            sql += `\nHAVING ${havingClauseText}`;
        }
        
        // Add ORDER BY clause if it exists
        if (query.orderByClause) {
            // Get the raw SQL text for the ORDER BY clause
            let orderByClauseText = this.formatter.visit(query.orderByClause);
            // Remove any extra keywords that formatter may have added
            orderByClauseText = orderByClauseText.replace(/^order by /i, '');
            sql += `\nORDER BY ${orderByClauseText}`;
        }
        
        // Add LIMIT clause if it exists
        if (query.limitClause) {
            // Get the raw SQL text for the LIMIT clause
            let limitClauseText = this.formatter.visit(query.limitClause);
            // Remove any extra keywords that formatter may have added
            limitClauseText = limitClauseText.replace(/^limit /i, '');
            sql += `\nLIMIT ${limitClauseText}`;
        }
        
        // Add OFFSET clause if it exists
        if (query.offsetClause) {
            // Get the raw SQL text for the OFFSET clause
            let offsetClauseText = this.formatter.visit(query.offsetClause);
            // Remove any extra keywords that formatter may have added
            offsetClauseText = offsetClauseText.replace(/^offset /i, '');
            sql += `\nOFFSET ${offsetClauseText}`;
        }
        
        return sql;
    }

    /**
     * Creates a nested JSON structure from the select query based on the groupBy option
     */
    private createNestedJsonQuery(query: SimpleSelectQuery): string {
        if (!this.options.groupBy) {
            throw new Error('groupBy is required for nested JSON structures');
        }

        // Collect all columns
        const collector = new SelectValueCollector();
        query.accept(collector);
        const allColumns = collector.getValues();
        
        // Get the JSON function prefix
        const jsonPrefix = this.options.useJsonb ? 'jsonb' : 'json';
        
        // Start building the query
        let sql = `SELECT COALESCE(${jsonPrefix}_agg(${jsonPrefix}_build_object(\n`;
        
        // Process each group
        const groups = Object.entries(this.options.groupBy);
        const topLevelColumns: string[] = [];
        const nestedGroups: string[] = [];
        
        // First, handle the root level columns
        // The first group defines the root level columns
        if (groups.length > 0) {
            const [_, rootColumns] = groups[0];
            
            // Add root level columns to the builder
            for (const rootCol of rootColumns) {
                const column = allColumns.find(col => col.name === rootCol);
                
                if (column) {
                    const valueStr = this.formatter.visit(column.value);
                    topLevelColumns.push(`  '${column.name}', ${valueStr}`);
                }
            }
        }
        
        // Then handle nested groups
        for (let i = 1; i < groups.length; i++) {
            const [groupName, groupColumns] = groups[i];
            
            // Create a subquery for the nested group
            let nestedQuery = `  '${groupName}', (\n    SELECT COALESCE(${jsonPrefix}_agg(${jsonPrefix}_build_object(\n`;
            
            // Add columns for this nested group
            const nestedColumnExpressions = groupColumns.map(colName => {
                const column = allColumns.find(col => col.name === colName);
                
                if (column) {
                    const valueStr = this.formatter.visit(column.value);
                    return `      '${column.name}', ${valueStr}`;
                }
                return '';
            }).filter(Boolean).join(',\n');
            
            nestedQuery += nestedColumnExpressions;
            
            // Close the nested query
            // The joining condition assumes a typical foreign key relationship
            // This might need to be customized based on actual data model
            const [rootGroupName] = groups[0];
            nestedQuery += `\n    )), '[]')\n    FROM ${groupName}\n    WHERE ${groupName}.${rootGroupName}_id = ${rootGroupName}.id\n  )`;
            
            nestedGroups.push(nestedQuery);
        }
        
        // Combine all column expressions
        const allExpressions = [...topLevelColumns, ...nestedGroups].join(',\n');
        sql += allExpressions;
        
        // Close the main JSON function
        sql += `\n)), '[]') AS result`;
        
        // Add the FROM clause using the root table name
        if (query.fromClause && groups.length > 0) {
            const [rootGroupName] = groups[0];
            sql += `\nFROM ${rootGroupName}`;
        } else if (query.fromClause) {
            // Get the raw SQL text for the FROM clause
            let fromClauseText = this.formatter.visit(query.fromClause);
            // Remove any extra keywords that formatter may have added
            fromClauseText = fromClauseText.replace(/^from /i, '');
            sql += `\nFROM ${fromClauseText}`;
        }
        
        // Add WHERE clause if it exists
        if (query.whereClause) {
            // Get the raw SQL text for the WHERE clause
            let whereClauseText = this.formatter.visit(query.whereClause);
            // Remove any extra keywords that formatter may have added
            whereClauseText = whereClauseText.replace(/^where /i, '');
            sql += `\nWHERE ${whereClauseText}`;
        }
        
        // Add GROUP BY clause if it exists
        if (query.groupByClause) {
            // Get the raw SQL text for the GROUP BY clause
            let groupByClauseText = this.formatter.visit(query.groupByClause);
            // Remove any extra keywords that formatter may have added
            groupByClauseText = groupByClauseText.replace(/^group by /i, '');
            sql += `\nGROUP BY ${groupByClauseText}`;
        }
        
        // Add HAVING clause if it exists
        if (query.havingClause) {
            // Get the raw SQL text for the HAVING clause
            let havingClauseText = this.formatter.visit(query.havingClause);
            // Remove any extra keywords that formatter may have added
            havingClauseText = havingClauseText.replace(/^having /i, '');
            sql += `\nHAVING ${havingClauseText}`;
        }
        
        // Add ORDER BY clause if it exists
        if (query.orderByClause) {
            // Get the raw SQL text for the ORDER BY clause
            let orderByClauseText = this.formatter.visit(query.orderByClause);
            // Remove any extra keywords that formatter may have added
            orderByClauseText = orderByClauseText.replace(/^order by /i, '');
            sql += `\nORDER BY ${orderByClauseText}`;
        }
        
        // Add LIMIT clause if it exists
        if (query.limitClause) {
            // Get the raw SQL text for the LIMIT clause
            let limitClauseText = this.formatter.visit(query.limitClause);
            // Remove any extra keywords that formatter may have added
            limitClauseText = limitClauseText.replace(/^limit /i, '');
            sql += `\nLIMIT ${limitClauseText}`;
        }
        
        return sql;
    }
}