import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { Lexeme, TokenType } from '../../src/models/Lexeme';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlTokenizer } from '../../src/parsers/SqlTokenizer';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

type CommentStyle = 'block' | 'line';

interface GeneratedComment {
    style: CommentStyle;
    text: string;
}

interface GeneratedQuery {
    name: string;
    baseSql: string;
    commentedSql: string;
}

const formatter = new SqlFormatter({
    exportComment: true,
    keywordCase: 'lower',
    newline: ' ',
});

const commentTextArb = fc
    .array(
        fc.constantFrom(
            'header',
            'field',
            'source',
            'filter',
            'join',
            'join-keyword',
            'join-source',
            'join-alias',
            'join-on',
            'cte',
            'value',
            'order',
            'group',
            'case',
            'note',
            'safe'
        ),
        { minLength: 1, maxLength: 4 }
    )
    .map((words) => words.join(' '));

const commentArb = fc.record({
    style: fc.constantFrom<CommentStyle>('block', 'line'),
    text: commentTextArb,
});

const commentsArb = fc.array(commentArb, { minLength: 24, maxLength: 24 });

function renderComment(comment: GeneratedComment): string {
    if (comment.style === 'line') {
        return `\n-- ${comment.text}\n`;
    }
    return ` /* ${comment.text} */ `;
}

interface TokenSignature {
    type: number;
    value: string;
}

function normalizeTokenValue(lexeme: Lexeme): string {
    if ((lexeme.type & TokenType.Command) !== 0) {
        return lexeme.value.toLowerCase();
    }
    return lexeme.value;
}

function normalizeTokenType(lexeme: Lexeme): number {
    if ((lexeme.type & TokenType.Command) !== 0) {
        return TokenType.Command;
    }
    if ((lexeme.type & TokenType.Identifier) !== 0) {
        return TokenType.Identifier;
    }
    return lexeme.type;
}

function tokenSignatures(sql: string): TokenSignature[] {
    const signatures = new SqlTokenizer(sql).tokenize().map((lexeme) => ({
        type: normalizeTokenType(lexeme),
        value: normalizeTokenValue(lexeme),
    }));
    return omitOptionalAliasAs(signatures);
}

function omitOptionalAliasAs(signatures: TokenSignature[]): TokenSignature[] {
    return signatures.filter((signature, index) => {
        if (signature.type !== TokenType.Command || signature.value !== 'as') {
            return true;
        }

        const next = signatures[index + 1];
        return next?.type === TokenType.OpenParen;
    });
}

function format(sql: string): string {
    const query = SelectQueryParser.parse(sql);
    return formatter.format(query).formattedSql;
}

function expectSameTokenSequence(actualSql: string, expectedSql: string, name: string): void {
    const actual = tokenSignatures(actualSql);
    const expected = tokenSignatures(expectedSql);

    expect(actual.length, `${name}: token count`).toBe(expected.length);
    expect(actual, `${name}: token sequence`).toEqual(expected);
}

function expectFormatPreservesTokenSequence(sql: string, name: string): void {
    const formattedSql = format(sql);
    expectSameTokenSequence(formattedSql, sql, name);
}

function selectWithWhere(comments: GeneratedComment[]): GeneratedQuery {
    const c = comments.map(renderComment);
    return {
        name: 'select-with-where',
        baseSql: 'select u.id, u.name from users u where u.active = true and u.age >= 18 order by u.name',
        commentedSql: [
            c[0],
            'select',
            c[1],
            'u.id',
            c[2],
            ', u.name',
            c[3],
            'from users u',
            c[4],
            'where',
            c[5],
            'u.active = true',
            c[6],
            'and u.age >= 18',
            c[7],
            'order by u.name',
        ].join(' '),
    };
}

function selectWithJoin(comments: GeneratedComment[]): GeneratedQuery {
    const c = comments.map(renderComment);
    return {
        name: 'select-with-join',
        baseSql: 'select u.id, o.total from users u left join orders o on u.id = o.user_id where o.total > 10',
        commentedSql: [
            c[0],
            'select u.id',
            c[1],
            ', o.total',
            c[2],
            'from users u',
            c[3],
            'left join orders o',
            c[4],
            'on',
            c[5],
            'u.id = o.user_id',
            c[6],
            'where o.total > 10',
        ].join(' '),
    };
}

function selectWithJoinKeywordComments(comments: GeneratedComment[]): GeneratedQuery {
    const c = comments.map(renderComment);
    return {
        name: 'select-with-join-keyword-comments',
        baseSql: [
            'select u.id, o.total',
            'from users u',
            'left join orders o on u.id = o.user_id',
            'where o.total > 10',
        ].join(' '),
        commentedSql: [
            c[0],
            'select u.id',
            c[1],
            ', o.total',
            c[2],
            'from',
            c[3],
            'users',
            c[4],
            'u',
            c[5],
            'left',
            c[6],
            'join',
            c[7],
            'orders',
            c[8],
            'o',
            c[9],
            'on',
            c[10],
            'u.id = o.user_id',
            c[11],
            'where o.total > 10',
        ].join(' '),
    };
}

