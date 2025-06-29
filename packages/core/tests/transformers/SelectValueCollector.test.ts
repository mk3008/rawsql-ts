import { describe, expect, test } from 'vitest';
import { SelectValueCollector } from '../../src/transformers/SelectValueCollector';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('SelectItemCollector', () => {
    test('collects select items from simple SELECT query', () => {
        // Arrange
        const sql = `SELECT id, name, created_at FROM users`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectValueCollector();

        // Act
        const selectItems = collector.collect(query);

        // Assert
        expect(selectItems.length).toBe(3);
        expect(selectItems.map(item => item.name)).toEqual(['id', 'name', 'created_at']);
    });

    test('collects select items with aliases', () => {
        // Arrange
        const sql = `SELECT id as user_id, name as user_name FROM users`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectValueCollector();

        // Act
        const selectItems = collector.collect(query);

        // Assert
        expect(selectItems.length).toBe(2);
        expect(selectItems.map(item => item.name)).toEqual(['user_id', 'user_name']);
    });

    test('collects select items from query with functions', () => {
        // Arrange
        const sql = `SELECT COUNT(*) as count, MAX(salary) as max_salary FROM employees`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectValueCollector();

        // Act
        const selectItems = collector.collect(query);

        // Assert
        expect(selectItems.length).toBe(2);
        expect(selectItems.map(item => item.name)).toEqual(['count', 'max_salary']);
    });

    test('collects select items from binary query (UNION)', () => {
        // Arrange
        const sql = `
            SELECT id, name FROM users
            UNION
            SELECT id, username FROM accounts
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectValueCollector();

        // Act
        const selectItems = collector.collect(query);

        // Assert
        // Union queries are not currently supported.
        expect(selectItems.length).toBe(0);
    });

    test('collects select items from query with subquery', () => {
        // Arrange
        const sql = `
            SELECT 
                u.id, 
                u.name, 
                (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count
            FROM users u
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectValueCollector();

        // Act
        const selectItems = collector.collect(query);

        // Assert
        expect(selectItems.length).toBe(3);
        expect(selectItems.map(item => item.name)).toEqual(['id', 'name', 'order_count']);
    });

    test('resets collection between visits', () => {
        // Arrange
        const sql1 = `SELECT id, name FROM table1`;
        const sql2 = `SELECT product_id, product_name, price FROM products`;

        const query1 = SelectQueryParser.parse(sql1);
        const query2 = SelectQueryParser.parse(sql2);
        const collector = new SelectValueCollector();

        // Act - First collection
        const items1 = collector.collect(query1);

        // Assert - First collection
        expect(items1.length).toBe(2);
        expect(items1.map(item => item.name)).toEqual(['id', 'name']);

        // Act - Reset and second collection
        const items2 = collector.collect(query2);

        // Assert - Second collection
        expect(items2.length).toBe(3);
        expect(items2.map(item => item.name)).toEqual(['product_id', 'product_name', 'price']);
    });

    test('collects column names from simple select statement', () => {
        // Arrange
        const sql = `SELECT id, name FROM users`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectValueCollector();

        // Act
        const items = collector.collect(query);

        // Assert
        expect(items.length).toBe(2);
        expect(items[0].name).toBe('id');
        expect(items[1].name).toBe('name');
    });

    test('collects column names from subquery statement', () => {
        // Arrange
        const sql = `SELECT a.id, a.value FROM table_a as a`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectValueCollector();

        // Act
        const items = collector.collect(query);
        const itemNames = items.map(x => x.name);

        // Assert - Debug the actual values
        console.log('Items returned:', itemNames);

        // Should collect two unique columns
        expect(items.length).toBe(2);
        expect(itemNames).toContain('id');
        expect(itemNames).toContain('value');
    });

    test('should not return duplicates for identical columns', () => {
        // Arrange
        const sql = `SELECT id, id, name FROM users`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectValueCollector();

        // Act
        const items = collector.collect(query);
        const itemNames = items.map(x => x.name);

        // Assert - Debug to see duplicates
        console.log('Items with possible duplicates:', itemNames);

        // After fix - duplicates are removed
        expect(items.length).toBe(2); // Now returns unique columns
        expect(itemNames).toContain('id');
        expect(itemNames).toContain('name');

        // Ensure id only appears once
        expect(itemNames.filter(name => name === 'id').length).toBe(1);
    });

    test('collects select items from window function with PARTITION BY', () => {
        // Arrange
        const sql = `SELECT sum(tax) OVER(PARTITION BY user_id) as total_tax FROM sales`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectValueCollector();

        // Act
        const selectItems = collector.collect(query);

        // Assert
        // The select item should be 'total_tax'
        expect(selectItems.length).toBe(1);
        expect(selectItems[0].name).toBe('total_tax');
    });
});