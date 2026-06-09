import { describe, expect, it } from "vitest";
import { DeleteQueryParser } from "../../src/parsers/DeleteQueryParser";
import { InsertQueryParser } from "../../src/parsers/InsertQueryParser";
import { MergeQueryParser } from "../../src/parsers/MergeQueryParser";
import { UpdateQueryParser } from "../../src/parsers/UpdateQueryParser";
import { SqlFormatter } from "../../src/transformers/SqlFormatter";

describe("PostgreSQL 18 syntax", () => {
    const formatter = new SqlFormatter();

    it("formats INSERT RETURNING WITH OLD/NEW aliases", () => {
        const ast = InsertQueryParser.parse("INSERT INTO users(id) VALUES (1) RETURNING WITH (OLD AS o, NEW AS n) o.id, n.id");
        const formatted = formatter.format(ast).formattedSql;

        expect(ast.returningClause?.aliases).toHaveLength(2);
        expect(formatted).toBe('insert into "users"("id") values (1) returning with (old as "o", new as "n") "o"."id", "n"."id"');
    });

    it("formats UPDATE RETURNING WITH OLD/NEW aliases", () => {
        const ast = UpdateQueryParser.parse("UPDATE users SET name = 'next' RETURNING WITH (OLD AS o, NEW AS n) o.name, n.name");
        const formatted = formatter.format(ast).formattedSql;

        expect(ast.returningClause?.aliases.map(alias => alias.kind)).toEqual(["old", "new"]);
        expect(formatted).toBe('update "users" set "name" = \'next\' returning with (old as "o", new as "n") "o"."name", "n"."name"');
    });

    it("formats DELETE RETURNING WITH OLD alias", () => {
        const ast = DeleteQueryParser.parse("DELETE FROM users RETURNING WITH (OLD AS o) o.id");
        const formatted = formatter.format(ast).formattedSql;

        expect(ast.returningClause?.aliases).toHaveLength(1);
        expect(formatted).toBe('delete from "users" returning with (old as "o") "o"."id"');
    });

    it("formats MERGE RETURNING WITH OLD/NEW aliases", () => {
        const sql = [
            "MERGE INTO users AS target",
            "USING incoming_users AS source",
            "ON target.user_id = source.user_id",
            "WHEN MATCHED THEN UPDATE SET name = source.name",
            "WHEN NOT MATCHED THEN INSERT (user_id, name) VALUES (source.user_id, source.name)",
            "RETURNING WITH (OLD AS o, NEW AS n) o.user_id, n.name"
        ].join(" ");

        const ast = MergeQueryParser.parse(sql);
        const formatted = formatter.format(ast).formattedSql;

        expect(ast.returningClause?.aliases.map(alias => alias.kind)).toEqual(["old", "new"]);
        expect(formatted).toBe('merge into "users" as "target" using "incoming_users" as "source" on "target"."user_id" = "source"."user_id" when matched then update set "name" = "source"."name" when not matched then insert("user_id", "name") values("source"."user_id", "source"."name") returning with (old as "o", new as "n") "o"."user_id", "n"."name"');
    });
});
