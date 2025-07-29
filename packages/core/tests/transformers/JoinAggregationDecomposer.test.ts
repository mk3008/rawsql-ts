import { describe, test, expect, beforeEach } from "vitest";
import { SelectQueryParser } from "../../src/parsers/SelectQueryParser";
import { SimpleSelectQuery } from "../../src/models/SimpleSelectQuery";
import { SelectClause } from "../../src/models/Clause";
import { JoinAggregationDecomposer, DecompositionError } from "../../src/transformers/JoinAggregationDecomposer";
import { SqlFormatter } from "../../src/transformers/SqlFormatter";

describe("JoinAggregationDecomposer", () => {
    let decomposer: JoinAggregationDecomposer;
    let formatter: SqlFormatter;

    beforeEach(() => {
        decomposer = new JoinAggregationDecomposer();
        formatter = new SqlFormatter({ identifierEscape: { start: "", end: "" } });
    });

    describe("Analysis method - Safe exploration (Result pattern)", () => {
        test("should analyze successful decomposition", () => {
            // Given: A valid query for decomposition
            const sql = `
                SELECT c.category_name, COUNT(p.id) as product_count
                FROM categories c
                JOIN products p ON c.id = p.category_id
                GROUP BY c.category_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Analyzing the query
            const result = decomposer.analyze(query);

            // Then: Should return successful analysis with metadata
            expect(result.success).toBe(true);
            expect(result.decomposedQuery).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(result.metadata.joinCount).toBe(1);
            expect(result.metadata.aggregationCount).toBe(1);
            expect(result.metadata.hasHaving).toBe(false);
            expect(result.metadata.hasOrderBy).toBe(false);
            expect(result.metadata.hasWindowFunctions).toBe(false);
        });

        test("should reject queries with window functions due to incomplete conversion", () => {
            // Given: A query with window functions (incomplete conversion)
            const sql = `
                SELECT 
                    c.category_name,
                    COUNT(p.id) as product_count,
                    ROW_NUMBER() OVER (ORDER BY COUNT(p.id) DESC) as rank
                FROM categories c
                JOIN products p ON c.id = p.category_id
                GROUP BY c.category_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Analyzing the query
            const result = decomposer.analyze(query);

            // Then: Should fail because window function references are not converted properly
            expect(result.success).toBe(false);
            expect(result.error).toContain("Window functions");
            expect(result.metadata.hasWindowFunctions).toBe(true);
        });

        test("should analyze failed decomposition safely", () => {
            // Given: A query without JOINs
            const sql = `
                SELECT category_id, COUNT(*) as product_count
                FROM products
                GROUP BY category_id
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Analyzing the query
            const result = decomposer.analyze(query);

            // Then: Should return failure with error message
            expect(result.success).toBe(false);
            expect(result.error).toBe("Query does not contain JOINs");
            expect(result.decomposedQuery).toBeUndefined();
            expect(result.metadata.joinCount).toBe(0);
        });

        test("should analyze complex expression with incomplete column extraction", () => {
            // Given: A query with complex SUM expressions (columns not properly extracted)
            const sql = `
                SELECT 
                    c.category_name,
                    SUM(p.price * p.quantity) as total_value
                FROM categories c
                JOIN products p ON c.id = p.category_id
                GROUP BY c.category_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Analyzing the query
            const result = decomposer.analyze(query);

            // Then: Should succeed but note that the result may be logically incorrect
            // (this is a known limitation - complex expressions are not fully supported)
            expect(result.success).toBe(true);
            expect(result.decomposedQuery).toBeDefined();
            expect(result.metadata.aggregationCount).toBe(1);
        });

        test("should handle parse errors gracefully in analyze", () => {
            // Given: A query that will cause analysis issues  
            const malformedQuery = new SimpleSelectQuery({
                selectClause: new SelectClause([])
            });

            // When: Using analyze method
            const result = decomposer.analyze(malformedQuery);

            // Then: Should return failure safely
            expect(result.success).toBe(false);
            expect(result.error).toContain("does not contain FROM clause");
        });
    });

    describe("Decompose method - Direct execution (Exception pattern)", () => {
        test("should decompose simple INNER JOIN with COUNT", () => {
            // Given: A query with INNER JOIN and COUNT aggregation
            const sql = `
                SELECT c.category_name, COUNT(p.id) as product_count
                FROM categories c
                JOIN products p ON c.id = p.category_id
                GROUP BY c.category_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Decomposing the query
            const result = decomposer.decompose(query);

            // Then: Should succeed and create proper CTE structure
            const formatted = formatter.format(result).formattedSql;
            expect(formatted).toContain("with detail_data as");
            expect(formatted).toContain("select category_name, count(id) as product_count");
            expect(formatted).toContain("from detail_data group by category_name");
        });

        test("should decompose LEFT JOIN with multiple aggregations", () => {
            // Given: A query with LEFT JOIN and multiple aggregation functions
            const sql = `
                SELECT 
                    c.category_name,
                    COUNT(p.id) as product_count,
                    SUM(p.price) as total_price,
                    AVG(p.price) as avg_price
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id
                GROUP BY c.category_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Decomposing the query
            const result = decomposer.decompose(query);

            // Then: Should succeed and preserve LEFT JOIN semantics
            const formatted = formatter.format(result).formattedSql;
            expect(formatted).toContain("with detail_data as");
            expect(formatted).toContain("left join products");
            expect(formatted).toContain("count(id) as product_count");
            expect(formatted).toContain("sum(price) as total_price");
            expect(formatted).toContain("avg(price) as avg_price");
        });

        test("should handle COUNT(*) pattern", () => {
            // Given: A query with COUNT(*) aggregation
            const sql = `
                SELECT 
                    c.category_name,
                    COUNT(*) as total_records
                FROM categories c
                JOIN products p ON c.id = p.category_id
                GROUP BY c.category_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Decomposing the query
            const result = decomposer.decompose(query);

            // Then: Should succeed and handle COUNT(*) correctly
            const formatted = formatter.format(result).formattedSql;
            expect(formatted).toContain("with detail_data as");
            expect(formatted).toContain("count(*) as total_records");
        });
    });

    describe("Error scenarios - Clear failures (Exception pattern)", () => {
        test("should throw error for queries without JOINs", () => {
            // Given: A query with aggregation but no JOINs
            const sql = `
                SELECT category_id, COUNT(*) as product_count
                FROM products
                GROUP BY category_id
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When & Then: Should throw DecompositionError
            expect(() => decomposer.decompose(query)).toThrow(DecompositionError);
            expect(() => decomposer.decompose(query)).toThrow("does not contain JOINs");
        });

        test("should throw error for queries without aggregation", () => {
            // Given: A query with JOINs but no aggregation
            const sql = `
                SELECT c.category_name, p.product_name
                FROM categories c
                JOIN products p ON c.id = p.category_id
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When & Then: Should throw DecompositionError
            expect(() => decomposer.decompose(query)).toThrow(DecompositionError);
            expect(() => decomposer.decompose(query)).toThrow("does not contain GROUP BY or aggregation functions");
        });

        test("should handle multiple JOINs without artificial limits", () => {
            // Given: A query with multiple JOINs
            const sql = `
                SELECT c.customer_name, COUNT(oi.id) as item_count
                FROM customers c
                JOIN orders o ON c.id = o.customer_id
                JOIN order_items oi ON o.id = oi.order_id
                GROUP BY c.customer_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Decomposing the query
            const result = decomposer.decompose(query);

            // Then: Should succeed - no artificial JOIN limits
            const formatted = formatter.format(result).formattedSql;
            expect(formatted).toContain("with detail_data as");
            expect(formatted).toContain("join orders");
            expect(formatted).toContain("join order_items");
            expect(formatted).toContain("count(id) as item_count");
        });

        test("should handle DISTINCT aggregations with incomplete column extraction", () => {
            // Given: A query with DISTINCT aggregations (known limitation)
            const sql = `
                SELECT 
                    c.category_name,
                    COUNT(DISTINCT p.supplier_id) as unique_suppliers
                FROM categories c
                JOIN products p ON c.id = p.category_id
                GROUP BY c.category_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Decomposing the query
            const result = decomposer.decompose(query);

            // Then: Should succeed but the result may be logically incorrect
            // (supplier_id is not extracted to detail CTE)
            const formatted = formatter.format(result).formattedSql;
            expect(formatted).toContain("with detail_data as");
            expect(formatted).toContain("count(distinct p.supplier_id)");
        });

        test("should handle complex SUM expressions with incomplete column extraction", () => {
            // Given: A query with complex SUM expressions (known limitation)
            const sql = `
                SELECT 
                    c.category_name,
                    SUM(p.price * p.quantity) as total_value
                FROM categories c
                JOIN products p ON c.id = p.category_id
                GROUP BY c.category_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Decomposing the query
            const result = decomposer.decompose(query);

            // Then: Should succeed but the result may be logically incorrect
            // (price and quantity are not extracted to detail CTE)
            const formatted = formatter.format(result).formattedSql;
            expect(formatted).toContain("with detail_data as");
            expect(formatted).toContain("sum(p.price * p.quantity)");
        });
    });

    describe("Configuration and customization", () => {
        test("should use custom CTE name", () => {
            // Given: A decomposer with custom CTE name
            const customDecomposer = new JoinAggregationDecomposer({
                detailCTEName: "product_category_details"
            });
            const sql = `
                SELECT c.name, COUNT(p.id)
                FROM categories c
                JOIN products p ON c.id = p.category_id
                GROUP BY c.name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Decomposing the query
            const result = customDecomposer.decompose(query);

            // Then: Should use the custom CTE name
            const formatted = formatter.format(result).formattedSql;
            expect(formatted).toContain("with product_category_details as");
            expect(formatted).toContain("from product_category_details");
        });

        test("should handle complex JOIN scenarios naturally", () => {
            // Given: A query with multiple JOINs and complex relationships
            const sql = `
                SELECT 
                    c.customer_name,
                    COUNT(oi.id) as total_items,
                    SUM(p.price) as total_value
                FROM customers c
                JOIN orders o ON c.id = o.customer_id
                JOIN order_items oi ON o.id = oi.order_id
                JOIN products p ON oi.product_id = p.id
                WHERE c.active = true
                GROUP BY c.customer_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Decomposing the query
            const result = decomposer.decompose(query);

            // Then: Should succeed with all JOINs preserved
            const formatted = formatter.format(result).formattedSql;
            expect(formatted).toContain("with detail_data as");
            expect(formatted).toContain("join orders");
            expect(formatted).toContain("join order_items");
            expect(formatted).toContain("join products");
            expect(formatted).toContain("where c.active = true");
            expect(formatted).toContain("count(id) as total_items");
            expect(formatted).toContain("sum(price) as total_value");
        });

        test("should work with options via direct instantiation", () => {
            // Given: Custom decomposer with options
            const customDecomposer = new JoinAggregationDecomposer({
                detailCTEName: "user_order_data"
            });
            const sql = `
                SELECT u.username, COUNT(o.id) as order_count
                FROM users u
                JOIN orders o ON u.id = o.user_id
                GROUP BY u.username
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Using custom decomposer
            const result = customDecomposer.decompose(query);

            // Then: Should apply the options correctly
            const formatted = formatter.format(result).formattedSql;
            expect(formatted).toContain("with user_order_data as");
            expect(formatted).toContain("from user_order_data");
        });
    });

    describe("Window function limitations", () => {
        test("should throw error for pure window function queries", () => {
            // Given: A query with window functions but no GROUP BY
            const sql = `
                SELECT 
                    c.category_name,
                    p.product_name,
                    ROW_NUMBER() OVER (PARTITION BY c.category_name ORDER BY p.price DESC) as price_rank
                FROM categories c
                JOIN products p ON c.id = p.category_id
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When & Then: Should throw error as window functions don't require decomposition
            expect(() => decomposer.decompose(query)).toThrow(DecompositionError);
            expect(() => decomposer.decompose(query)).toThrow("does not contain GROUP BY or aggregation functions");
        });

        test("should throw error for hybrid GROUP BY with window functions", () => {
            // Given: A query with both GROUP BY and window functions
            const sql = `
                SELECT 
                    c.category_name,
                    COUNT(p.id) as product_count,
                    ROW_NUMBER() OVER (ORDER BY COUNT(p.id) DESC) as category_rank
                FROM categories c
                JOIN products p ON c.id = p.category_id
                GROUP BY c.category_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When & Then: Should throw error due to incomplete window function support
            expect(() => decomposer.decompose(query)).toThrow(DecompositionError);
            expect(() => decomposer.decompose(query)).toThrow("Window functions are not fully supported");
        });
    });

    describe("Direct error handling", () => {
        test("should throw error for invalid query structure", () => {
            // Given: A malformed query (no fromClause)
            const malformedQuery = new SimpleSelectQuery({
                selectClause: new SelectClause([])
            });

            // When & Then: Should throw DecompositionError
            expect(() => decomposer.decompose(malformedQuery)).toThrow(DecompositionError);
            expect(() => decomposer.decompose(malformedQuery)).toThrow("does not contain FROM clause");
        });

        test("should handle parsing errors gracefully in analyze", () => {
            // Given: A malformed query
            const malformedQuery = new SimpleSelectQuery({
                selectClause: new SelectClause([])
            });

            // When: Analyzing the malformed query
            const result = decomposer.analyze(malformedQuery);

            // Then: Should return failure with error message
            expect(result.success).toBe(false);
            expect(result.error).toContain("does not contain FROM clause");
        });
    });

    describe("Real-world business scenarios", () => {
        test("e-commerce product analytics scenario", () => {
            // Given: E-commerce product analytics query
            const sql = `
                SELECT 
                    c.category_name,
                    COUNT(p.product_id) as total_products,
                    SUM(p.price) as total_value,
                    AVG(p.price) as average_price
                FROM categories c
                JOIN products p ON c.category_id = p.category_id
                WHERE c.status = 'active' AND p.available = true
                GROUP BY c.category_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Decomposing for debugging purposes
            const result = decomposer.decompose(query);

            // Then: Should create debuggable structure
            const formatted = formatter.format(result).formattedSql;
            expect(formatted).toContain("with detail_data as");
            expect(formatted).toContain("where c.status = 'active' and p.available = true");
            expect(formatted).toContain("count(product_id) as total_products");
            expect(formatted).toContain("sum(price) as total_value");
            expect(formatted).toContain("avg(price) as average_price");
        });

        test("financial reporting scenario", () => {
            // Given: Department payroll reporting query
            const sql = `
                SELECT 
                    d.department_name,
                    COUNT(e.employee_id) as employee_count,
                    SUM(e.salary) as total_payroll,
                    AVG(e.salary) as average_salary
                FROM departments d
                LEFT JOIN employees e ON d.department_id = e.department_id AND e.active = true
                GROUP BY d.department_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Decomposing for audit and debugging
            const result = decomposer.decompose(query);

            // Then: Should preserve LEFT JOIN semantics for empty departments
            const formatted = formatter.format(result).formattedSql;
            expect(formatted).toContain("with detail_data as");
            expect(formatted).toContain("left join employees");
            expect(formatted).toContain("count(employee_id) as employee_count");
            expect(formatted).toContain("sum(salary) as total_payroll");
            expect(formatted).toContain("avg(salary) as average_salary");
        });
    });

    describe("Integration compatibility", () => {
        test("decomposed query should be parseable back", () => {
            // Given: A successfully decomposed query
            const sql = `
                SELECT c.name, COUNT(p.id) as count
                FROM categories c
                JOIN products p ON c.id = p.category_id
                GROUP BY c.name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const result = decomposer.decompose(query);

            // When: Formatting and re-parsing the decomposed query
            const formatted = formatter.format(result).formattedSql;

            // Then: Should be parseable back without errors
            expect(() => {
                SelectQueryParser.parse(formatted);
            }).not.toThrow();
        });

        test("should handle all basic aggregation functions", () => {
            // Given: A query with various aggregation functions
            const sql = `
                SELECT 
                    c.category_name,
                    COUNT(p.id) as total_products,
                    SUM(p.price) as total_value,
                    AVG(p.price) as average_price,
                    MIN(p.price) as cheapest,
                    MAX(p.price) as most_expensive
                FROM categories c
                JOIN products p ON c.id = p.category_id
                GROUP BY c.category_name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // When: Decomposing the query
            const result = decomposer.decompose(query);

            // Then: Should handle all aggregation functions correctly
            const formatted = formatter.format(result).formattedSql;
            expect(formatted).toContain("count(id) as total_products");
            expect(formatted).toContain("sum(price) as total_value");
            expect(formatted).toContain("avg(price) as average_price");
            expect(formatted).toContain("min(price) as cheapest");
            expect(formatted).toContain("max(price) as most_expensive");
        });
    });
});