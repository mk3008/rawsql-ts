import { describe, expect, test } from 'vitest';
import { SchemaCollector } from '../../src/transformers/SchemaCollector';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('SchemaCollector - CTE with SELECT * wildcard', () => {
    test('should handle simple CTE with SELECT * wildcard', () => {
        // Arrange
        const sql = `
        WITH "sales" AS (
            SELECT "sale_id", "product_id", "quantity" FROM "sales_table"
        ), 
        "filtered_sales" AS (
            SELECT * FROM "sales"
        ) 
        SELECT * FROM "filtered_sales"`;

        const parseResult = SelectQueryParser.analyze(sql);
        expect(parseResult.success).toBe(true);

        // Act
        const schemaCollector = new SchemaCollector(null, true);
        const result = schemaCollector.analyze(parseResult.query!);

        // Assert
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.schemas.length).toBeGreaterThanOrEqual(3);
        
        const filteredSales = result.schemas.find(s => s.name === 'filtered_sales');
        expect(filteredSales).toBeDefined();
        // filtered_sales should inherit columns from sales CTE
        // Note: Current implementation might show 0 columns due to wildcard
    });

    test('should handle CTE with SELECT * and WHERE clause', () => {
        // Arrange
        const sql = `
        WITH "sales" AS (
            SELECT "sale_id", "product_id", "quantity", "sale_date" FROM "sales_table"
        ), 
        "filtered_sales" AS (
            SELECT * FROM "sales" WHERE "sale_date" >= '2025-01-01' AND "sale_date" <= '2025-01-05'
        ), 
        "products" AS (
            SELECT "product_id", "product_name" FROM "products_table"
        ) 
        SELECT "s"."sale_id", "s"."product_id", "p"."product_name", "s"."quantity" 
        FROM "filtered_sales" AS "s" 
        INNER JOIN "products" AS "p" ON "s"."product_id" = "p"."product_id"`;

        const parseResult = SelectQueryParser.analyze(sql);
        expect(parseResult.success).toBe(true);

        // Act
        const schemaCollector = new SchemaCollector(null, true);
        const result = schemaCollector.analyze(parseResult.query!);

        // Assert - This is the bug: should be true but returns false
        // The error message indicates columns are undefined despite being correctly resolved
        expect(result.success).toBe(true); // Currently fails with "Undefined column(s) found in CTE"
        
        // Even though success is false, schemas are correctly collected
        expect(result.schemas.length).toBeGreaterThanOrEqual(5);
        
        const filteredSales = result.schemas.find(s => s.name === 'filtered_sales');
        expect(filteredSales).toBeDefined();
        // filtered_sales should inherit columns from sales CTE
    });

    test('should handle CTE without SELECT * (control test)', () => {
        // Arrange
        const sql = `
        WITH "sales" AS (
            SELECT "sale_id", "product_id", "quantity" FROM "sales_table"
        ), 
        "filtered_sales" AS (
            SELECT "sale_id", "product_id", "quantity" FROM "sales"
        ) 
        SELECT * FROM "filtered_sales"`;

        const parseResult = SelectQueryParser.analyze(sql);
        expect(parseResult.success).toBe(true);

        // Act
        const schemaCollector = new SchemaCollector(null, true);
        const result = schemaCollector.analyze(parseResult.query!);

        // Assert
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.schemas.length).toBeGreaterThanOrEqual(3);
        
        const filteredSales = result.schemas.find(s => s.name === 'filtered_sales');
        expect(filteredSales).toBeDefined();
        expect(filteredSales!.columns.length).toBe(3);
    });

    test('should handle nested CTEs with multiple SELECT * wildcards', () => {
        // Arrange
        const sql = `
        WITH "base" AS (
            SELECT "id", "name", "value" FROM "base_table"
        ),
        "derived1" AS (
            SELECT * FROM "base" WHERE "value" > 100
        ),
        "derived2" AS (
            SELECT * FROM "derived1" WHERE "name" LIKE '%test%'
        )
        SELECT * FROM "derived2"`;

        const parseResult = SelectQueryParser.analyze(sql);
        expect(parseResult.success).toBe(true);

        // Act
        const schemaCollector = new SchemaCollector(null, true);
        const result = schemaCollector.analyze(parseResult.query!);

        // Assert - This should also work with nested CTEs
        expect(result.success).toBe(true);
        expect(result.schemas.length).toBeGreaterThanOrEqual(4);
    });
});