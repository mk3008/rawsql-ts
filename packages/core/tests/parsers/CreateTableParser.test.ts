import { describe, it, expect } from "vitest";
import { CreateTableParser } from "../../src/parsers/CreateTableParser";
import { SqlFormatter } from "../../src/transformers/SqlFormatter";
import { CreateTableQuery } from "../../src/models/CreateTableQuery";

describe("CreateTableParser", () => {
    it("parses CREATE TABLE ... AS SELECT", () => {
        // Arrange
        const sql = "CREATE TABLE reports AS SELECT id, name FROM users";

        // Act
        const ast = CreateTableParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(ast).toBeInstanceOf(CreateTableQuery);
        expect(ast.isTemporary).toBe(false);
        expect(ast.ifNotExists).toBe(false);
        expect(ast.asSelectQuery).not.toBeUndefined();
        expect(formatted).toBe('create table "reports" as select "id", "name" from "users"');
    });

    it("parses CREATE TEMPORARY TABLE ... AS SELECT", () => {
        // Arrange
        const sql = "CREATE TEMPORARY TABLE tmp_daily AS SELECT id FROM users";

        // Act
        const ast = CreateTableParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(ast.isTemporary).toBe(true);
        expect(ast.ifNotExists).toBe(false);
        expect(formatted).toBe('create temporary table "tmp_daily" as select "id" from "users"');
    });

    it("parses CREATE TABLE IF NOT EXISTS ... AS SELECT", () => {
        // Arrange
        const sql = "CREATE TABLE IF NOT EXISTS reporting.daily AS WITH recent AS (SELECT id FROM users) SELECT id FROM recent";

        // Act
        const ast = CreateTableParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(ast.asSelectQuery).not.toBeUndefined();
        expect(ast.ifNotExists).toBe(true);
        expect(formatted).toContain('create table if not exists "reporting"."daily" as');
        expect(formatted).toContain('with "recent" as (select "id" from "users") select "id" from "recent"');
    });

    it("allows CREATE TABLE without AS SELECT", () => {
        // Arrange
        const sql = "CREATE TABLE archive.users";

        // Act
        const ast = CreateTableParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        // Assert
        expect(ast.asSelectQuery).toBeUndefined();
        expect(ast.ifNotExists).toBe(false);
        expect(formatted).toBe('create table "archive"."users"');
    });

    it("parses column definitions with constraints", () => {
        const sql = `CREATE TABLE public.users (
            id BIGINT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            role_id INT REFERENCES auth.roles(id) ON DELETE CASCADE,
            CONSTRAINT users_role_fk FOREIGN KEY (role_id) REFERENCES auth.roles(id) DEFERRABLE INITIALLY DEFERRED
        ) WITH (fillfactor = 80)`;

        const ast = CreateTableParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.columns).toHaveLength(3);
        expect(ast.tableConstraints).toHaveLength(1);
        expect(ast.tableOptions?.value.toLowerCase().replace(/\s+/g, " ")).toBe("with (fillfactor = 80)");

        const idColumn = ast.columns[0];
        expect(idColumn.constraints.map(c => c.kind)).toContain("primary-key");
        const emailColumn = ast.columns[1];
        expect(emailColumn.constraints.some(c => c.kind === "not-null")).toBe(true);
        expect(emailColumn.constraints.some(c => c.kind === "unique")).toBe(true);
        const fkConstraint = ast.tableConstraints[0];
        expect(fkConstraint.kind).toBe("foreign-key");
        expect(fkConstraint.reference?.deferrable).toBe("deferrable");
        expect(fkConstraint.reference?.initially).toBe("deferred");
        const roleColumn = ast.columns[2];
        const referenceConstraint = roleColumn.constraints.find(c => c.kind === "references");
        expect(referenceConstraint?.reference?.onDelete).toBe("cascade");

        expect(formatted).toContain('create table "public"."users"');
        expect(formatted).toContain('foreign key("role_id") references "auth"."roles"("id") deferrable initially deferred');
        expect(formatted).toContain('with (fillfactor = 80)');
    });

    it("parses CREATE TABLE ... AS SELECT WITH DATA", () => {
        const sql = [
            "CREATE TABLE backup_users AS",
            "SELECT * FROM users",
            "WITH DATA"
        ].join("\n");

        const ast = CreateTableParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.asSelectQuery).toBeDefined();
        expect(ast.withDataOption).toBe("with-data");
        expect(formatted).toContain('with data');
    });

    it("parses CREATE TABLE ... AS SELECT WITH NO DATA", () => {
        const sql = [
            "CREATE TABLE empty_users AS",
            "SELECT * FROM users",
            "WITH NO DATA"
        ].join("\n");

        const ast = CreateTableParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.asSelectQuery).toBeDefined();
        expect(ast.withDataOption).toBe("with-no-data");
        expect(formatted).toContain('with no data');
    });
});

