import { InsertQueryParser } from "../../src/parsers/InsertQueryParser";
import { InsertQuery } from "../../src/models/InsertQuery";
import { SelectQuery } from "../../src/models/SelectQuery";
import { describe, it, expect } from "vitest";
import { Formatter } from "../../src/transformers/Formatter";

describe("InsertQueryParser", () => {
    it("parses INSERT INTO table SELECT ...", () => {
        // Arrange
        const sql = "INSERT INTO users SELECT * FROM accounts";

        // Act
        const insert = InsertQueryParser.parse(sql);

        // Assert
        const query = new Formatter().format(insert);
        expect(insert).toBeInstanceOf(InsertQuery);
        expect(insert.table.name).toBe("users");
        expect(insert.columns.length).toBe(0);
        expect(query).toBe('insert into "users" select * from "accounts"');
    });

    it("parses INSERT INTO table (col1, col2) SELECT ...", () => {
        // Arrange
        const sql = "INSERT INTO users (id, name) SELECT id, name FROM accounts";

        // Act
        const insert = InsertQueryParser.parse(sql);
        const query = new Formatter().format(insert);

        // Assert
        expect(insert.table.name).toBe("users");
        expect(insert.columns.map(c => c.name)).toEqual(["id", "name"]);
        expect(query).toBe('insert into "users" ("id", "name") select "id", "name" from "accounts"');
    });

    it("parses INSERT INTO table (col1, col2) WITH ... SELECT ...", () => {
        // Arrange
        const sql = "INSERT INTO users (id, name) WITH t AS (SELECT 1 AS id, 'a' AS name) SELECT * FROM t";

        // Act
        const insert = InsertQueryParser.parse(sql);
        const query = new Formatter().format(insert);

        // Assert
        expect(insert.table.name).toBe("users");
        expect(insert.columns.map(c => c.name)).toEqual(["id", "name"]);
        // WITH clause should be present in selectQuery
        // @ts-ignore
        expect(insert.selectQuery.WithClause).not.toBeNull();
        expect(query).toBe("insert into \"users\" (\"id\", \"name\") with \"t\" as (select 1 as \"id\", 'a' as \"name\") select * from \"t\"");
    });

    it("parses INSERT INTO db.schema.users (col1) SELECT ...", () => {
        // Arrange
        const sql = "INSERT INTO db.schema.users (id) SELECT id FROM accounts";

        // Act
        const insert = InsertQueryParser.parse(sql);
        const query = new Formatter().format(insert);

        // Assert
        expect(insert.table.name).toBe("users");
        expect(insert.namespaces && insert.namespaces.map(ns => ns.name)).toEqual(["db", "schema"]);
        expect(insert.columns.map(c => c.name)).toEqual(["id"]);
        expect(query).toBe('insert into "db"."schema"."users" ("id") select "id" from "accounts"');
    });

    it("throws on missing SELECT/VALUES", () => {
        expect(() => InsertQueryParser.parse("INSERT INTO users (id)"))
            .toThrow();
    });
});
