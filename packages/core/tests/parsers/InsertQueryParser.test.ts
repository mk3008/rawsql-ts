import { InsertQueryParser } from "../../src/parsers/InsertQueryParser";
import { InsertQuery } from "../../src/models/InsertQuery";
import { SelectQuery, SimpleSelectQuery, ValuesQuery } from "../../src/models/SelectQuery";
import { describe, it, expect } from "vitest";
import { SqlFormatter } from "../../src/transformers/SqlFormatter";
import { OnConflictClause, TableSource, ParenSource, SourceExpression } from "../../src/models/Clause";

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
        const dataSelect = insert.selectQuery;
        expect(dataSelect).toBeInstanceOf(SimpleSelectQuery);
        expect((dataSelect as SimpleSelectQuery).withClause).not.toBeNull();
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

    it("parses PostgreSQL 19 INSERT ... ON CONFLICT DO SELECT ... RETURNING", () => {
        const sql = "INSERT INTO tags (name) VALUES ('backend') ON CONFLICT (name) DO SELECT RETURNING id";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe('insert into "tags"("name") values (\'backend\') on conflict (name) do select returning "id"');
        expect(insert.onConflictClause?.action).toBe("select");
    });

    it("parses PostgreSQL 19 ON CONFLICT DO SELECT with row lock and WHERE condition", () => {
        const sql = "INSERT INTO tags (name) VALUES ('backend') ON CONFLICT (name) DO SELECT FOR UPDATE WHERE tags.active RETURNING id, name";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe('insert into "tags"("name") values (\'backend\') on conflict (name) do select for update where "tags"."active" returning "id", "name"');
        expect(insert.onConflictClause?.forClause?.lockMode).toBe("update");
        expect(insert.onConflictClause?.whereClause).not.toBeNull();
    });

    it("parses PostgreSQL 19 ON CONFLICT ON CONSTRAINT DO SELECT", () => {
        const sql = "INSERT INTO tags (name) VALUES ('backend') ON CONFLICT ON CONSTRAINT tags_name_key DO SELECT FOR SHARE RETURNING *";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe('insert into "tags"("name") values (\'backend\') on conflict on constraint tags_name_key do select for share returning *');
        expect(insert.onConflictClause?.targetKind).toBe("constraint");
    });

    it("formats programmatic ON CONFLICT ON CONSTRAINT targets", () => {
        const clause = new OnConflictClause({
            target: "tags_name_key",
            targetKind: "constraint",
            action: "nothing"
        });

        const query = new SqlFormatter().format(clause).formattedSql;

        expect(query).toBe("on conflict on constraint tags_name_key do nothing");
    });

    it("rejects PostgreSQL 19 ON CONFLICT DO SELECT without RETURNING", () => {
        const sql = "INSERT INTO tags (name) VALUES ('backend') ON CONFLICT (name) DO SELECT";

        expect(() => InsertQueryParser.parse(sql)).toThrow("ON CONFLICT DO SELECT requires a RETURNING clause");
    });

    it("parses INSERT ... ON CONFLICT DO UPDATE", () => {
        const sql = "INSERT INTO users (id, name) VALUES (1, 'new') ON CONFLICT (id) DO UPDATE SET name = excluded.name";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe('insert into "users"("id", "name") values (1, \'new\') on conflict (id) do update set "name" = "excluded"."name"');
        expect(insert.onConflictClause?.action).toBe("update");
        expect(insert.onConflictClause?.setClause?.items).toHaveLength(1);
    });

    it("parses INSERT ... ON CONFLICT DO UPDATE with WHERE and RETURNING", () => {
        const sql = "INSERT INTO users (id, name, updated_at) VALUES (1, 'new', now()) ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_at = now() WHERE users.deleted_at IS NULL RETURNING id, name";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe('insert into "users"("id", "name", "updated_at") values (1, \'new\', now()) on conflict (id) do update set "name" = "excluded"."name", "updated_at" = now() where "users"."deleted_at" is null returning "id", "name"');
        expect(insert.onConflictClause?.whereClause).not.toBeNull();
        expect(insert.returningClause?.items).toHaveLength(2);
    });

    it("parses INSERT ... ON CONFLICT ON CONSTRAINT DO UPDATE", () => {
        const sql = "INSERT INTO users (email, name) VALUES ('a@example.com', 'new') ON CONFLICT ON CONSTRAINT users_email_key DO UPDATE SET name = excluded.name RETURNING id";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe('insert into "users"("email", "name") values (\'a@example.com\', \'new\') on conflict on constraint users_email_key do update set "name" = "excluded"."name" returning "id"');
        expect(insert.onConflictClause?.targetKind).toBe("constraint");
        expect(insert.onConflictClause?.action).toBe("update");
    });

    it("parses INSERT ... RETURNING *", () => {
        const sql = "INSERT INTO users (id, name) VALUES (1, 'a') RETURNING *";

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe("insert into \"users\"(\"id\", \"name\") values (1, 'a') returning *");
        expect(insert.returningClause?.items).toHaveLength(1);
        // items[0] is a SelectItem, check its value
        expect(insert.returningClause?.items[0].value).toBeDefined();
    });

    it("preserves comments across insert targets and returning columns", () => {
        const sql = [
            '/* head */ INSERT INTO /* target before */ users /* target after */ (',
            '    /* before id */',
            '    id /* after id */',
            ') VALUES',
            '    (1)',
            'RETURNING /* return before col */ id /* return after col */'
        ].join('\n');

        const insert = InsertQueryParser.parse(sql);
        const insertClause = insert.insertClause;
        const tableSource = insertClause.source.datasource as TableSource;

        expect(insertClause.getPositionedComments('before')).toEqual(['head']);
        expect(tableSource.getPositionedComments('before')).toEqual(['target before']);
        expect(tableSource.getPositionedComments('after')).toEqual(['target after']);

        const column = insertClause.columns?.[0];
        expect(column).toBeDefined();
        expect(column?.getPositionedComments('before')).toEqual(['before id']);
        expect(column?.getPositionedComments('after')).toEqual(['after id']);

        const returningItem = insert.returningClause?.items[0];
        expect(returningItem).toBeDefined();
        expect(returningItem?.getPositionedComments('before')).toEqual(['return before col']);
        expect(returningItem?.getPositionedComments('after')).toEqual(['return after col']);
    });

    it("parses multi-row VALUES inserts that use positional parameters for each row", () => {
        const sql = [
            'INSERT INTO sales_order_item (sales_order_item_id, sales_order_id, product_id, quantity, unit_price)',
            'VALUES',
            '    ($1, $2, $3, $4, $5),',
            '    ($6, $7, $8, $9, $10),',
            '    ($11, $12, $13, $14, $15)'
        ].join('\n');

        const insert = InsertQueryParser.parse(sql);
        const query = new SqlFormatter().format(insert).formattedSql;

        expect(query).toBe('insert into "sales_order_item"("sales_order_item_id", "sales_order_id", "product_id", "quantity", "unit_price") values (:1, :2, :3, :4, :5), (:6, :7, :8, :9, :10), (:11, :12, :13, :14, :15)');
        expect(insert.selectQuery).toBeInstanceOf(ValuesQuery);

        const valuesQuery = insert.selectQuery as ValuesQuery;
        expect(valuesQuery.tuples).toHaveLength(3);
        expect(valuesQuery.tuples[0].values).toHaveLength(5);
        expect(valuesQuery.tuples[1].values).toHaveLength(5);
        expect(valuesQuery.tuples[2].values).toHaveLength(5);
    });
});
