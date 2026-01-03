import { describe, it, expect } from 'vitest';
import { DeleteQueryParser } from '../../src/parsers/DeleteQueryParser';
import { InsertQueryParser } from '../../src/parsers/InsertQueryParser';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { UpdateQueryParser } from '../../src/parsers/UpdateQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const formatterOptions = {
    indentSize: 4,
    indentChar: ' ',
    newline: '\n',
    keywordCase: 'upper',
    commaBreak: 'before',
    identifierEscape: 'none',
} as const;

const indent = ' '.repeat(4);

const createFormatter = () => new SqlFormatter(formatterOptions);

describe('SqlFormatter RETURNING indentation', () => {
    it('indents INSERT RETURNING lists like SELECT lists', () => {
        const query = InsertQueryParser.parse(
            "INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com') RETURNING id, name, email"
        );

        const formattedSql = createFormatter().format(query).formattedSql;

        const expected = [
            'INSERT INTO users(',
            `${indent}id`,
            `${indent}, name`,
            `${indent}, email`,
            ')',
            'VALUES',
            `${indent}(1, 'Alice', 'alice@example.com')`,
            'RETURNING',
            `${indent}id`,
            `${indent}, name`,
            `${indent}, email`,
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });

    it('indents UPDATE RETURNING with a single item', () => {
        const query = UpdateQueryParser.parse(
            "UPDATE users SET name = 'Alice' RETURNING id"
        );

        const formattedSql = createFormatter().format(query).formattedSql;

        const expected = [
            'UPDATE users',
            'SET',
            `${indent}name = 'Alice'`,
            'RETURNING',
            `${indent}id`,
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });

    it('indents DELETE RETURNING * on its own line', () => {
        const query = DeleteQueryParser.parse('DELETE FROM users RETURNING *');

        const formattedSql = createFormatter().format(query).formattedSql;

        const expected = [
            'DELETE FROM users',
            'RETURNING',
            `${indent}*`,
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });

    it('indents RETURNING expressions inside WITH clauses', () => {
        const sql = `
            WITH inserted_users AS (
                INSERT INTO users (name, email)
                VALUES ('Alice', 'alice@example.com')
                RETURNING lower(name) AS lower_name, CAST(email AS text) AS email_text
            )
            SELECT * FROM inserted_users
        `;

        const query = SelectQueryParser.parse(sql);
        const formattedSql = createFormatter().format(query).formattedSql;

        const expectedReturningBlock = [
            `${indent.repeat(2)}RETURNING`,
            `${indent.repeat(3)}lower(name) AS lower_name`,
            `${indent.repeat(3)}, cast(email as text) AS email_text`,
        ].join('\n');

        expect(formattedSql).toContain(expectedReturningBlock);
    });
});
