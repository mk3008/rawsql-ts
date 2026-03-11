import { describe, expect, it } from 'vitest';
import { DynamicQueryBuilder } from '../../src/transformers/DynamicQueryBuilder';
import {
    OptionalConditionParameterStates,
    pruneOptionalConditionBranches
} from '../../src/transformers/PruneOptionalConditionBranches';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const formatSql = (sql: string, states?: OptionalConditionParameterStates): string => {
    const query = SelectQueryParser.parse(sql);
    const transformed = states ? pruneOptionalConditionBranches(query, states) : query;
    return normalizeSql(new SqlFormatter().format(transformed).formattedSql);
};

describe('pruneOptionalConditionBranches', () => {
    it('prunes a top-level optional scalar predicate when the parameter is known absent', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE 1 = 1
              AND (:brand_name IS NULL OR p.brand_name = :brand_name)
        `;

        const formattedSql = formatSql(sql, { brand_name: 'absent' });

        expect(formattedSql).toContain('from "products" as "p"');
        expect(formattedSql).not.toContain('where');
        expect(formattedSql).not.toContain(':brand_name');
    });

    it('prunes a top-level optional exists branch when the parameter is known absent', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE 1 = 1
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

        const formattedSql = formatSql(sql, { category_name: 'absent' });

        expect(formattedSql).toContain('from "products" as "p"');
        expect(formattedSql).not.toContain('exists');
        expect(formattedSql).not.toContain(':category_name');
        expect(formattedSql).not.toContain('where');
    });

    it('prunes only the known-absent branch when multiple optional branches are present', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE 1 = 1
              AND (:brand_name IS NULL OR p.brand_name = :brand_name)
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

        const formattedSql = formatSql(sql, {
            brand_name: 'absent',
            category_name: 'present'
        });

        expect(formattedSql).not.toContain(':brand_name');
        expect(formattedSql).toContain(':category_name is null or exists');
        expect(formattedSql).toContain('join "categories" as "c"');
    });

    it('prunes supported branches inside CTE query blocks', () => {
        const sql = `
            WITH filtered_products AS (
                SELECT p.product_id
                FROM products p
                WHERE 1 = 1
                  AND (:brand_name IS NULL OR p.brand_name = :brand_name)
            )
            SELECT * FROM filtered_products
        `;

        const formattedSql = formatSql(sql, { brand_name: 'absent' });

        expect(formattedSql).toContain('with "filtered_products" as (select "p"."product_id" from "products" as "p")');
        expect(formattedSql).not.toContain(':brand_name');
    });

    it('prunes supported branches inside derived-table subqueries', () => {
        const sql = `
            SELECT derived.product_id
            FROM (
                SELECT p.product_id
                FROM products p
                WHERE 1 = 1
                  AND (:brand_name IS NULL OR p.brand_name = :brand_name)
            ) AS derived
        `;

        const formattedSql = formatSql(sql, { brand_name: 'absent' });

        expect(formattedSql).toContain('from (select "p"."product_id" from "products" as "p") as "derived"');
        expect(formattedSql).not.toContain(':brand_name');
    });

    it('is exact no-op when the parameter is known present', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE 1 = 1
              AND (:brand_name IS NULL OR p.brand_name = :brand_name)
        `;

        const beforeSql = formatSql(sql);
        const afterSql = formatSql(sql, { brand_name: 'present' });

        expect(afterSql).toBe(beforeSql);
    });

    it('is exact no-op for unsupported patterns', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE 1 = 1
              AND (
                :brand_name IS NULL
                OR p.brand_name = :brand_name
                OR p.brand_code = :brand_name
              )
        `;

        const beforeSql = formatSql(sql);
        const afterSql = formatSql(sql, { brand_name: 'absent' });

        expect(afterSql).toBe(beforeSql);
    });

    it('leaves non-top-level optional branches untouched', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE p.active = true
               OR (:brand_name IS NULL OR p.brand_name = :brand_name)
        `;

        const beforeSql = formatSql(sql);
        const afterSql = formatSql(sql, { brand_name: 'absent' });

        expect(afterSql).toBe(beforeSql);
    });

    it('keeps relationship semantics unchanged when the branch remains active', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            INNER JOIN brands b
              ON b.brand_id = p.brand_id
            WHERE 1 = 1
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

        const formattedSql = formatSql(sql, { category_name: 'present' });

        expect(formattedSql).toContain('join "brands" as "b"');
        expect(formattedSql).not.toContain('left join "brands"');
        expect(formattedSql).toContain('exists (select 1');
    });
});

describe('DynamicQueryBuilder optional condition pruning', () => {
    it('integrates pruning into buildQuery cleanup without breaking serialized SQL output', () => {
        const builder = new DynamicQueryBuilder();
        const sql = `
            SELECT p.product_id AS id, p.brand_name
            FROM products p
            WHERE 1 = 1
              AND (:brand_name IS NULL OR p.brand_name = :brand_name)
        `;

        const query = builder.buildQuery(sql, {
            optionalConditionParameterStates: { brand_name: 'absent' },
            serialize: {
                rootName: 'product',
                rootEntity: {
                    id: 'product',
                    name: 'Product',
                    columns: { id: 'id', brand_name: 'brand_name' }
                },
                nestedEntities: []
            }
        });

        const formattedSql = normalizeSql(new SqlFormatter().format(query).formattedSql);

        expect(formattedSql).toContain('jsonb_agg');
        expect(formattedSql).not.toContain(':brand_name');
        expect(formattedSql).not.toContain('where 1 = 1');
    });
});
