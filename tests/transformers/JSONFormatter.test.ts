import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { JSONFormatter } from '../../src/transformers/JSONFormatter';

describe('JSONFormatter', () => {
    it('transforms a simple query to return JSON', () => {
        const query = SelectQueryParser.parse(`
            SELECT 
                id,
                name,
                age
            FROM users
            WHERE active = true
        `);

        const jsonFormatter = new JSONFormatter();
        const jsonSql = jsonFormatter.visit(query);

        expect(jsonSql).toContain('SELECT COALESCE(jsonb_agg(jsonb_build_object(');
        expect(jsonSql).toContain(`  'id', "id"`);
        expect(jsonSql).toContain(`  'name', "name"`);
        expect(jsonSql).toContain(`  'age', "age"`);
        expect(jsonSql).toContain(`)), '[]') AS result`);
        expect(jsonSql).toContain('FROM users');
        expect(jsonSql).toContain('WHERE active = true');
    });

    it('transforms a query with table aliases', () => {
        const query = SelectQueryParser.parse(`
            SELECT 
                u.id,
                u.name,
                u.email
            FROM users u
            WHERE u.active = true
        `);

        const jsonFormatter = new JSONFormatter();
        const jsonSql = jsonFormatter.visit(query);

        expect(jsonSql).toContain('SELECT COALESCE(jsonb_agg(jsonb_build_object(');
        expect(jsonSql).toContain(`  'id', "u"."id"`);
        expect(jsonSql).toContain(`  'name', "u"."name"`);
        expect(jsonSql).toContain(`  'email', "u"."email"`);
        expect(jsonSql).toContain(`)), '[]') AS result`);
        expect(jsonSql).toContain('FROM users u');
        expect(jsonSql).toContain('WHERE u.active = true');
    });

    it('handles aliased columns in SELECT', () => {
        const query = SelectQueryParser.parse(`
            SELECT 
                id,
                full_name as name,
                date_of_birth as dob
            FROM users
        `);

        const jsonFormatter = new JSONFormatter();
        const jsonSql = jsonFormatter.visit(query);

        expect(jsonSql).toContain('SELECT COALESCE(jsonb_agg(jsonb_build_object(');
        expect(jsonSql).toContain(`  'id', "id"`);
        expect(jsonSql).toContain(`  'name', full_name`);
        expect(jsonSql).toContain(`  'dob', date_of_birth`);
        expect(jsonSql).toContain(`)), '[]') AS result`);
    });

    it('allows using json_agg instead of jsonb_agg', () => {
        const query = SelectQueryParser.parse(`
            SELECT id, name FROM users
        `);

        const jsonFormatter = new JSONFormatter({ useJsonb: false });
        const jsonSql = jsonFormatter.visit(query);

        expect(jsonSql).toContain('SELECT COALESCE(json_agg(json_build_object(');
        expect(jsonSql).not.toContain('jsonb_agg');
    });

    it('supports nested objects with groupBy option', () => {
        const query = SelectQueryParser.parse(`
            SELECT
                u.id,
                u.name,
                u.email,
                o.id as order_id,
                o.total as order_total,
                o.date as order_date
            FROM users u
            JOIN orders o ON u.id = o.user_id
            WHERE u.status = 'active'
        `);

        const jsonFormatter = new JSONFormatter({ 
            groupBy: {
                'users': ['id', 'name', 'email'],
                'orders': ['order_id', 'order_total', 'order_date']
            }
        });
        const jsonSql = jsonFormatter.visit(query);

        // Check for users fields
        expect(jsonSql).toContain(`  'id', "u"."id"`);
        expect(jsonSql).toContain(`  'name', "u"."name"`);
        expect(jsonSql).toContain(`  'email', "u"."email"`);
        
        // Check for nested orders structure
        expect(jsonSql).toContain(`  'orders', (`);
        expect(jsonSql).toContain(`SELECT COALESCE(jsonb_agg(jsonb_build_object(`);
        expect(jsonSql).toContain(`      'order_id', "order_id"`);
        expect(jsonSql).toContain(`      'order_total', "order_total"`);
        expect(jsonSql).toContain(`      'order_date', "order_date"`);
        expect(jsonSql).toContain(`    FROM orders`);
        expect(jsonSql).toContain(`    WHERE orders.users_id = users.id`);
    });

    it('preserves additional clauses like GROUP BY, HAVING, ORDER BY', () => {
        const query = SelectQueryParser.parse(`
            SELECT 
                category,
                COUNT(*) as count
            FROM products
            GROUP BY category
            HAVING COUNT(*) > 5
            ORDER BY count DESC
            LIMIT 10
        `);

        const jsonFormatter = new JSONFormatter();
        const jsonSql = jsonFormatter.visit(query);

        expect(jsonSql).toContain('GROUP BY category');
        expect(jsonSql).toContain('HAVING COUNT(*) > 5');
        expect(jsonSql).toContain('ORDER BY count DESC');
        expect(jsonSql).toContain('LIMIT 10');
    });

    it('throws error for unsupported binary queries', () => {
        const query = SelectQueryParser.parse(`
            SELECT id, name FROM users
            UNION
            SELECT id, name FROM archived_users
        `);

        const jsonFormatter = new JSONFormatter();
        expect(() => jsonFormatter.visit(query)).toThrow(/not supported/);
    });
});