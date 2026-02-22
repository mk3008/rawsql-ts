import { describe, it, expect } from "vitest";
import { DropTableParser } from "../../src/parsers/DropTableParser";
import { DropIndexParser } from "../../src/parsers/DropIndexParser";
import { CreateIndexParser } from "../../src/parsers/CreateIndexParser";
import { AlterTableParser } from "../../src/parsers/AlterTableParser";
import { DropConstraintParser } from "../../src/parsers/DropConstraintParser";
import { CreateSequenceParser, AlterSequenceParser } from "../../src/parsers/SequenceParser";
import { CreateSchemaParser } from "../../src/parsers/CreateSchemaParser";
import { DropSchemaParser } from "../../src/parsers/DropSchemaParser";
import { CommentOnParser } from "../../src/parsers/CommentOnParser";
import { SqlFormatter } from "../../src/transformers/SqlFormatter";
import { FunctionCall, LiteralValue } from "../../src/models/ValueComponent";
import {
    CreateIndexStatement,
    AlterTableStatement,
    AlterTableAddConstraint,
    AlterTableDropConstraint,
    AlterTableDropColumn,
    AlterTableAlterColumnDefault,
    CommentOnStatement,
    SequenceRestartClause,
    SequenceOwnedByClause,
    SequenceMinValueClause,
    SequenceMaxValueClause
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
        expect(formatted).toContain('alter table if exists only "public"."users" add constraint "users_email_key" unique("email"),');
        expect(formatted).toContain('drop constraint if exists "users_old_fk" cascade');
    });

    it("parses ALTER TABLE drop column action", () => {
        const sql = `ALTER TABLE public.child_table DROP COLUMN IF EXISTS child_name_text CASCADE`;

        const ast = AlterTableParser.parse(sql) as AlterTableStatement;
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.actions).toHaveLength(1);
        const dropColumn = ast.actions[0] as AlterTableDropColumn;
        expect(dropColumn.columnName.name).toBe("child_name_text");
        expect(dropColumn.ifExists).toBe(true);
        expect(dropColumn.behavior).toBe("cascade");
        expect(formatted).toBe('alter table "public"."child_table" drop column if exists "child_name_text" cascade');
    });

    it("parses standalone DROP CONSTRAINT", () => {
        const sql = "DROP CONSTRAINT IF EXISTS orphan_check RESTRICT";
        const ast = DropConstraintParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.ifExists).toBe(true);
        expect(ast.behavior).toBe("restrict");
        expect(formatted).toBe('drop constraint if exists "orphan_check" restrict');
    });

    it("parses CREATE SCHEMA with IF NOT EXISTS and AUTHORIZATION", () => {
        const sql = "CREATE SCHEMA IF NOT EXISTS tenant AUTHORIZATION admin";
        const ast = CreateSchemaParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.ifNotExists).toBe(true);
        expect(ast.schemaName.toString()).toBe("tenant");
        expect(ast.authorization?.name).toBe("admin");
        expect(formatted).toBe('create schema if not exists "tenant" authorization "admin"');
    });

    it("parses DROP SCHEMA with multiple targets and behavior", () => {
        const sql = "DROP SCHEMA IF EXISTS public, audit CASCADE";
        const ast = DropSchemaParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.ifExists).toBe(true);
        expect(ast.schemaNames.map(schema => schema.toString())).toEqual(["public", "audit"]);
        expect(ast.behavior).toBe("cascade");
        expect(formatted).toBe('drop schema if exists "public", "audit" cascade');
    });

    it("parses COMMENT ON TABLE with literal value", () => {
        const sql = "COMMENT ON TABLE public.users IS 'application users'";
        const ast = CommentOnParser.parse(sql) as CommentOnStatement;
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.targetKind).toBe("table");
        expect(ast.target.toString()).toBe("public.users");
        expect(formatted).toBe('comment on table "public"."users" is \'application users\'');
    });

    it("parses COMMENT ON COLUMN with NULL value", () => {
        const sql = "COMMENT ON COLUMN public.users.email IS NULL";
        const ast = CommentOnParser.parse(sql) as CommentOnStatement;
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.targetKind).toBe("column");
        expect(ast.target.toString()).toBe("public.users.email");
        expect(ast.comment).toBeNull();
        expect(formatted).toBe('comment on column "public"."users"."email" is null');
    });

    it("parses CREATE SEQUENCE with sequence options", () => {
        const sql = `CREATE SEQUENCE user_id_seq
    INCREMENT BY 1
    START WITH 1
    MINVALUE 1
    MAXVALUE 9223372036854775807
    CACHE 1`;
        const ast = CreateSequenceParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.sequenceName.toString()).toBe("user_id_seq");
        expect(ast.clauses.map((clause) => clause.kind)).toEqual([
            "increment",
            "start",
            "minValue",
            "maxValue",
            "cache"
        ]);
        const minClause = ast.clauses.find(
            (clause): clause is SequenceMinValueClause => clause.kind === "minValue"
        );
        const maxClause = ast.clauses.find(
            (clause): clause is SequenceMaxValueClause => clause.kind === "maxValue"
        );
        expect(minClause?.value).toBeInstanceOf(LiteralValue);
        expect((minClause?.value as LiteralValue).value).toBe(1);
        expect(maxClause?.value).toBeInstanceOf(LiteralValue);
        // Note: 9223372036854775807 exceeds Number.MAX_SAFE_INTEGER, so the parsed literal is rounded.
        expect((maxClause?.value as LiteralValue).value).toBe(9223372036854776000);
        expect(formatted).toContain('create sequence "user_id_seq"');
        expect(formatted).toContain("increment by 1");
        expect(formatted).toContain("start with 1");
        expect(formatted).toContain("minvalue 1");
        expect(formatted).toContain("maxvalue");
        expect(formatted).toContain("cache 1");
    });

    it("parses ALTER SEQUENCE restart and ownership clauses", () => {
        const sql = `ALTER SEQUENCE user_id_seq
    RESTART WITH 1000
    OWNED BY users.id`;
        const ast = AlterSequenceParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        const restartClause = ast.clauses.find(
            (clause): clause is SequenceRestartClause => clause.kind === "restart"
        );
        expect(restartClause?.value).toBeInstanceOf(LiteralValue);
        expect((restartClause?.value as LiteralValue).value).toBe(1000);

        const ownedClause = ast.clauses.find(
            (clause): clause is SequenceOwnedByClause => clause.kind === "ownedBy"
        );
        expect(ownedClause?.target?.toString()).toBe("users.id");
        expect(formatted).toContain('alter sequence "user_id_seq" restart with 1000 owned by "users"."id"');
    });

    it("parses ALTER SEQUENCE restart without WITH clause", () => {
        const sql = `ALTER SEQUENCE user_id_seq
    RESTART 5000
    OWNED BY users.id`;
        const ast = AlterSequenceParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        const restartClause = ast.clauses.find(
            (clause): clause is SequenceRestartClause => clause.kind === "restart"
        );
        expect(restartClause?.value).toBeInstanceOf(LiteralValue);
        expect((restartClause?.value as LiteralValue).value).toBe(5000);
        expect(formatted).toContain('alter sequence "user_id_seq" restart with 5000 owned by "users"."id"');
    });

    it("parses ALTER TABLE ALTER COLUMN SET DEFAULT", () => {
        const sql = `ALTER TABLE ONLY users
    ALTER COLUMN id
    SET DEFAULT nextval('user_id_seq')`;
        const ast = AlterTableParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        const alterAction = ast.actions.find(
            (action) => action instanceof AlterTableAlterColumnDefault
        ) as AlterTableAlterColumnDefault;
        expect(alterAction).toBeTruthy();
        expect(alterAction.columnName.name).toBe("id");
        expect(alterAction.setDefault).toBeInstanceOf(FunctionCall);
        expect(alterAction.dropDefault).toBe(false);
        expect(formatted).toContain('alter table only "users" alter column "id" set default nextval(');
    });
});
