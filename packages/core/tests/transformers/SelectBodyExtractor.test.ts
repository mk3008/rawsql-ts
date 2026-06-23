import { describe, expect, test } from 'vitest';
import { Formatter } from '../../src/transformers/Formatter';
import { SelectBodyExtractor } from '../../src/transformers/SelectBodyExtractor';

const formatter = new Formatter();

describe('SelectBodyExtractor', () => {
    test('extracts SELECT body from CREATE TABLE AS SELECT', () => {
        const result = SelectBodyExtractor.extract(`
            CREATE TABLE reporting.customer_totals AS
            SELECT customer_id, SUM(amount) AS total
            FROM orders
            GROUP BY customer_id
        `);

        expect(result.supported).toBe(true);
        expect(result.kind).toBe('create-table-as');
        expect(result.targetName).toBe('reporting.customer_totals');
        expect(formatter.format(result.selectQuery!)).toBe('select "customer_id", sum("amount") as "total" from "orders" group by "customer_id"');
    });

    test('extracts SELECT body from CREATE TEMPORARY TABLE AS SELECT', () => {
        const result = SelectBodyExtractor.extract(`
            CREATE TEMPORARY TABLE temp_report AS
            SELECT id FROM orders
        `);

        expect(result.supported).toBe(true);
        expect(result.kind).toBe('create-table-as');
        expect(result.targetName).toBe('temp_report');
        expect(formatter.format(result.selectQuery!)).toBe('select "id" from "orders"');
    });

    test('extracts SELECT body from CREATE VIEW AS SELECT', () => {
        const result = SelectBodyExtractor.extract(`
            CREATE VIEW reporting.customer_view AS
            SELECT id, name FROM customers
        `);

        expect(result.supported).toBe(true);
        expect(result.kind).toBe('create-view');
        expect(result.targetName).toBe('reporting.customer_view');
        expect(formatter.format(result.selectQuery!)).toBe('select "id", "name" from "customers"');
    });

    test('extracts SELECT body from CREATE MATERIALIZED VIEW AS SELECT', () => {
        const result = SelectBodyExtractor.extract(`
            CREATE MATERIALIZED VIEW reporting.customer_snapshot AS
            SELECT id, name FROM customers
        `);

        expect(result.supported).toBe(true);
        expect(result.kind).toBe('create-materialized-view');
        expect(result.targetName).toBe('reporting.customer_snapshot');
        expect(formatter.format(result.selectQuery!)).toBe('select "id", "name" from "customers"');
    });

    test('extracts SELECT body from INSERT SELECT', () => {
        const result = SelectBodyExtractor.extract(`
            INSERT INTO reporting.customer_totals (customer_id, total)
            SELECT customer_id, SUM(amount) AS total
            FROM orders
            GROUP BY customer_id
        `);

        expect(result.supported).toBe(true);
        expect(result.kind).toBe('insert-select');
        expect(result.targetName).toBe('reporting.customer_totals');
        expect(formatter.format(result.selectQuery!)).toBe('select "customer_id", sum("amount") as "total" from "orders" group by "customer_id"');
    });

    test('returns unsupported result for wrappers without SELECT bodies', () => {
        const createResult = SelectBodyExtractor.extract(`CREATE TABLE users (id integer)`);
        expect(createResult).toMatchObject({
            supported: false,
            kind: null,
            targetName: 'users',
            selectQuery: null,
            reason: 'No embedded SELECT body found.'
        });

        const insertResult = SelectBodyExtractor.extract(`INSERT INTO users (id) VALUES (1)`);
        expect(insertResult).toMatchObject({
            supported: false,
            kind: null,
            targetName: 'users',
            selectQuery: null,
            reason: 'No embedded SELECT body found.'
        });
    });
});
