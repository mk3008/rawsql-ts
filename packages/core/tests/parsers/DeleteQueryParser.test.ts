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
        const sql = "DELETE FROM users USING other_users WHERE users.id = other_users.id";

        // Act
        const ast = DeleteQueryParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(formatted).toBe("delete from \"users\" using \"other_users\" where \"users\".\"id\" = \"other_users\".\"id\"");
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

    it("parses USING clause sources and aliases", () => {
        // Arrange
        const sql = "DELETE FROM orders o USING customers c, warehouses w WHERE o.customer_id = c.id AND o.warehouse_id = w.id";

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
        expect((customersSource.datasource as TableSource).getSourceName()).toBe("customers");

        expect(warehousesSource.datasource).toBeInstanceOf(TableSource);
        expect((warehousesSource.datasource as TableSource).getSourceName()).toBe("warehouses");
    });
});