function selectWithJoinConditionComments(comments: GeneratedComment[]): GeneratedQuery {
    const c = comments.map(renderComment);
    return {
        name: 'select-with-join-condition-comments',
        baseSql: [
            'select u.id, o.total',
            'from users u',
            'inner join orders o',
            'on u.id = o.user_id and u.region = o.region',
            'where u.active = true',
        ].join(' '),
        commentedSql: [
            c[0],
            'select u.id, o.total',
            c[1],
            'from users u',
            c[2],
            'inner join orders o',
            c[3],
            'on',
            c[4],
            'u.id',
            c[5],
            '=',
            c[6],
            'o.user_id',
            c[7],
            'and',
            c[8],
            'u.region',
            c[9],
            '=',
            c[10],
            'o.region',
            c[11],
            'where u.active = true',
        ].join(' '),
    };
}

function selectWithMultipleJoinComments(comments: GeneratedComment[]): GeneratedQuery {
    const c = comments.map(renderComment);
    return {
        name: 'select-with-multiple-join-comments',
        baseSql: [
            'select u.id, o.total, p.name',
            'from users u',
            'join orders o on u.id = o.user_id',
            'left join products p on o.product_id = p.id',
            'where p.active = true',
        ].join(' '),
        commentedSql: [
            c[0],
            'select u.id, o.total, p.name',
            c[1],
            'from users u',
            c[2],
            'join',
            c[3],
            'orders o',
            c[4],
            'on u.id = o.user_id',
            c[5],
            'left',
            c[6],
            'join',
            c[7],
            'products',
            c[8],
            'p',
            c[9],
            'on',
            c[10],
            'o.product_id = p.id',
            c[11],
            'where p.active = true',
        ].join(' '),
    };
}

function selectWithCte(comments: GeneratedComment[]): GeneratedQuery {
    const c = comments.map(renderComment);
    return {
        name: 'select-with-cte',
        baseSql: 'with active_users as (select id, name from users where active = true) select id, name from active_users order by name',
        commentedSql: [
            c[0],
            'with',
            c[1],
            'active_users as (',
            c[2],
            'select id, name',
            c[3],
            'from users',
            c[4],
            'where active = true',
            c[5],
            ')',
            c[6],
            'select id, name',
            c[7],
            'from active_users order by name',
        ].join(' '),
    };
}

function selectWithExists(comments: GeneratedComment[]): GeneratedQuery {
    const c = comments.map(renderComment);
    return {
        name: 'select-with-exists',
        baseSql: 'select c.id from customers c where exists (select 1 from orders o where o.customer_id = c.id)',
        commentedSql: [
            c[0],
            'select c.id',
            c[1],
            'from customers c',
            c[2],
            'where exists (',
            c[3],
            'select 1',
            c[4],
            'from orders o',
            c[5],
            'where o.customer_id = c.id',
            c[6],
            ')',
        ].join(' '),
    };
}

function selectWithGroupBy(comments: GeneratedComment[]): GeneratedQuery {
    const c = comments.map(renderComment);
    return {
        name: 'select-with-group-by',
        baseSql: 'select department, count(*) as employee_count from employees group by department having count(*) > 5',
        commentedSql: [
            c[0],
            'select department',
            c[1],
            ', count(*) as employee_count',
            c[2],
            'from employees',
            c[3],
            'group by department',
            c[4],
            'having count(*) > 5',
        ].join(' '),
    };
}

function selectWithCase(comments: GeneratedComment[]): GeneratedQuery {
    const c = comments.map(renderComment);
    return {
        name: 'select-with-case',
        baseSql: "select case when status = 'active' then 'ACTIVE' else 'INACTIVE' end as status_label from users",
        commentedSql: [
            c[0],
            'select case',
            c[1],
            "when status = 'active'",
            c[2],
            "then 'ACTIVE'",
            c[3],
            "else 'INACTIVE'",
            c[4],
            'end as status_label',
            c[5],
            'from users',
        ].join(' '),
    };
}

const queryArb = commentsArb.chain((comments) =>
    fc.constantFrom(
        selectWithWhere(comments),
        selectWithJoin(comments),
        selectWithJoinKeywordComments(comments),
        selectWithJoinConditionComments(comments),
        selectWithMultipleJoinComments(comments),
        selectWithCte(comments),
        selectWithExists(comments),
        selectWithGroupBy(comments),
        selectWithCase(comments)
    )
);

describe('SqlFormatter comment statement invariance', () => {
    test('commented SELECT queries keep the same token sequence after formatting', () => {
        fc.assert(
            fc.property(queryArb, ({ name, baseSql, commentedSql }) => {
                expectSameTokenSequence(commentedSql, baseSql, `${name}: comments do not add SQL tokens`);
                expectFormatPreservesTokenSequence(commentedSql, `${name}: format preserves tokens`);
            }),
            {
                numRuns: 200,
            }
        );
    });

    test('comments between CASE and WHEN keep token count even when comment text is not exactly recoverable', () => {
        const sql = [
            "select case /* aa */ when status = 'active'",
            "then 'ACTIVE'",
            "else 'INACTIVE'",
            'end as status_label',
            'from users',
        ].join(' ');

        expectFormatPreservesTokenSequence(sql, 'case-comment-between-case-and-when');
    });

    test('optional alias AS does not affect token sequence comparison', () => {
        expectSameTokenSequence(
            'select u.id from users as u left join orders as o on u.id = o.user_id',
            'select u.id from users u left join orders o on u.id = o.user_id',
            'optional-alias-as'
        );
    });

    test('optional final semicolon does not affect token sequence comparison', () => {
        expectSameTokenSequence(
            'select u.id from users u where u.active = true;',
            'select u.id from users u where u.active = true',
            'optional-final-semicolon'
        );
    });
});
