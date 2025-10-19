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
        expect(formatted).toContain('create table if not exists "reporting.daily" as');
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
        expect(formatted).toBe('create table "archive.users"');
    });

    it("throws when encountering column definitions", () => {
        const sql = "CREATE TABLE users (id INT)";
        expect(() => CreateTableParser.parse(sql)).toThrow(/not supported/i);
    });
});
