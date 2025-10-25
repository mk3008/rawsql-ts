import { describe, it, expect } from "vitest";
import { DropTableParser } from "../../src/parsers/DropTableParser";
import { DropIndexParser } from "../../src/parsers/DropIndexParser";
import { CreateIndexParser } from "../../src/parsers/CreateIndexParser";
import { AlterTableParser } from "../../src/parsers/AlterTableParser";
import { DropConstraintParser } from "../../src/parsers/DropConstraintParser";
import { SqlFormatter } from "../../src/transformers/SqlFormatter";
import {
    CreateIndexStatement,
    AlterTableStatement,
    AlterTableAddConstraint,
    AlterTableDropConstraint
} from "../../src/models/DDLStatements";


describe("DDL Parsers", () => {
    it("parses DROP TABLE with behavior", () => {
        const sql = "DROP TABLE IF EXISTS public.users, audit.log CASCADE";
        const ast = DropTableParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.ifExists).toBe(true);
        expect(ast.tables).toHaveLength(2);
        expect(ast.behavior).toBe("cascade");
        expect(formatted).toBe('drop table if exists "public"."users", "audit"."log" cascade');
    });

    it("parses CREATE INDEX with options", () => {
        const sql = `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
ON public.users USING btree (lower(email) DESC NULLS LAST, created_at ASC)
INCLUDE (tenant_id)
WITH (fillfactor = 80)
TABLESPACE fastdisk
WHERE active = true`;

        const ast = CreateIndexParser.parse(sql) as CreateIndexStatement;
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.unique).toBe(true);
        expect(ast.concurrently).toBe(true);
        expect(ast.ifNotExists).toBe(true);
        expect(ast.columns).toHaveLength(2);
        expect(ast.include).toHaveLength(1);
        expect(ast.where).toBeTruthy();
        expect(formatted).toContain('create unique index concurrently if not exists "idx_users_email" on "public"."users" using "btree"');
        expect(formatted).toContain('include ("tenant_id")');
        expect(formatted).toContain('where "active" = true');
    });

    it("parses DROP INDEX with modifiers", () => {
        const sql = "DROP INDEX CONCURRENTLY IF EXISTS idx_users_email, idx_users_active RESTRICT";
        const ast = DropIndexParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.concurrently).toBe(true);
        expect(ast.ifExists).toBe(true);
        expect(ast.indexNames).toHaveLength(2);
        expect(ast.behavior).toBe("restrict");
        expect(formatted).toBe('drop index concurrently if exists "idx_users_email", "idx_users_active" restrict');
    });

    it("rejects DROP INDEX when options are out of order", () => {
        const sql = "DROP INDEX IF EXISTS CONCURRENTLY idx_users_email";
        expect(() => DropIndexParser.parse(sql)).toThrow(/expected index name immediately after if exists/i);
    });

    it("parses ALTER TABLE constraint actions", () => {
        const sql = `ALTER TABLE IF EXISTS ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email),
    ADD CONSTRAINT users_role_fk FOREIGN KEY (role_id) REFERENCES public.roles(id) DEFERRABLE INITIALLY DEFERRED,
    DROP CONSTRAINT IF EXISTS users_old_fk CASCADE`;

        const ast = AlterTableParser.parse(sql) as AlterTableStatement;
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.ifExists).toBe(true);
        expect(ast.only).toBe(true);
        expect(ast.actions).toHaveLength(3);
        const addAction = ast.actions[0] as AlterTableAddConstraint;
        expect(addAction.constraint.kind).toBe("unique");
        const dropAction = ast.actions[2] as AlterTableDropConstraint;
        expect(dropAction.ifExists).toBe(true);
        expect(dropAction.behavior).toBe("cascade");
        expect(formatted).toContain('alter table if exists only "public"."users" add constraint "users_email_key" unique ("email"),');
        expect(formatted).toContain('drop constraint if exists "users_old_fk" cascade');
    });

    it("parses standalone DROP CONSTRAINT", () => {
        const sql = "DROP CONSTRAINT IF EXISTS orphan_check RESTRICT";
        const ast = DropConstraintParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.ifExists).toBe(true);
        expect(ast.behavior).toBe("restrict");
        expect(formatted).toBe('drop constraint if exists "orphan_check" restrict');
    });
});
