import { describe, expect, it } from 'vitest';
import { DynamicQueryBuilder } from '../../src/transformers/DynamicQueryBuilder';
import {
    OptionalConditionPruningParameters,
    pruneOptionalConditionBranches
} from '../../src/transformers/PruneOptionalConditionBranches';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const formatSql = (sql: string, pruningParameters?: OptionalConditionPruningParameters): string => {
    const query = SelectQueryParser.parse(sql);
    const transformed = pruningParameters ? pruneOptionalConditionBranches(query, pruningParameters) : query;
    return normalizeSql(new SqlFormatter().format(transformed).formattedSql);
};

describe('pruneOptionalConditionBranches', () => {
    it('prunes a top-level optional scalar predicate when the targeted parameter is null', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE 1 = 1
              AND (:brand_name IS NULL OR p.brand_name = :brand_name)
        `;

        const formattedSql = formatSql(sql, { brand_name: null });

        expect(formattedSql).toContain('from "products" as "p"');
        expect(formattedSql).not.toContain('where');
        expect(formattedSql).not.toContain(':brand_name');
    });

    it('prunes a top-level optional scalar predicate without requiring a where 1 = 1 sentinel', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE (:brand_name IS NULL OR p.brand_name = :brand_name)
        `;

        const formattedSql = formatSql(sql, { brand_name: undefined });

        expect(formattedSql).toBe('select "p"."product_id" from "products" as "p"');
        expect(formattedSql).not.toContain('where');
        expect(formattedSql).not.toContain(':brand_name');
    });

    it('prunes a supported branch even when redundant outer parentheses are nested', () => {
        const sql = [
            'SELECT p.product_id',
            'FROM products p',
            'WHERE (((:brand_name IS NULL OR p.brand_name = :brand_name)))'
        ].join('\n');

        const formattedSql = formatSql(sql, { brand_name: null });

        expect(formattedSql).toBe('select "p"."product_id" from "products" as "p"');
        expect(formattedSql).not.toContain('where');
        expect(formattedSql).not.toContain(':brand_name');
    });
    it('prunes a top-level optional exists branch when the targeted parameter is undefined', () => {
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

        const formattedSql = formatSql(sql, { category_name: undefined });

        expect(formattedSql).toContain('from "products" as "p"');
        expect(formattedSql).not.toContain('exists');
        expect(formattedSql).not.toContain(':category_name');
        expect(formattedSql).not.toContain('where');
    });

    it('prunes a top-level optional not-exists branch when the targeted parameter is null', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE (
                :archived_name IS NULL
                OR NOT EXISTS (
                    SELECT 1
                    FROM archived_products ap
                    WHERE ap.product_id = p.product_id
                      AND ap.product_name = :archived_name
                )
            )
        `;

        const formattedSql = formatSql(sql, { archived_name: null });

        expect(formattedSql).toBe('select "p"."product_id" from "products" as "p"');
        expect(formattedSql).not.toContain('not exists');
        expect(formattedSql).not.toContain(':archived_name');
    });

    it('prunes only the null-targeted branch when multiple optional branches are present', () => {
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
            brand_name: null,
            category_name: 'shoes'
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

        const formattedSql = formatSql(sql, { brand_name: null });

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

        const formattedSql = formatSql(sql, { brand_name: undefined });

        expect(formattedSql).toContain('from (select "p"."product_id" from "products" as "p") as "derived"');
        expect(formattedSql).not.toContain(':brand_name');
    });

    it('is exact no-op when the targeted parameter is present', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE 1 = 1
              AND (:brand_name IS NULL OR p.brand_name = :brand_name)
        `;

        const beforeSql = formatSql(sql);
        const afterSql = formatSql(sql, { brand_name: 'Acme' });

        expect(afterSql).toBe(beforeSql);
    });

    it('is exact no-op when the branch parameter is not explicitly targeted', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE 1 = 1
              AND (:brand_name IS NULL OR p.brand_name = :brand_name)
        `;

        const beforeSql = formatSql(sql);
        const afterSql = formatSql(sql, { category_name: null });

        expect(afterSql).toBe(beforeSql);
    });

    it('prunes richer single-parameter branches without rewriting their inner predicate shape', () => {
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

        const afterSql = formatSql(sql, { brand_name: null });

        expect(afterSql).toBe('select "p"."product_id" from "products" as "p"');
    });

    it('prunes LIKE-based optional branches that only depend on the targeted parameter', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE (:brand_name IS NULL OR lower(p.brand_name) LIKE lower(:brand_name))
        `;

        const formattedSql = formatSql(sql, { brand_name: null });

        expect(formattedSql).toBe('select "p"."product_id" from "products" as "p"');
    });

    it('leaves non-top-level optional branches untouched', () => {
        const sql = `
            SELECT p.product_id
            FROM products p
            WHERE p.active = true
               OR (:brand_name IS NULL OR p.brand_name = :brand_name)
        `;

        const beforeSql = formatSql(sql);
        const afterSql = formatSql(sql, { brand_name: null });

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

        const formattedSql = formatSql(sql, { category_name: 'sports' });

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
            optionalConditionParameters: { brand_name: null },
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
