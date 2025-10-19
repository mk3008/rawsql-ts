import { describe, it, expect } from "vitest";
import { UpdateQueryParser } from "../../src/parsers/UpdateQueryParser";
import { UpdateQuery } from "../../src/models/UpdateQuery";
import { SqlFormatter } from "../../src/transformers/SqlFormatter";

describe("UpdateQueryParser", () => {
    it("formats UPDATE with table alias in updateTableExpr", () => {
        // Arrange
        const sql = "UPDATE users u SET name = 'AliasTest' WHERE u.id = 10";

        // Act
        const ast = UpdateQueryParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(formatted).toBe("update \"users\" as \"u\" set \"name\" = 'AliasTest' where \"u\".\"id\" = 10");
    });

    it("formats simple UPDATE ... SET ... WHERE ...", () => {
        // Arrange
        const sql = "UPDATE users SET name = 'Alice', age = 18 WHERE id = 1";

        //  Act
        const ast = UpdateQueryParser.parse(sql);

        // Assert
        const formatted = new SqlFormatter().format(ast).formattedSql;
        expect(formatted).toBe("update \"users\" set \"name\" = 'Alice', \"age\" = 18 where \"id\" = 1");
    });

    it("formats UPDATE with schema and RETURNING", () => {
        // Arrange
        const sql = "UPDATE public.users SET active = true RETURNING id, name";

        // Act
        const ast = UpdateQueryParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(formatted).toBe("update \"public\".\"users\" set \"active\" = true returning \"id\", \"name\"");
    });

    it("formats UPDATE with RETURNING *", () => {
        // Arrange
        const sql = "UPDATE public.users SET active = true RETURNING *";

        // Act
        const ast = UpdateQueryParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(formatted).toBe("update \"public\".\"users\" set \"active\" = true returning *");
        expect(ast.returningClause?.columns).toHaveLength(1);
        expect(ast.returningClause?.columns[0].name).toBe("*");
    });

    it("formats UPDATE ... FROM ...", () => {
        // Arrange
        const sql = "UPDATE users SET name = 'Bob' FROM other_users WHERE users.id = other_users.id";

        // Act
        const ast = UpdateQueryParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(formatted).toBe("update \"users\" set \"name\" = 'Bob' from \"other_users\" where \"users\".\"id\" = \"other_users\".\"id\"");
    });

    it("formats UPDATE with CTE (WITH clause)", () => {
        // Arrange
        const sql = "WITH active_users AS (SELECT id FROM users WHERE active = true) UPDATE users SET name = 'CTE' WHERE id IN (SELECT id FROM active_users)";

        // Act
        const ast = UpdateQueryParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(formatted).toBe('with "active_users" as (select "id" from "users" where "active" = true) update "users" set "name" = \'CTE\' where "id" in (select "id" from "active_users")');
    });
});

