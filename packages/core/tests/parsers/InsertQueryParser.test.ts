import { InsertQueryParser } from "../../src/parsers/InsertQueryParser";
import { InsertQuery } from "../../src/models/InsertQuery";
import { SelectQuery } from "../../src/models/SelectQuery";
import { describe, it, expect } from "vitest";
import { SqlFormatter } from "../../src/transformers/SqlFormatter";
import { TableSource, ParenSource, SourceExpression } from "../../src/models/Clause";

describe("InsertQueryParser", () => {
    it("parses INSERT INTO table SELECT ...", () => {
        const sql = "INSERT INTO users SELECT * FROM accounts";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe('insert into "users" select * from "accounts"');
    });

    it("parses INSERT INTO table (col1, col2) SELECT ...", () => {
        const sql = "INSERT INTO users (id, name) SELECT id, name FROM accounts";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe('insert into "users"("id", "name") select "id", "name" from "accounts"');
    });

    it("parses INSERT INTO table (col1, col2) WITH ... SELECT ...", () => {
        const sql = "WITH t AS (SELECT 1 AS id, 'a' AS name) INSERT INTO users (id, name) SELECT * FROM t";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe("with \"t\" as (select 1 as \"id\", 'a' as \"name\") insert into \"users\"(\"id\", \"name\") select * from \"t\"");
        expect(insert.withClause).not.toBeNull();
    });

    it("parses INSERT INTO db.schema.users (col1) SELECT ...", () => {
        const sql = "INSERT INTO db.schema.users (id) SELECT id FROM accounts";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe('insert into "db"."schema"."users"("id") select "id" from "accounts"');
    });

    it("parses INSERT ... VALUES without column list", () => {
        const sql = "INSERT INTO users VALUES (1, 'a')";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe("insert into \"users\" values (1, 'a')");
        expect(insert.insertClause.columns).toBeNull();
    });

    it("parses INSERT ... VALUES ... RETURNING", () => {
        const sql = "INSERT INTO users (id, name) VALUES (1, 'a') RETURNING id, name";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe("insert into \"users\"(\"id\", \"name\") values (1, 'a') returning \"id\", \"name\"");
        expect(insert.returningClause).not.toBeNull();
    });

    it("parses INSERT ... RETURNING *", () => {
        const sql = "INSERT INTO users (id, name) VALUES (1, 'a') RETURNING *";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe("insert into \"users\"(\"id\", \"name\") values (1, 'a') returning *");
        expect(insert.returningClause?.columns).toHaveLength(1);
        expect(insert.returningClause?.columns[0].name).toBe("*");
    });
});
