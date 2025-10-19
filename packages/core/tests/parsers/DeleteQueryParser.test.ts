import { describe, it, expect } from "vitest";
import { DeleteQueryParser } from "../../src/parsers/DeleteQueryParser";
import { SqlFormatter } from "../../src/transformers/SqlFormatter";
import { TableSource } from "../../src/models/Clause";

describe("DeleteQueryParser", () => {
    it("formats DELETE with table alias in delete target", () => {
        // Arrange
        const sql = "DELETE FROM users u WHERE u.id = 10";

        // Act
        const ast = DeleteQueryParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(formatted).toBe("delete from \"users\" as \"u\" where \"u\".\"id\" = 10");
    });

    it("formats simple DELETE ... WHERE ...", () => {
        // Arrange
        const sql = "DELETE FROM users WHERE id = 1";

        // Act
        const ast = DeleteQueryParser.parse(sql);

        // Assert
        const formatted = new SqlFormatter().format(ast).formattedSql;
        expect(formatted).toBe("delete from \"users\" where \"id\" = 1");
    });

    it("formats DELETE with schema and RETURNING", () => {
        // Arrange
        const sql = "DELETE FROM public.users RETURNING id, name";

        // Act
        const ast = DeleteQueryParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(formatted).toBe("delete from \"public\".\"users\" returning \"id\", \"name\"");
    });

    it("formats DELETE with USING clause", () => {
        // Arrange
        const sql = "DELETE FROM sales.orders o USING sales.customers c WHERE o.customer_id = c.id";

        // Act
        const ast = DeleteQueryParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(formatted).toBe("delete from \"sales\".\"orders\" as \"o\" using \"sales\".\"customers\" as \"c\" where \"o\".\"customer_id\" = \"c\".\"id\"");
    });

    it("formats DELETE with CTE (WITH clause)", () => {
        // Arrange
        const sql = "WITH old_users AS (SELECT id FROM users WHERE active = false) DELETE FROM users WHERE id IN (SELECT id FROM old_users)";

        // Act
        const ast = DeleteQueryParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(formatted).toBe('with "old_users" as (select "id" from "users" where "active" = false) delete from "users" where "id" in (select "id" from "old_users")');
    });

    it("parses DELETE with WITH RECURSIVE CTE", () => {
        // Arrange
        const sql = `
            WITH RECURSIVE subordinates AS (
                SELECT id, manager_id FROM employees WHERE manager_id = 1
                UNION ALL
                SELECT e.id, e.manager_id
                FROM employees e
                JOIN subordinates s ON s.id = e.manager_id
            )
            DELETE FROM employees e USING subordinates s WHERE e.id = s.id
        `;

        // Act
        const ast = DeleteQueryParser.parse(sql);

        // Assert
        expect(ast.withClause).not.toBeNull();
        expect(ast.withClause?.recursive).toBe(true);
        expect(ast.withClause?.tables.length).toBeGreaterThan(0);
        const formatted = new SqlFormatter().format(ast).formattedSql;
        expect(formatted).toContain('with recursive "subordinates" as');
    });

    it("parses USING clause sources and aliases", () => {
        // Arrange
        const sql = "DELETE FROM sales.orders o USING sales.customers c, logistics.warehouses w WHERE o.customer_id = c.id AND o.warehouse_id = w.id";

        // Act
        const ast = DeleteQueryParser.parse(sql);

        // Assert
        expect(ast.usingClause).not.toBeNull();
        const usingClause = ast.usingClause!;
        expect(usingClause.sources).toHaveLength(2);

        const [customersSource, warehousesSource] = usingClause.sources;
        expect(customersSource.getAliasName()).toBe("c");
        expect(warehousesSource.getAliasName()).toBe("w");

        expect(customersSource.datasource).toBeInstanceOf(TableSource);
        expect((customersSource.datasource as TableSource).getSourceName()).toBe("sales.customers");

        expect(warehousesSource.datasource).toBeInstanceOf(TableSource);
        expect((warehousesSource.datasource as TableSource).getSourceName()).toBe("logistics.warehouses");
    });
});
