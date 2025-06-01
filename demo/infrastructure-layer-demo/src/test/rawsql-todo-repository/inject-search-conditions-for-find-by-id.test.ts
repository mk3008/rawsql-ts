import { describe, it, expect, beforeAll } from 'vitest';
import { RawSQLTodoRepository } from '../../infrastructure/rawsql-infrastructure';
import { SelectQueryParser, SqlSchemaValidator } from '../../../../../'; // Import from parent rawsql-ts
import { sqlLoader } from '../../infrastructure/sql-loader';
import { schemaManager } from '../../infrastructure/schema-definitions';

// Debug-friendly SQL formatting for testing (consistent with dynamic-sql-generation.test.ts)
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
 * Unit tests for SQL generation logic - Phase 1 & 2: Search Condition Injection + JSON Transformation
 * Tests SqlParamInjector and PostgresJsonQueryBuilder functionality with full SQL comparison
 */
describe('RawSQLTodoRepository - SQL Generation Testing', () => {
    let repository: RawSQLTodoRepository; beforeAll(() => {
        // Initialize repository with debug-friendly SQL formatting for testing
        repository = new RawSQLTodoRepository(false, debugSqlStyle);
    });

    describe('Base SQL Schema Validation - findTodoWithRelations', () => {
        it('should validate base SQL query against schema without errors', () => {
            // Arrange: Load base SQL query and schema resolver
            sqlLoader.loadAllQueries();
            const baseSql = sqlLoader.getQuery('findTodoWithRelations');
            const tableColumnResolver = schemaManager.createTableColumnResolver();

            // Act & Assert: Validate SQL structure and schema consistency
            // This ensures:
            // - SQL syntax is valid and parseable
            // - All table/column references exist in the defined schema
            // - No typos in table/column names
            // - Structural integrity without database execution (fast & safe)
            expect(() => {
                SqlSchemaValidator.validate(baseSql, tableColumnResolver);
            }).not.toThrow();

            // Additional verification: ensure the SQL contains expected table references
            expect(baseSql).toContain('todo');
            expect(baseSql).toContain('category');
            expect(baseSql).toContain('todo_comment');
        });
    });

    describe('injectSearchConditionsForFindById - Full SQL Structure Verification', () => {
        it('should generate expected SQL structure when formatted', () => {
            // Arrange
            const todoId = '456';

            // Act
            const injectedQuery = repository.injectSearchConditionsForFindById(todoId);

            // Format the injected query using SqlFormatter to see the actual SQL
            const { formattedSql, params } = repository['sqlFormatter'].format(injectedQuery);

            // Debug: Print actual SQL to understand the structure
            console.log('Actual SQL:', formattedSql);

            // Assert - Verify complete SQL structure (updated to match actual output)
            const expectedSqlPattern = `select
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
    , "com"."todo_comment_id"
    , "com"."todo_id" as "comment_todo_id"
    , "com"."content" as "comment_content"
    , "com"."author_name" as "comment_author_name"
    , "com"."created_at" as "comment_created_at"
from
    "todo" as "t"
    left join "category" as "c" on "t"."category_id" = "c"."category_id"
    left join "todo_comment" as "com" on "t"."todo_id" = "com"."todo_id"
where
    "t"."todo_id" = $1
order by
    "com"."created_at"`;

            expect(formattedSql.trim()).toBe(expectedSqlPattern.trim());
            expect(params).toEqual([456]); // ID converted to integer
        });
    });

    describe('applyJsonTransformationsForFindById - Full SQL Structure Verification', () => {
        it('should transform base SQL into complete JSON aggregated query', () => {
            // Arrange: Get the original base SQL from sqlLoader (independent of search conditions)
            sqlLoader.loadAllQueries(); // Load queries into memory cache first
            const baseSql = sqlLoader.getQuery('findTodoWithRelations');
            const baseQuery = SelectQueryParser.parse(baseSql) as any;

            // Act: Apply JSON transformations to the actual base SQL
            const jsonQuery = repository.applyJsonTransformationsForFindById(baseQuery);
            const { formattedSql, params } = repository['sqlFormatter'].format(jsonQuery);

            // Debug: Print actual JSON SQL to understand the structure
            console.log('JSON Transformed SQL:', formattedSql);            // Assert: Complete JSON SQL structure verification
            // NOTE: This expected SQL should be updated based on actual output
            const expectedJsonSql = `with
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
            , "com"."todo_comment_id"
            , "com"."todo_id" as "comment_todo_id"
            , "com"."content" as "comment_content"
            , "com"."author_name" as "comment_author_name"
            , "com"."created_at" as "comment_created_at"
        from
            "todo" as "t"
            left join "category" as "c" on "t"."category_id" = "c"."category_id"
            left join "todo_comment" as "com" on "t"."todo_id" = "com"."todo_id"
        order by
            "com"."created_at"
    )
    , "cte_object_depth_1" as (
        select
            *
            , case
                when "category_id" is null
                and "category_name" is null
                and "category_description" is null
                and "category_color" is null
                and "category_created_at" is null then
                    null
                else
                    jsonb_build_object('category_id', "category_id", 'name', "category_name", 'description', "category_description", 'color', "category_color", 'created_at', "category_created_at")
            end as "category_json"
        from
            "origin_query"
    )
    , "cte_array_depth_1" as (
        select
            "category_json"
            , "todo_id"
            , "title"
            , "description"
            , "status"
            , "priority"
            , "todo_created_at"
            , "todo_updated_at"
            , "category_id"
            , "category_name"
            , "category_description"
            , "category_color"
            , "category_created_at"
            , jsonb_agg(jsonb_build_object('todo_comment_id', "todo_comment_id", 'todo_id', "comment_todo_id", 'content', "comment_content", 'author_name', "comment_author_name", 'created_at', "comment_created_at")) as "comments"
        from
            "cte_object_depth_1"
        group by
            "category_json"
            , "todo_id"
            , "title"
            , "description"
            , "status"
            , "priority"
            , "todo_created_at"
            , "todo_updated_at"
            , "category_id"
            , "category_name"
            , "category_description"
            , "category_color"
            , "category_created_at"
    )
    , "cte_root_todo" as (
        select
            jsonb_build_object('todo_id', "todo_id", 'title', "title", 'description', "description", 'status', "status", 'priority', "priority", 'category_id', "category_id", 'created_at', "todo_created_at", 'updated_at', "todo_updated_at", 'category', "category_json", 'comments', "comments") as "todo"
        from
            "cte_array_depth_1"
    )
select
    "todo"
from
    "cte_root_todo"
limit
    1`;

            expect(formattedSql.trim()).toBe(expectedJsonSql.trim());
            expect(params).toEqual([]); // Fixed base query without parameters
        });
    });
});
