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

            const result = repository.buildSearchQuery(emptyCriteria);            // Expected CTE-based JSON aggregation query structure (no criteria)
            const expectedSql = `with
    "origin_query" as (
        select
            "t"."todo_id"
            , "t"."title"
            , "t"."description"
            , "t"."status"
            , "t"."priority"
            , "t"."created_at" as "todo_created_at"
            , "t"."updated_at" as "todo_updated_at"
            , "c"."category_id"
            , "c"."name" as "category_name"
            , "c"."description" as "category_description"
            , "c"."color" as "category_color"
            , "c"."created_at" as "category_created_at"
        from
            "todo" as "t"
            left join "category" as "c" on "t"."category_id" = "c"."category_id"
        order by
            case "t"."priority"
                when 'high' then
                    1
                when 'medium' then
                    2
                when 'low' then
                    3
            end
            , "t"."created_at" desc
    )
    , "cte_root_todo" as (
        select
            jsonb_build_object('todo_id', "todo_id", 'title', "title", 'description', "description", 'status', "status", 'priority', "priority", 'createdAt', "todo_created_at", 'updatedAt', "todo_updated_at", 'category_name', "category_name", 'category_color', "category_color") as "todo"
        from
            "origin_query"
    )
select
    jsonb_agg("todo") as "todo_array"
from
    "cte_root_todo"`;

            expect(result.formattedSql.trim()).toBe(expectedSql.trim());
            expect(result.params).toEqual([]); // No parameters for empty criteria
        }); it('should generate correct SQL for single search criteria', () => {
            // Pattern 2: Single criteria - WHERE clause with one condition
            const titleCriteria: TodoSearchCriteria = {
                title: 'project'
            };

            const result = repository.buildSearchQuery(titleCriteria);            // Expected CTE-based JSON aggregation query with WHERE clause (single criteria)
            const expectedSql = `with
    "origin_query" as (
        select
            "t"."todo_id"
            , "t"."title"
            , "t"."description"
            , "t"."status"
            , "t"."priority"
            , "t"."created_at" as "todo_created_at"
            , "t"."updated_at" as "todo_updated_at"
            , "c"."category_id"
            , "c"."name" as "category_name"
            , "c"."description" as "category_description"
            , "c"."color" as "category_color"
            , "c"."created_at" as "category_created_at"
        from
            "todo" as "t"
            left join "category" as "c" on "t"."category_id" = "c"."category_id"
        where
            "t"."title" like $1
        order by
            case "t"."priority"
                when 'high' then
                    1
                when 'medium' then
                    2
                when 'low' then
                    3
            end
            , "t"."created_at" desc
    )
    , "cte_root_todo" as (
        select
            jsonb_build_object('todo_id', "todo_id", 'title', "title", 'description', "description", 'status', "status", 'priority', "priority", 'createdAt', "todo_created_at", 'updatedAt', "todo_updated_at", 'category_name', "category_name", 'category_color', "category_color") as "todo"
        from
            "origin_query"
    )
select
    jsonb_agg("todo") as "todo_array"
from
    "cte_root_todo"`;

            expect(result.formattedSql.trim()).toBe(expectedSql.trim());
            expect(result.params).toEqual(['%project%']);
        }); it('should generate correct SQL for multiple search criteria', () => {
            // Pattern 3: Multiple criteria - WHERE clause with multiple conditions
            const multipleCriteria: TodoSearchCriteria = {
                title: 'urgent',
                status: 'pending' as TodoStatus,
                priority: 'high' as TodoPriority
            };

            const result = repository.buildSearchQuery(multipleCriteria);            // Expected CTE-based JSON aggregation query with multiple WHERE conditions
            const expectedSql = `with
    "origin_query" as (
        select
            "t"."todo_id"
            , "t"."title"
            , "t"."description"
            , "t"."status"
            , "t"."priority"
            , "t"."created_at" as "todo_created_at"
            , "t"."updated_at" as "todo_updated_at"
            , "c"."category_id"
            , "c"."name" as "category_name"
            , "c"."description" as "category_description"
            , "c"."color" as "category_color"
            , "c"."created_at" as "category_created_at"
        from
            "todo" as "t"
            left join "category" as "c" on "t"."category_id" = "c"."category_id"
        where
            "t"."title" like $1
            and "t"."status" = $2
            and "t"."priority" = $3
        order by
            case "t"."priority"
                when 'high' then
                    1
                when 'medium' then
                    2
                when 'low' then
                    3
            end
            , "t"."created_at" desc
    )
    , "cte_root_todo" as (
        select
            jsonb_build_object('todo_id', "todo_id", 'title', "title", 'description', "description", 'status', "status", 'priority', "priority", 'createdAt', "todo_created_at", 'updatedAt', "todo_updated_at", 'category_name', "category_name", 'category_color', "category_color") as "todo"
        from
            "origin_query"
    )
select
    jsonb_agg("todo") as "todo_array"
from
    "cte_root_todo"`;

            expect(result.formattedSql.trim()).toBe(expectedSql.trim());
            expect(result.params).toEqual(['%urgent%', 'pending', 'high']);
        });
    });
});
