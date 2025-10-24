import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { QueryBuilder } from '../../src/transformers/QueryBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

describe('buildDeleteQuery', () => {
    it('builds DELETE using QueryBuilder with primary key match', () => {
        const select = SelectQueryParser.parse('SELECT id FROM users_staging WHERE flagged = true') as SimpleSelectQuery;

        const deleteQuery = QueryBuilder.buildDeleteQuery(select, {
            target: 'users u',
            primaryKeys: 'id',
            sourceAlias: 'src'
        });
        const sql = new SqlFormatter().format(deleteQuery).formattedSql;

        expect(sql).toBe('delete from "users" as "u" using (select "id" from "users_staging" where "flagged" = true) as "src" where "u"."id" = "src"."id"');
    });

    it('builds DELETE via SelectQuery method with additional match columns', () => {
        const select = SelectQueryParser.parse('SELECT id, tenant_id FROM users_staging') as SimpleSelectQuery;

        const deleteQuery = select.toDeleteQuery({
            target: 'users',
            primaryKeys: 'id',
            columns: ['tenant_id'],
            sourceAlias: 'src'
        });
        const sql = new SqlFormatter().format(deleteQuery).formattedSql;

        expect(sql).toBe('delete from "users" using (select "id", "tenant_id" from "users_staging") as "src" where "users"."id" = "src"."id" and "users"."tenant_id" = "src"."tenant_id"');
    });

    it('hoists CTEs when building DELETE queries', () => {
        const select = SelectQueryParser.parse(
            'WITH flagged AS (SELECT id FROM users_staging WHERE flagged = true) SELECT id FROM flagged'
        ) as SimpleSelectQuery;

        const deleteQuery = QueryBuilder.buildDeleteQuery(select, {
            target: 'users',
            primaryKeys: 'id'
        });
        const sql = new SqlFormatter().format(deleteQuery).formattedSql;

        expect(sql).toBe(
            'with "flagged" as (select "id" from "users_staging" where "flagged" = true) delete from "users" using (select "id" from "flagged") as "src" where "users"."id" = "src"."id"'
        );
    });

    it('uses default source alias when none is provided', () => {
        const select = SelectQueryParser.parse('SELECT id FROM users_staging') as SimpleSelectQuery;

        const deleteQuery = QueryBuilder.buildDeleteQuery(select, {
            target: 'users',
            primaryKeys: 'id'
        });
        const sql = new SqlFormatter().format(deleteQuery).formattedSql;

        expect(sql).toBe('delete from "users" using (select "id" from "users_staging") as "src" where "users"."id" = "src"."id"');
    });

    it('deduplicates composite primary keys when building predicates', () => {
        const select = SelectQueryParser.parse('SELECT id, tenant_id FROM users_staging') as SimpleSelectQuery;

        const deleteQuery = QueryBuilder.buildDeleteQuery(select, {
            target: 'users',
            primaryKeys: ['id', 'tenant_id', 'id'],
            columns: ['tenant_id', 'status'],
            sourceAlias: 'alias_src'
        });
        const sql = new SqlFormatter().format(deleteQuery).formattedSql;

        expect(sql).toBe(
            'delete from "users" using (select "id", "tenant_id" from "users_staging") as "alias_src" where "users"."id" = "alias_src"."id" and "users"."tenant_id" = "alias_src"."tenant_id"'
        );
    });
});
