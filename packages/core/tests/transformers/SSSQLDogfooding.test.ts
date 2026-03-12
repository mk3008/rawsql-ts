import { describe, expect, it } from 'vitest';
import { DynamicQueryBuilder } from '../../src/transformers/DynamicQueryBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

describe('SSSQL dogfooding', () => {
    it('dogfood: optional-condition prompt chooses truthful SSSQL branches before dynamic SQL assembly', () => {
        const builder = new DynamicQueryBuilder();
        const sql = `
            SELECT p.product_id, p.product_name
            FROM products p
            WHERE (:brand_name IS NULL OR p.brand_name = :brand_name)
              AND (
                :category_name IS NULL
                OR EXISTS (
                    SELECT 1
                    FROM product_categories pc
                    JOIN categories c
                      ON c.category_id = pc.category_id
                    WHERE pc.product_id = p.product_id
                      AND c.category_name = :category_name
                )
              )
        `;

        // Keep the source SQL truthful so optionality stays visible in the SQL itself.
        const authoredSql = normalizeSql(sql);
        expect(authoredSql).toContain('(:brand_name is null or p.brand_name = :brand_name)');
        expect(authoredSql).toContain(':category_name is null or exists');
        expect(authoredSql).not.toContain('where 1 = 1');
        expect(authoredSql).not.toContain('left join');

        const prunedQuery = builder.buildQuery(sql, {
            optionalConditionParameters: {
                brand_name: null,
                category_name: null,
            }
        });

        const prunedSql = normalizeSql(new SqlFormatter().format(prunedQuery).formattedSql);

        expect(prunedSql).toBe('select "p"."product_id", "p"."product_name" from "products" as "p"');
        expect(prunedSql).not.toContain(':brand_name');
        expect(prunedSql).not.toContain(':category_name');
        expect(prunedSql).not.toContain('where');
    });
});
