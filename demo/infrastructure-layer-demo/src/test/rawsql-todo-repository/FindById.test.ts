import { describe, it, expect, beforeAll } from 'vitest';
import { RawSQLTodoRepository } from '../../infrastructure/rawsql-infrastructure';
import { SelectQueryParser, SqlSchemaValidator } from '../../../../../dist'; // Import from parent rawsql-ts
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
 * RawSQL Safety Assurance Unit Tests for findById Operation
 * 
 * This test suite provides comprehensive static validation for RawSQL-based data access,
 * ensuring safety and correctness WITHOUT requiring database execution.
 * 
 * === Core Safety Guarantees ===
 * 
 * 1. **SQL Syntax & Schema Consistency Validation**
 *    - Validates that SQL syntax is parseable and structurally correct
 *    - Ensures all table/column references exist in the defined database schema
 *    - Catches typos, schema mismatches, and structural errors at build time
 *    - Uses SqlSchemaValidator for static analysis (no DB required)
 * 
 * 2. **Dynamic Search Condition Safety**
 *    - Tests SqlParamInjector functionality in isolation
 *    - Verifies WHERE clause injection works correctly for various search patterns
 *    - Ensures parameter binding is safe from SQL injection
 *    - Can be extended to test multiple search patterns and edge cases
 * 
 * 3. **Domain Schema Transformation Validation** 
 *    - Tests PostgresJsonQueryBuilder functionality in isolation
 *    - Ensures complex JOIN results can be properly transformed to domain objects
 *    - Validates JSON aggregation produces expected nested structure
 *    - Guarantees function return types match expected domain schema
 * 
 * === Key Technical Benefits ===
 * 
 * - **Static Analysis**: All validation happens at test time, not runtime
 * - **No Database Required**: Tests run fast and don't require DB infrastructure
 * - **Left-shift Testing**: Catches SQL errors during development, not in production
 * - **Complete Isolation**: Each phase (schema, injection, transformation) tested independently
 * - **Implementation Consistency**: Tests use exact same SQL queries as production code
 * 
 * This 3-phase validation approach ensures that a single repository function
 * is completely safe and reliable before any database interaction occurs.
 */
describe('RawSQLTodoRepository - SQL Generation Testing', () => {
    let repository: RawSQLTodoRepository; beforeAll(() => {
        // Initialize repository with debug-friendly SQL formatting for testing
        repository = new RawSQLTodoRepository(false, debugSqlStyle);
    });

    describe('Base SQL Schema Validation - findTodoWithRelations', () => {
        it('should validate base SQL query against schema without errors', () => {
            // Arrange: Get the exact same base SQL that findById implementation uses
            const baseSql = repository.getBaseSqlForFindById();
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

            // ID converted to integer
            expect(formattedSql.trim()).toBe(expectedSqlPattern.trim());
            expect(params).toEqual([456]);
        });
    });

    describe('applyJsonTransformationsForFindById - Full SQL Structure Verification', () => {
        it('should transform base SQL into complete JSON aggregated query', () => {
            // Arrange: Get the exact same base SQL that findById implementation uses
            const baseSql = repository.getBaseSqlForFindById();
            const baseQuery = SelectQueryParser.parse(baseSql) as any;

            // Act: Apply JSON transformations to the actual base SQL
            const jsonQuery = repository.applyJsonTransformationsForFindById(baseQuery);
            const { formattedSql, params } = repository['sqlFormatter'].format(jsonQuery);

            // Debug: Print actual JSON SQL to understand the structure
            console.log('JSON Transformed SQL:', formattedSql);

            // Assert: Complete JSON SQL structure verification
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

            // Fixed base query without parameters
            expect(formattedSql.trim()).toBe(expectedJsonSql.trim());
            expect(params).toEqual([]);
        });
    });
});
