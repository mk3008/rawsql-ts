/**
 * Test to validate that hybrid naming convention is properly applied
 * for Model-driven JSON mappings, ensuring no ambiguous column references.
 */

import { describe, it, expect } from 'vitest';
import { SelectQueryParser, PostgresJsonQueryBuilder, SqlFormatter } from '../../core/src/index';
import { convertModelDrivenMapping } from '../../core/src/transformers/ModelDrivenJsonMapping';
import { SimpleSelectQuery } from '../../core/src/models/SimpleSelectQuery';

// SQL formatting style configuration
const customStyle = {
    identifierEscape: {
        start: "\"",
        end: "\""
    },
    parameterSymbol: ":",
    parameterStyle: "named" as const,
    indentSize: 4,
    indentChar: " " as const,
    newline: "\n" as const,
    keywordCase: "lower" as const,
    commaBreak: "before" as const,
    andBreak: "before" as const
};

describe('Hybrid Naming Convention Validation', () => {
    it('should generate unique JSON column names for Model-driven mapping with duplicate entity types', () => {
        // Model-driven mapping that has duplicate entity types (two "User" entities)
        const modelDrivenMapping = {
            "typeInfo": {
                "interface": "TodoDetail",
                "importPath": "src/contracts/todo-detail.ts"
            },
            "structure": {
                "todoId": "todo_id",
                "title": {
                    "from": "title",
                    "type": "string"
                },
                "description": {
                    "from": "description",
                    "type": "string"
                },
                "completed": "completed",
                "createdAt": "created_at",
                "updatedAt": "updated_at",
                "user": {
                    "type": "object",
                    "from": "u",
                    "structure": {
                        "userId": "user_id",
                        "userName": {
                            "from": "user_name",
                            "type": "string"
                        },
                        "email": {
                            "from": "email",
                            "type": "string"
                        },
                        "createdAt": "user_created_at"
                    }
                },
                "category": {
                    "type": "object",
                    "from": "c",
                    "structure": {
                        "categoryId": "category_id",
                        "categoryName": {
                            "from": "category_name",
                            "type": "string"
                        },
                        "color": {
                            "from": "color",
                            "type": "string"
                        },
                        "createdAt": "category_created_at"
                    }
                },
                "comments": {
                    "type": "array",
                    "from": "tc",
                    "structure": {
                        "commentId": "comment_id",
                        "commentText": {
                            "from": "comment_text",
                            "type": "string"
                        },
                        "createdAt": "comment_created_at",
                        "user": {
                            "type": "object",
                            "from": "cu",
                            "structure": {
                                "userId": "comment_user_id",
                                "userName": {
                                    "from": "comment_user_name",
                                    "type": "string"
                                },
                                "email": {
                                    "from": "comment_user_email",
                                    "type": "string"
                                }
                            }
                        }
                    }
                }
            }
        };

        // Base SQL query
        const sql = `
            SELECT 
                -- TODO information
                t.todo_id,
                t.title,
                t.description,
                t.completed,
                t.created_at,
                t.updated_at,
                -- User information
                u.user_id,
                u.user_name,
                u.email,
                u.created_at as user_created_at,
                -- Category information
                c.category_id,
                c.category_name,
                c.color,
                c.created_at as category_created_at,
                -- Comments information (flat structure)
                tc.comment_id,
                tc.comment_text,
                tc.created_at as comment_created_at,
                -- Comment user information
                cu.user_id as comment_user_id,
                cu.user_name as comment_user_name,
                cu.email as comment_user_email
            FROM todo t
            INNER JOIN "user" u ON t.user_id = u.user_id
            INNER JOIN category c ON t.category_id = c.category_id
            LEFT JOIN todo_comment tc ON t.todo_id = tc.todo_id
            LEFT JOIN "user" cu ON tc.user_id = cu.user_id
            ORDER BY tc.created_at ASC
        `;

        // Parse SQL
        const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        // Convert Model-driven mapping to Legacy format
        const conversionResult = convertModelDrivenMapping(modelDrivenMapping);
        const legacyMapping = conversionResult.jsonMapping;

        console.log('🔍 Converted entities:', legacyMapping.nestedEntities?.map(e => ({
            id: e.id,
            name: e.name,
            parentId: e.parentId,
            propertyName: e.propertyName,
            type: e.relationshipType
        })));

        // Build JSON query using PostgresJsonQueryBuilder
        const builder = new PostgresJsonQueryBuilder();
        const jsonQuery = builder.buildJsonQuery(originalQuery, legacyMapping);

        // Format SQL
        const formatter = new SqlFormatter(customStyle);
        const formattedSql = formatter.format(jsonQuery).formattedSql;

        console.log('🔍 Generated SQL:');
        console.log(formattedSql);

        // Assertions
        expect(formattedSql).toContain('jsonb_build_object'); // Should use JSONB, not JSON
        expect(formattedSql).not.toContain('json_build_object'); // Should not use JSON
        
        // Check for hybrid naming convention
        const userJsonMatches = formattedSql.match(/user_json_\d+/g);
        expect(userJsonMatches).toBeTruthy();
        expect(userJsonMatches!.length).toBeGreaterThanOrEqual(2); // Should have at least 2 different user_json columns
        
        // Ensure no ambiguous column references
        expect(formattedSql).not.toMatch(/end as "user_json"[^_]/); // Should not have plain "user_json" without suffix
        
        // Check for unique naming
        const allUserJsonColumns = formattedSql.match(/as "user_json_\d+"/g);
        if (allUserJsonColumns) {
            const uniqueColumns = new Set(allUserJsonColumns);
            expect(uniqueColumns.size).toBe(allUserJsonColumns.length); // All should be unique
        }

        // Verify that column references in GROUP BY and aggregation use the numbered versions
        if (formattedSql.includes('group by')) {
            expect(formattedSql).not.toMatch(/group by[^"]*"user_json"[^_]/); // GROUP BY should use numbered columns
        }
    });

    it('should not produce ambiguous column reference errors in PostgreSQL', () => {
        // This test ensures the generated SQL would be valid in PostgreSQL
        const modelDrivenMapping = {
            "typeInfo": {
                "interface": "TodoDetail", 
                "importPath": "src/contracts/todo-detail.ts"
            },
            "structure": {
                "todoId": "todo_id",
                "user": {
                    "type": "object",
                    "from": "u",
                    "structure": {
                        "userId": "user_id",
                        "userName": "user_name"
                    }
                },
                "comments": {
                    "type": "array",
                    "from": "tc", 
                    "structure": {
                        "commentId": "comment_id",
                        "user": {
                            "type": "object",
                            "from": "cu",
                            "structure": {
                                "userId": "comment_user_id",
                                "userName": "comment_user_name"
                            }
                        }
                    }
                }
            }
        };

        const sql = `
            SELECT 
                t.todo_id,
                u.user_id,
                u.user_name,
                tc.comment_id,
                cu.user_id as comment_user_id,
                cu.user_name as comment_user_name
            FROM todo t
            INNER JOIN "user" u ON t.user_id = u.user_id
            LEFT JOIN todo_comment tc ON t.todo_id = tc.todo_id
            LEFT JOIN "user" cu ON tc.user_id = cu.user_id
        `;

        const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const conversionResult = convertModelDrivenMapping(modelDrivenMapping);
        const builder = new PostgresJsonQueryBuilder();
        const jsonQuery = builder.buildJsonQuery(originalQuery, conversionResult.jsonMapping);
        const formatter = new SqlFormatter(customStyle);
        const formattedSql = formatter.format(jsonQuery).formattedSql;

        // The generated SQL should not contain ambiguous column references
        // This is checked by ensuring all user_json columns have unique suffixes
        const userJsonColumns = formattedSql.match(/"user_json[^"]*"/g);
        if (userJsonColumns && userJsonColumns.length > 1) {
            const plainUserJson = userJsonColumns.filter(col => col === '"user_json"');
            expect(plainUserJson.length).toBe(0); // No plain "user_json" should exist when multiple user entities present
        }

        console.log('✅ SQL validation passed - no ambiguous column references detected');
    });
});