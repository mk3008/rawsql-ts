import { describe, it, expect, beforeAll } from 'vitest';
import { RawSQLTodoRepository } from '../infrastructure/rawsql-infrastructure';
import { TodoSearchCriteria } from '../contracts/search-criteria';
import { QueryBuildResult } from '../contracts/repository-interfaces';
import { TodoStatus, TodoPriority } from '../domain/entities';

// Debug-friendly SQL formatting for testing
const debugSqlStyle = {
    identifierEscape: {
        start: "\"",
        end: "\""
    },
    parameterSymbol: "$",
    parameterStyle: "indexed" as const,
    indentSize: 4,
    indentChar: " " as const,
    newline: "\n" as const,
    keywordCase: "lower" as const,
    commaBreak: "before" as const,
    andBreak: "before" as const
};

/**
 * Dynamic SQL Generation Tests
 * 
 * What this test guarantees:
 * 1. Dynamic SQL generation works correctly for representative criteria patterns
 * 2. Generated SQL matches expected full output (complete program validation)
 * 3. Parameter binding is correct and prevents SQL injection
 * 4. Three main patterns: no criteria, single criteria, multiple criteria
 */
describe('Dynamic SQL Generation', () => {
    let repository: RawSQLTodoRepository;

    beforeAll(() => {
        // Initialize repository with debug-friendly SQL formatting for testing
        repository = new RawSQLTodoRepository(false, debugSqlStyle);
    });

    describe('buildSearchQuery - Full SQL Comparison', () => {
        it('should generate correct SQL for no search criteria', () => {
            // Pattern 1: No search criteria - base query only
            const emptyCriteria: TodoSearchCriteria = {};

            const result = repository.buildSearchQuery(emptyCriteria);

            // Expected base query without WHERE clause (based on actual output)
            const expectedSql = `select
    "todo_id"
    , "title"
    , "description"
    , "status"
    , "priority"
    , "category_id"
    , "created_at"
    , "updated_at"
from
    "todo"
order by
    case "priority"
        when 'high' then
            1
        when 'medium' then
            2
        when 'low' then
            3
    end
    , "created_at" desc`;

            expect(result.formattedSql.trim()).toBe(expectedSql.trim());
            expect(result.params).toEqual([]); // No parameters for empty criteria
        }); it('should generate correct SQL for single search criteria', () => {
            // Pattern 2: Single criteria - WHERE clause with one condition
            const titleCriteria: TodoSearchCriteria = {
                title: 'project'
            };

            const result = repository.buildSearchQuery(titleCriteria);

            // Expected query with WHERE clause for title (based on actual output)
            const expectedSql = `select
    "todo_id"
    , "title"
    , "description"
    , "status"
    , "priority"
    , "category_id"
    , "created_at"
    , "updated_at"
from
    "todo"
where
    "title" like $1
order by
    case "priority"
        when 'high' then
            1
        when 'medium' then
            2
        when 'low' then
            3
    end
    , "created_at" desc`;

            expect(result.formattedSql.trim()).toBe(expectedSql.trim());
            expect(result.params).toEqual(['%project%']);
        }); it('should generate correct SQL for multiple search criteria', () => {
            // Pattern 3: Multiple criteria - WHERE clause with multiple conditions
            const multipleCriteria: TodoSearchCriteria = {
                title: 'urgent',
                status: 'pending' as TodoStatus,
                priority: 'high' as TodoPriority
            };

            const result = repository.buildSearchQuery(multipleCriteria);

            // Expected query with WHERE clause for multiple conditions (based on actual output)
            const expectedSql = `select
    "todo_id"
    , "title"
    , "description"
    , "status"
    , "priority"
    , "category_id"
    , "created_at"
    , "updated_at"
from
    "todo"
where
    "title" like $1
    and "status" = $2
    and "priority" = $3
order by
    case "priority"
        when 'high' then
            1
        when 'medium' then
            2
        when 'low' then
            3
    end
    , "created_at" desc`;

            expect(result.formattedSql.trim()).toBe(expectedSql.trim());
            expect(result.params).toEqual(['%urgent%', 'pending', 'high']);
        });
    });
});
