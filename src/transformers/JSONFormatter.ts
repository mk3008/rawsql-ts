import { SqlComponent, SqlComponentVisitor } from '../models/SqlComponent';
import { SimpleSelectQuery, BinarySelectQuery, SelectQuery } from '../models/SelectQuery';
import { SelectItem } from '../models/Clause';
import { ColumnReference, ValueComponent } from '../models/ValueComponent';
import { SelectValueCollector } from './SelectValueCollector';

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

    constructor(options: JSONFormatterOptions = {}) {
        this.options = {
            useJsonb: true,
            ...options
        };
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
            throw new Error(`Unsupported SQL component type: ${arg.constructor.name}`);
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
            return `  '${colName}', ${this.getColumnExpression(col.value)}`;
        }).join(',\n');
        
        sql += columnExpressions;
        sql += `\n)), '[]') AS result`;
        
        // Add FROM clause and the rest of the query
        if (query.fromClause) {
            sql += `\nFROM ${query.fromClause.toSqlString(this)}`;
        }
        
        // Add WHERE clause if it exists
        if (query.whereClause) {
            sql += `\nWHERE ${query.whereClause.toSqlString(this)}`;
        }
        
        // Add GROUP BY clause if it exists
        if (query.groupByClause) {
            sql += `\nGROUP BY ${query.groupByClause.toSqlString(this)}`;
        }
        
        // Add HAVING clause if it exists
        if (query.havingClause) {
            sql += `\nHAVING ${query.havingClause.toSqlString(this)}`;
        }
        
        // Add ORDER BY clause if it exists
        if (query.orderByClause) {
            sql += `\nORDER BY ${query.orderByClause.toSqlString(this)}`;
        }
        
        // Add LIMIT and OFFSET clauses if they exist
        if (query.limitClause) {
            sql += `\nLIMIT ${query.limitClause.toSqlString(this)}`;
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
                    topLevelColumns.push(`  '${column.name}', ${this.getColumnExpression(column.value)}`);
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
                    return `      '${column.name}', ${this.getColumnExpression(column.value, true)}`;
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
            sql += `\nFROM ${query.fromClause.toSqlString(this)}`;
        }
        
        // Add WHERE clause if it exists
        if (query.whereClause) {
            sql += `\nWHERE ${query.whereClause.toSqlString(this)}`;
        }
        
        // Add any remaining clauses
        if (query.groupByClause) {
            sql += `\nGROUP BY ${query.groupByClause.toSqlString(this)}`;
        }
        
        if (query.havingClause) {
            sql += `\nHAVING ${query.havingClause.toSqlString(this)}`;
        }
        
        if (query.orderByClause) {
            sql += `\nORDER BY ${query.orderByClause.toSqlString(this)}`;
        }
        
        if (query.limitClause) {
            sql += `\nLIMIT ${query.limitClause.toSqlString(this)}`;
        }
        
        return sql;
    }

    /**
     * Helper method to get the column expression for the JSON output
     */
    private getColumnExpression(column: ValueComponent, nested: boolean = false): string {
        if (column instanceof ColumnReference) {
            // If it's a column reference, return it with proper formatting
            const namespace = column.getNamespace();
            const columnName = column.qualifiedName.name.toString();
            
            if (namespace) {
                return nested ? `"${columnName}"` : `"${namespace}"."${columnName}"`;
            }
            return `"${columnName}"`;
        } else {
            // For more complex expressions, use the column's SQL representation
            return column.toSqlString(this);
        }
    }
}