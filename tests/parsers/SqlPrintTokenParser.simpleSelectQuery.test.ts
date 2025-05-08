it('should print VALUES query (indent 2, leading comma)', () => {
    // Arrange
    const node = SelectQueryParser.parse(
        'values (1, 2), (3, 4)'
    );
    const parser = new SqlPrintTokenParser();
    const token = parser.visit(node);

    // Act
    const printer = new SqlPrinter({
        indentSize: 2,
        indentChar: ' ',
        newline: '\r\n',
        keywordCase: 'upper',
        commaBreak: 'before',
        andBreak: 'before'
    });
    const sql = printer.print(token);

    // Assert
    expect(sql).toBe([
        'VALUES',
        '  (1, 2)',
        '  , (3, 4)'
    ].join('\r\n'));
});
it('should print SELECT with named window clause (indent 2, leading comma)', () => {
    // Arrange
    const node = SelectQueryParser.parse(
        'select id, salary, sum(salary) over w as total_salary from employees window w as (partition by department_id order by id)'
    );
    const parser = new SqlPrintTokenParser();
    const token = parser.visit(node);

    // Act
    const printer = new SqlPrinter({
        indentSize: 2,
        indentChar: ' ',
        newline: '\r\n',
        keywordCase: 'upper',
        commaBreak: 'before',
        andBreak: 'before'
    });
    const sql = printer.print(token);

    // Assert
    expect(sql).toBe([
        'SELECT',
        '  "id"',
        '  , "salary"',
        '  , sum("salary") OVER "w" AS "total_salary"',
        'FROM',
        '  "employees"',
        'WINDOW',
        '  "w" AS (',
        '    PARTITION BY',
        '      "department_id"',
        '    ORDER BY',
        '      "id"',
        '  )'
    ].join('\r\n'));
});
import { describe, it, expect, beforeAll } from 'vitest'; // Added beforeAll
import { SqlPrintTokenParser } from '../../src/parsers/SqlPrintTokenParser';
import { SqlPrinter } from '../../src/transformers/SqlPrinter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlPrintToken } from '../../src/models/SqlPrintToken'; // Added import for SqlPrintToken

