import { describe, expect, test } from 'vitest';
import { CommonTable, PartitionByClause } from '../../src/models/Clause';
import { InsertQuery } from '../../src/models/InsertQuery';
import { UpdateQuery } from '../../src/models/UpdateQuery';
import { DeleteQuery } from '../../src/models/DeleteQuery';
import { MergeQuery } from '../../src/models/MergeQuery';
import { FunctionCall, InlineQuery, WindowFrameExpression } from '../../src/models/ValueComponent';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { UpdateQueryParser } from '../../src/parsers/UpdateQueryParser';
import { NamedQueryDefinitionExtractor } from '../../src/transformers/NamedQueryDefinitionExtractor';

describe('NamedQueryDefinitionExtractor', () => {
    test('extracts a simple CTE as a named query definition', () => {
        const query = SelectQueryParser.parse(`
            WITH cte AS (
                SELECT id FROM users
            )
            SELECT * FROM cte
        `);

        const definitions = NamedQueryDefinitionExtractor.extract(query);

        expect(definitions).toHaveLength(1);
        expect(definitions[0]).toMatchObject({
            name: 'cte',
            recursive: false,
            range: null,
            nameRange: null
        });
        expect(definitions[0].query).toBeInstanceOf(Object);
    });

    test('preserves deterministic SQL order for multiple CTEs in one WITH clause', () => {
        const query = SelectQueryParser.parse(`
            WITH first_cte AS (
                SELECT 1 AS id
            ),
            second_cte AS (
                SELECT id FROM first_cte
            ),
            third_cte AS (
                SELECT id FROM second_cte
            )
            SELECT * FROM third_cte
        `);

        const names = NamedQueryDefinitionExtractor.extract(query).map(definition => definition.name);

        expect(names).toEqual(['first_cte', 'second_cte', 'third_cte']);
    });

    test('documents nested CTE order as outer definition before definitions inside its body', () => {
        const query = SelectQueryParser.parse(`
            WITH outer_cte AS (
                WITH inner_cte AS (
                    SELECT 1 AS id
                )
                SELECT id FROM inner_cte
            ),
            sibling_cte AS (
                SELECT id FROM outer_cte
            )
            SELECT * FROM sibling_cte
        `);

        const names = NamedQueryDefinitionExtractor.extract(query).map(definition => definition.name);

        expect(names).toEqual(['outer_cte', 'inner_cte', 'sibling_cte']);
    });

    test('keeps top-level WITH definitions before later subquery WITH definitions', () => {
        const query = SelectQueryParser.parse(`
            WITH top_cte AS (
                SELECT 1 AS id
            )
            SELECT *
            FROM (
                WITH nested_cte AS (
                    SELECT 2 AS id
                )
                SELECT id FROM nested_cte
            ) AS nested_source
        `);

        const names = NamedQueryDefinitionExtractor.extract(query).map(definition => definition.name);

        expect(names).toEqual(['top_cte', 'nested_cte']);
    });

    test('uses SQL clause order for nested CTEs inside UPDATE statements', () => {
        const query = UpdateQueryParser.parse(`
            UPDATE accounts
            SET owner_id = (
                WITH set_cte AS (
                    SELECT 1 AS id
                )
                SELECT id FROM set_cte
            )
            FROM (
                WITH from_cte AS (
                    SELECT 2 AS id
                )
                SELECT id FROM from_cte
            ) AS source_accounts
            WHERE EXISTS (
                WITH where_cte AS (
                    SELECT 3 AS id
                )
                SELECT id FROM where_cte
            )
        `);

        const names = NamedQueryDefinitionExtractor.extract(query).map(definition => definition.name);

        expect(names).toEqual(['set_cte', 'from_cte', 'where_cte']);
    });

    test('keeps FILTER definitions before OVER definitions in function calls', () => {
        const filterQuery = SelectQueryParser.parse(`
            WITH filter_cte AS (
                SELECT 1 AS id
            )
            SELECT id FROM filter_cte
        `);
        const overQuery = SelectQueryParser.parse(`
            WITH over_cte AS (
                SELECT 2 AS id
            )
            SELECT id FROM over_cte
        `);
        const functionCall = new FunctionCall(
            null,
            'count',
            null,
            new WindowFrameExpression(new PartitionByClause(new InlineQuery(overQuery)), null),
            null,
            false,
            null,
            new InlineQuery(filterQuery)
        );

        const names = NamedQueryDefinitionExtractor.extract(functionCall).map(definition => definition.name);

        expect(names).toEqual(['filter_cte', 'over_cte']);
    });

    test('marks definitions from WITH RECURSIVE clauses', () => {
        const query = SelectQueryParser.parse(`
            WITH RECURSIVE tree AS (
                SELECT id, parent_id FROM categories WHERE parent_id IS NULL
                UNION ALL
                SELECT c.id, c.parent_id
                FROM categories c
                JOIN tree t ON c.parent_id = t.id
            )
            SELECT * FROM tree
        `);

        const definitions = NamedQueryDefinitionExtractor.extract(query);

        expect(definitions).toHaveLength(1);
        expect(definitions[0].name).toBe('tree');
        expect(definitions[0].recursive).toBe(true);
    });

    test('does not crash on writable CTE bodies', () => {
        const cases = [
            {
                sql: `
                    WITH inserted_rows AS (
                        INSERT INTO audit_log (id, message)
                        VALUES (1, 'created')
                        RETURNING id
                    )
                    SELECT id FROM inserted_rows
                `,
                name: 'inserted_rows',
                queryType: InsertQuery
            },
            {
                sql: `
                    WITH updated_rows AS (
                        UPDATE users
                        SET active = true
                        WHERE id = 1
                        RETURNING id
                    )
                    SELECT id FROM updated_rows
                `,
                name: 'updated_rows',
                queryType: UpdateQuery
            },
            {
                sql: `
                    WITH deleted_rows AS (
                        DELETE FROM sessions
                        WHERE expired = true
                        RETURNING id
                    )
                    SELECT id FROM deleted_rows
                `,
                name: 'deleted_rows',
                queryType: DeleteQuery
            },
            {
                sql: `
                    WITH merged_rows AS (
                        MERGE INTO users AS target
                        USING incoming_users AS source
                        ON target.user_id = source.user_id
                        WHEN MATCHED THEN UPDATE SET name = source.name
                        WHEN NOT MATCHED THEN INSERT (user_id, name) VALUES (source.user_id, source.name)
                        RETURNING target.user_id AS user_id
                    )
                    SELECT user_id FROM merged_rows
                `,
                name: 'merged_rows',
                queryType: MergeQuery
            }
        ];

        for (const item of cases) {
            const query = SelectQueryParser.parse(item.sql);

            expect(() => NamedQueryDefinitionExtractor.extract(query)).not.toThrow();
            const [definition] = NamedQueryDefinitionExtractor.extract(query);
            expect(definition.name).toBe(item.name);
            expect(definition.query).toBeInstanceOf(item.queryType);
        }
    });

    test('extracts a CommonTable input directly', () => {
        const query = SelectQueryParser.parse(`
            WITH direct_cte AS (
                SELECT 1 AS id
            )
            SELECT * FROM direct_cte
        `).toSimpleQuery();
        const commonTable = query.withClause?.tables[0];

        expect(commonTable).toBeInstanceOf(CommonTable);
        const definitions = NamedQueryDefinitionExtractor.extract(commonTable!);

        expect(definitions.map(definition => definition.name)).toEqual(['direct_cte']);
        expect(definitions[0]).not.toHaveProperty('recursive');
    });

    test('does not infer recursive context from a direct CommonTable input', () => {
        const query = SelectQueryParser.parse(`
            WITH RECURSIVE direct_tree AS (
                SELECT id, parent_id FROM categories WHERE parent_id IS NULL
                UNION ALL
                SELECT c.id, c.parent_id
                FROM categories c
                JOIN direct_tree t ON c.parent_id = t.id
            )
            SELECT * FROM direct_tree
        `).toSimpleQuery();
        const commonTable = query.withClause?.tables[0];

        const definitions = NamedQueryDefinitionExtractor.extract(commonTable!);

        expect(definitions).toHaveLength(1);
        expect(definitions[0].name).toBe('direct_tree');
        expect(definitions[0]).not.toHaveProperty('recursive');
    });
});
