import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { PostgreJsonQueryBuilder, JsonMapping } from '../../src/transformers/PostgreJsonQueryBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

// SQLを整形するときのスタイル (プロジェクトに合わせて調整してね)
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

describe('PostgreJsonQueryBuilder', () => {
    describe('Flat JSON Array Generation', () => {
        it('should transform a query to a flat JSON array using JsonMapping', () => {
            const sql = "SELECT c.id AS CategoryId, c.name AS CategoryName FROM category AS c";
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Categories",
                rootEntity: {
                    id: "category",
                    name: "Category",
                    columns: {
                        "id": "CategoryId",
                        "name": "CategoryName"
                    }
                },
                nestedEntities: [],
                useJsonb: true,
                resultFormat: "array"
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = [
                `select`,
                `    jsonb_agg(jsonb_build_object('id', "_sub"."CategoryId", 'name', "_sub"."CategoryName")) as "Categories"`,
                `from`,
                `    (`,
                `        select`,
                `            "c"."id" as "CategoryId"`,
                `            , "c"."name" as "CategoryName"`,
                `        from`,
                `            "category" as "c"`,
                `    ) as "_sub"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });
    });

    describe('Single JSON Object Generation', () => {
        it('should transform a query to a single JSON object with JsonMapping', () => {
            const sql = `
                select
                    p.id as ProductId,
                    p.name as ProductName,
                    p.price
                from
                    product as p
                where
                    p.id = 1
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "ProductDetail",
                rootEntity: {
                    id: "product",
                    name: "Product",
                    columns: {
                        "id": "ProductId",
                        "name": "ProductName",
                        "price": "price"
                    }
                },
                nestedEntities: [],
                useJsonb: true,
                resultFormat: "single",
                emptyResult: "null"
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = [
                `select`,
                `    jsonb_build_object('id', "_sub"."ProductId", 'name', "_sub"."ProductName", 'price', "_sub"."price") as "ProductDetail"`,
                `from`,
                `    (`,
                `        select`,
                `            "p"."id" as "ProductId"`,
                `            , "p"."name" as "ProductName"`,
                `            , "p"."price"`,
                `        from`,
                `            "product" as "p"`,
                `        where`,
                `            "p"."id" = 1`,
                `    ) as "_sub"`,
                `limit`,
                `    1`,
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });
    });

    describe('Hierarchical JSON Structure Generation', () => {
        it('should transform a query to 2-level hierarchical structure: Product > Category', () => {
            const sql = `
                select
                    product_id,
                    product_name,
                    category_id,
                    category_name
                from
                    catalog_report
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Products",
                rootEntity: {
                    id: "product",
                    name: "Product",
                    columns: {
                        "id": "product_id",
                        "name": "product_name"
                    }
                },
                nestedEntities: [
                    {
                        id: "category",
                        name: "Category",
                        parentId: "product",
                        propertyName: "category",
                        columns: {
                            "id": "category_id",
                            "name": "category_name"
                        }
                    }
                ],
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = [
                `select`,
                `    jsonb_agg(jsonb_build_object('id', "_sub"."product_id", 'name', "_sub"."product_name", 'category', case`,
                `        when "_sub"."category_id" is null`,
                `        and "_sub"."category_name" is null then`,
                `            null`,
                `        else`,
                `            jsonb_build_object('id', "_sub"."category_id", 'name', "_sub"."category_name")`,
                `    end)) as "Products"`,
                `from`,
                `    (`,
                `        select`,
                `            "product_id"`,
                `            , "product_name"`,
                `            , "category_id"`,
                `            , "category_name"`,
                `        from`,
                `            "catalog_report"`,
                `    ) as "_sub"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });

        it('should transform a query to 3-level hierarchical structure: Review > Product > Category', () => {
            const sql = `
                select
                    review_id,
                    review_text,
                    rating,
                    product_id,
                    product_name,
                    product_price,
                    category_id,
                    category_name
                from
                    review_details
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Reviews",
                rootEntity: {
                    id: "review",
                    name: "Review",
                    columns: {
                        "id": "review_id",
                        "text": "review_text",
                        "rating": "rating"
                    }
                },
                nestedEntities: [
                    {
                        id: "product",
                        name: "Product",
                        parentId: "review",
                        propertyName: "product",
                        columns: {
                            "id": "product_id",
                            "name": "product_name",
                            "price": "product_price"
                        }
                    },
                    {
                        id: "category",
                        name: "Category",
                        parentId: "product",
                        propertyName: "category",
                        columns: {
                            "id": "category_id",
                            "name": "category_name"
                        }
                    }
                ],
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = [
                `select`,
                `    jsonb_agg(jsonb_build_object('id', "_sub"."review_id", 'text', "_sub"."review_text", 'rating', "_sub"."rating", 'product', case`,
                `        when "_sub"."product_id" is null`,
                `        and "_sub"."product_name" is null`,
                `        and "_sub"."product_price" is null then`,
                `            null`,
                `        else`,
                `            jsonb_build_object('id', "_sub"."product_id", 'name', "_sub"."product_name", 'price', "_sub"."product_price", 'category', case`,
                `                when "_sub"."category_id" is null`,
                `                and "_sub"."category_name" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "_sub"."category_id", 'name', "_sub"."category_name")`,
                `            end)`,
                `    end)) as "Reviews"`,
                `from`,
                `    (`,
                `        select`,
                `            "review_id"`,
                `            , "review_text"`,
                `            , "rating"`,
                `            , "product_id"`,
                `            , "product_name"`,
                `            , "product_price"`,
                `            , "category_id"`,
                `            , "category_name"`,
                `        from`,
                `            "review_details"`,
                `    ) as "_sub"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });

        it('should validate parent relationships and throw error for invalid parentId', () => {
            const sql = "SELECT id, name FROM test";
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Test",
                rootEntity: {
                    id: "root",
                    name: "Root",
                    columns: { "id": "id" }
                },
                nestedEntities: [
                    {
                        id: "child",
                        name: "Child",
                        parentId: "nonexistent",
                        propertyName: "child",
                        columns: { "name": "name" }
                    }
                ]
            };

            expect(() => {
                builder.buildJson(originalQuery, mapping);
            }).toThrow("Parent entity 'nonexistent' not found for entity 'child'");
        });
    });
});