// This test class is for SimpleSelectQuery printing only.
describe('SqlPrintTokenParser + SqlPrinter (SimpleSelectQuery)', () => {
    it('should print simple SELECT * FROM table', () => {
        // Arrange
        const node = SelectQueryParser.parse('select * from users');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('select * from "users"');
    });

    it('should print SELECT with JOIN using USING clause (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select u.id, u.name, o.total ' +
            'from users u ' +
            'inner join orders o using (id)'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "u"."id"',
            '  , "u"."name"',
            '  , "o"."total"',
            'FROM',
            '  "users" AS "u"',
            '  INNER JOIN "orders" AS "o" USING("id")'
        ].join('\r\n'));
    });

    // Removed the original 'should print SELECT with columns' test as it's refactored below

    describe('Formatting "select id, name from users where age > 18 and (status = \'active\' or type = \'admin\')" with different styles', () => {
        const sqlInput = 'select id, name from users where age > 18 and (status = \'active\' or type = \'admin\')';
        let token: SqlPrintToken;

        beforeAll(() => {
            const node = SelectQueryParser.parse(sqlInput);
            const parser = new SqlPrintTokenParser();
            token = parser.visit(node);
        });

        it('should print as one-liner with appropriate options', () => {
            const printer = new SqlPrinter({
                newline: ' ', // Use space as newline for one-liner effect
                indentSize: 0, // No indentation for one-liner
                commaBreak: 'none' // Default, but explicit for clarity
            });
            const sql = printer.print(token);
            expect(sql).toBe('select "id", "name" from "users" where "age" > 18 and ("status" = \'active\' or "type" = \'admin\')');
        });

        it('should print with leading commas', () => {
            const printer = new SqlPrinter({
                commaBreak: 'before',
                indentSize: 2,
                indentChar: ' ',
                newline: '\r\n',
                keywordCase: 'upper',
                andBreak: 'before'
            });
            const sql = printer.print(token);
            expect(sql).toBe([
                'SELECT',
                '  "id"',
                '  , "name"',
                'FROM',
                '  "users"',
                'WHERE',
                '  "age" > 18',
                '  AND ("status" = \'active\' or "type" = \'admin\')'
            ].join('\r\n'));
        });

        it('should print with trailing commas', () => {
            const printer = new SqlPrinter({
                commaBreak: 'after',
                indentSize: 2,
                indentChar: ' ',
                newline: '\r\n',
                keywordCase: 'upper',
                andBreak: 'after'
            });
            const sql = printer.print(token);
            expect(sql).toBe([
                'SELECT',
                '  "id",',
                '  "name"',
                'FROM',
                '  "users"',
                'WHERE',
                '  "age" > 18 AND',
                '  ("status" = \'active\' or "type" = \'admin\')'
            ].join('\r\n'));
        });
    });

    // New describe block for DISTINCT queries
    describe('Formatting SELECT DISTINCT queries with specific style (leading comma, upper case, andBreak before)', () => {
        const printer = new SqlPrinter({
            commaBreak: 'before',
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            andBreak: 'before'
        });
        const parser = new SqlPrintTokenParser();

        it('should format SELECT DISTINCT columns with WHERE clause', () => {
            const sqlInput = 'select distinct id, name from users where age > 18 and type = \'user\'';
            const node = SelectQueryParser.parse(sqlInput);
            const token = parser.visit(node);
            const sql = printer.print(token);
            expect(sql).toBe([
                'SELECT DISTINCT',
                '  "id"',
                '  , "name"',
                'FROM',
                '  "users"',
                'WHERE',
                '  "age" > 18',
                '  AND "type" = \'user\''
            ].join('\r\n'));
        });

        it('should format SELECT DISTINCT ON (column) columns with ORDER BY', () => {
            // Note: This test depends on the parser\'s ability to handle DISTINCT ON.
            // If the parser does not specifically support DISTINCT ON, the output might differ.
            const sqlInput = 'select distinct on (status) id, name, status from users where age > 18 order by status, id desc';
            const node = SelectQueryParser.parse(sqlInput);
            const token = parser.visit(node);
            const sql = printer.print(token);
            // Expected output assumes DISTINCT ON is parsed and handled as a special construct.
            // The actual output will depend on how SqlPrintTokenParser structures tokens for DISTINCT ON.
            expect(sql).toBe([
                'SELECT DISTINCT ON("status")',
                '  "id"',
                '  , "name"',
                '  , "status"',
                'FROM',
                '  "users"',
                'WHERE',
                '  "age" > 18',
                'ORDER BY',
                '  "status"',
                '  , "id" DESC'
            ].join('\r\n'));
        });

        it('should format SELECT DISTINCT with a function call and GROUP BY/HAVING', () => {
            const sqlInput = 'select distinct count(id), status from users group by status having count(id) > 10';
            const node = SelectQueryParser.parse(sqlInput);
            const token = parser.visit(node);
            const sql = printer.print(token);
            expect(sql).toBe([
                'SELECT DISTINCT',
                '  count("id")',
                '  , "status"',
                'FROM',
                '  "users"',
                'GROUP BY',
                '  "status"',
                'HAVING',
                '  count("id") > 10'
            ].join('\r\n'));
        });
    });

    it('should print SELECT with WHERE', () => {
        // Arrange
        const node = SelectQueryParser.parse('select id from users where id = 1');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "id"',
            'FROM',
            '  "users"',
            'WHERE',
            '  "id" = 1'
        ].join('\r\n'));
    });

    it('should print SELECT with multiple JOINs (indent 2)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select u.id, u.name, o.total, a.city ' +
            'from users u ' +
            'inner join orders o on u.id = o.user_id ' +
            'left join addresses a on u.id = a.user_id'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "u"."id"',
            '  , "u"."name"',
            '  , "o"."total"',
            '  , "a"."city"',
            'FROM',
            '  "users" AS "u"',
            '  INNER JOIN "orders" AS "o" ON "u"."id" = "o"."user_id"',
            '  LEFT JOIN "addresses" AS "a" ON "u"."id" = "a"."user_id"'
        ].join('\r\n'));
    });

    it('should print SELECT with LATERAL JOIN (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select u.id, t.max_total ' +
            'from users u ' +
            'left join lateral (select max(total) as max_total from orders o where o.user_id = u.id) t on true'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "u"."id"',
            '  , "t"."max_total"',
            'FROM',
            '  "users" AS "u"',
            '  LEFT JOIN LATERAL (',
            '    SELECT',
            '      max("total") AS "max_total"',
            '    FROM',
            '      "orders" AS "o"',
            '    WHERE',
            '      "o"."user_id" = "u"."id"',
            '  ) AS "t" ON true'
        ].join('\r\n'));
    });

    it('should print SELECT with OVER clause (window function, indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select id, salary, sum(salary) over (partition by department_id order by id) as total_salary ' +
            'from employees'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "id"',
            '  , "salary"',
            '  , sum("salary") OVER(',
            '    PARTITION BY',
            '      "department_id"',
            '    ORDER BY',
            '      "id"',
            '  ) AS "total_salary"',
            'FROM',
            '  "employees"'
        ].join('\r\n'));
    });

    it('should print SELECT with LIMIT and OFFSET (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select id, name from users limit 10 offset 5'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "id"',
            '  , "name"',
            'FROM',
            '  "users"',
            'LIMIT',
            '  10',
            'OFFSET',
            '  5'
        ].join('\r\n'));
    });

    it('should print SELECT with FOR UPDATE (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select id, name from users for update'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "id"',
            '  , "name"',
            'FROM',
            '  "users"',
            'FOR UPDATE'
        ].join('\r\n'));
    });

    it('should print UNION query (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select id, name from users union select id, name from admins'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "id"',
            '  , "name"',
            'FROM',
            '  "users"',
            'UNION',
            'SELECT',
            '  "id"',
            '  , "name"',
            'FROM',
            '  "admins"'
        ].join('\r\n'));
    });
});
