import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { ClauseScopedColumnReferenceCollector } from '../../src/transformers/ClauseScopedColumnReferenceCollector';
import { ColumnReferenceCollector } from '../../src/transformers/ColumnReferenceCollector';

const collect = (sql: string) => {
    const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
    return new ClauseScopedColumnReferenceCollector().collect(query);
};

const names = (refs: { qualifiedName: string }[]): string[] => {
    return refs.map(ref => ref.qualifiedName);
};

describe('ClauseScopedColumnReferenceCollector', () => {
    test('groups SELECT and WHERE references without mixing predicate-only columns into SELECT', () => {
        const refs = collect(`
            SELECT u.id
            FROM users u
            WHERE u.active = true
        `);

        expect(names(refs.select)).toEqual(['u.id']);
        expect(names(refs.where)).toEqual(['u.active']);
    });

    test('groups JOIN ON references separately from SELECT references', () => {
        const refs = collect(`
            SELECT u.id, o.total
            FROM users u
            JOIN orders o ON o.user_id = u.id AND o.deleted_at IS NULL
        `);

        expect(names(refs.select)).toEqual(['u.id', 'o.total']);
        expect(names(refs.joinOn)).toEqual(['o.user_id', 'u.id', 'o.deleted_at']);
        expect(refs.where).toEqual([]);
    });

    test('groups GROUP BY, HAVING, and ORDER BY references by clause', () => {
        const refs = collect(`
            SELECT u.region, COUNT(o.id) AS order_count
            FROM users u
            JOIN orders o ON o.user_id = u.id
            GROUP BY u.region
            HAVING COUNT(o.id) > 1
            ORDER BY u.region, COUNT(o.id) DESC
        `);

        expect(names(refs.groupBy)).toEqual(['u.region']);
        expect(names(refs.having)).toEqual(['o.id']);
        expect(names(refs.orderBy)).toEqual(['u.region', 'o.id']);
    });

    test('groups row-limiting clause references under limitOffset', () => {
        const refs = collect(`
            SELECT p.id
            FROM products p
            LIMIT p.max_rows
            OFFSET p.skip_rows
        `);

        expect(names(refs.limitOffset)).toEqual(['p.max_rows', 'p.skip_rows']);
    });

    test('does not traverse subquery bodies as root clause references', () => {
        const refs = collect(`
            SELECT u.id
            FROM users u
            WHERE EXISTS (
                SELECT 1
                FROM orders o
                WHERE o.user_id = u.id
            )
        `);

        expect(names(refs.select)).toEqual(['u.id']);
        expect(names(refs.where)).toEqual([]);
    });

    test('keeps existing ColumnReferenceCollector behavior compatible', () => {
        const query = SelectQueryParser.parse(`
            SELECT u.id
            FROM users u
            WHERE u.active = true
        `);

        const columnNames = new ColumnReferenceCollector()
            .collect(query)
            .map(ref => ref.qualifiedName.toString());

        expect(columnNames).toEqual(['u.id', 'u.active']);
    });
});
